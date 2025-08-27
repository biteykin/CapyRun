# views_multi.py
import pandas as pd
import altair as alt
import streamlit as st
import datetime as dt
from parsing import parse_fit_file
from db import save_workouts, fetch_workouts
from utils import format_duration, ewma_daily, build_ics, to_excel

def render_multi_workouts(files, supabase, user_id, hr_rest: int, hr_max: int):
    st.subheader("📈 Прогресс: сводка по тренировкам")

    # --- Parse all files and collect summaries ---
    summaries = []
    for f in files:
        try:
            _, _, _, summary = parse_fit_file(f, hr_rest, hr_max)
            if summary is not None and isinstance(summary, dict):
                summaries.append(summary)
        except Exception as e:
            st.warning(f"Ошибка при обработке файла: {getattr(f, 'name', str(f))}. {e}")

    # --- Build DataFrame for summaries ---
    if not summaries:
        st.info("Нет данных для анализа тренировок.")
        return

    df_sum = pd.DataFrame(summaries)
    # Defensive: ensure 'date' and 'start_time' exist and are not all NaN
    if "date" not in df_sum.columns or df_sum["date"].isna().all():
        st.info("Недостаточно данных с датами для построения трендов.")
        return

    # Drop rows without date, sort by start_time if present
    df_sum = df_sum.dropna(subset=["date"])
    if "start_time" in df_sum.columns:
        df_sum = df_sum.sort_values("start_time")
    df_sum = df_sum.reset_index(drop=True)

    # Normalize date column
    df_sum["date"] = pd.to_datetime(df_sum["date"], errors="coerce").dt.normalize()
    if "time_s" in df_sum.columns:
        df_sum["time_hms"] = df_sum["time_s"].apply(format_duration)

    st.dataframe(df_sum)

    # --- Daily load + ATL/CTL/TSB ---
    st.subheader("Нагрузка (TRIMP) по дням и тренды ATL/CTL/TSB")
    # Defensive: fill missing TRIMP/distance_km with 0 for aggregation
    for col in ["TRIMP", "distance_km"]:
        if col not in df_sum.columns:
            df_sum[col] = 0.0
        else:
            df_sum[col] = pd.to_numeric(df_sum[col], errors="coerce").fillna(0.0)

    daily = df_sum.groupby("date").agg(
        TRIMP=("TRIMP", "sum"),
        distance_km=("distance_km", "sum")
    ).reset_index()

    # Fill missing days in the range
    if not daily.empty:
        full = pd.DataFrame({"date": pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")})
        daily = full.merge(daily, on="date", how="left").fillna({"TRIMP": 0.0, "distance_km": 0.0})
    else:
        st.info("Недостаточно данных для построения дневной нагрузки.")
        return

    daily["ATL"] = ewma_daily(daily["TRIMP"].values, tau_days=7)
    daily["CTL"] = ewma_daily(daily["TRIMP"].values, tau_days=42)
    daily["TSB"] = daily["CTL"] - daily["ATL"]

    base = daily.melt(id_vars="date", value_vars=["TRIMP","ATL","CTL","TSB"], var_name="metric", value_name="value")
    chart = alt.Chart(base).mark_line().encode(x="date:T", y="value:Q", color="metric:N").interactive()
    st.altair_chart(chart, use_container_width=True)

    last7 = daily.tail(7)
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.metric("TRIMP 7д", f"{last7['TRIMP'].sum():.0f}")
    with c2:
        st.metric("DIST 7д", f"{last7['distance_km'].sum():.1f} км")
    with c3:
        st.metric("ATL (сегодня)", f"{daily['ATL'].iloc[-1]:.0f}")
    with c4:
        st.metric("TSB (сегодня)", f"{daily['TSB'].iloc[-1]:.0f}")

    # --- Plan for next week ---
    st.subheader("📝 Черновик плана на следующую неделю")
    plan_df = pd.DataFrame()
    note = None
    if not daily.empty and not last7.empty:
        last_week_km = float(last7["distance_km"].sum())
        tsb_now = float(daily["TSB"].iloc[-1])

        if tsb_now < -10:
            target_km = max(0.0, last_week_km * 0.9)
            note = "TSB низкий → снизим объём (~-10%) для восстановления."
        elif tsb_now > 10:
            target_km = last_week_km * 1.10
            note = "TSB высокий → можно аккуратно поднять объём (~+10%)."
        else:
            target_km = last_week_km * 1.05
            note = "TSB в норме → поддержим/слегка увеличим (~+5%)."

        dist_split = pd.Series([0.12,0.16,0.10,0.18,0.08,0.26,0.10])  # Пн..Вс
        day_names = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]
        km_plan = (dist_split * target_km).round(1)
        types = ["Easy Z1–Z2", "Tempo Z3 (20–30 мин)", "Easy Z1–Z2",
                 "Intervals Z4 (6×3’/2’)", "Recovery 30–40’ Z1", "Long Z2", "Easy + strides"]

        plan_df = pd.DataFrame({"День": day_names, "Тип": types, "Пробежка (км)": km_plan})
        if note:
            st.write(note)
        st.dataframe(plan_df)
    else:
        st.info("Недостаточно данных для составления плана (нужно ≥1 день с данными).")

    # --- ICS export ---
    with st.expander("📆 Экспорт плана в календарь (.ics)"):
        if plan_df.empty:
            st.warning("План пуст — сначала сформируй его выше.")
        else:
            today = dt.date.today()
            next_monday = today + dt.timedelta(days=(7 - today.weekday())) if today.weekday() != 0 else today
            start_date = st.date_input("Дата начала плана", value=next_monday)
            workout_time = st.time_input("Время тренировки", value=dt.time(7, 0))
            selected_days = st.multiselect("Какие дни добавить",
                                           options=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],
                                           default=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"])
            duration_minutes = st.number_input("Длительность события (мин)", 15, 240, 60, 5)

            location = st.text_input("Локация (опц.)", value="")
            alert_min = st.number_input("Напоминание, мин до старта", 0, 1440, 15, 5)

            ics_text = build_ics(
                plan_df=plan_df,
                start_date=start_date,
                workout_time=workout_time,
                selected_days=selected_days,
                duration_minutes=duration_minutes,
                location=location,
                alert_minutes=int(alert_min) if alert_min else 0,
            )
            st.download_button("📥 Скачать iCal (.ics)", data=ics_text, file_name="capyrun_plan.ics", mime="text/calendar")

    # --- Excel export ---
    xls = to_excel({"Workouts": df_sum, "DailyLoad": daily, "NextWeekPlan": plan_df})
    st.download_button("⬇️ Скачать Excel (прогресс + план)", data=xls,
                       file_name="capyrun_progress.xlsx",
                       mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    # --- Save all to DB ---
    if st.button("📦 Сохранить все тренировки в историю"):
        save_workouts(supabase, user_id, summaries)
        st.success("Сохранено в БД")

    # --- History from DB ---
    with st.expander("📚 Мои тренировки"):
        try:
            df_hist = fetch_workouts(supabase, user_id, limit=100)
            # Defensive: check if df_hist is a DataFrame and not empty
            if isinstance(df_hist, pd.DataFrame) and not df_hist.empty:
                df_hist = df_hist.copy()
                if "time_s" in df_hist.columns:
                    df_hist["время"] = df_hist["time_s"].apply(format_duration)
                st.dataframe(df_hist)
            else:
                st.write("Пока пусто.")
        except ValueError as e:
            st.error("Ошибка при загрузке истории тренировок. Возможно, история пуста или повреждена.")
        except Exception as e:
            st.error(f"Не удалось загрузить историю тренировок: {e}")
