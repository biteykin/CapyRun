# app.py — CapyRun FIT Analyzer (modular)
# - Auth + Profile вынесены в auth.py и profile.py
# - Хелперы вынесены в utils.py
# - Сохранение тренировок в БД (db.py)
# - Отчёт по одному .fit, дашборд по нескольким, план на 7 дней, экспорт в .ics и Excel

import pandas as pd
import altair as alt
import streamlit as st
from fitparse import FitFile
import datetime as dt

# --- наши модули ---
from auth import get_supabase, auth_sidebar
from profile import load_or_init_profile, profile_sidebar
from db import save_workouts, fetch_workouts
from utils import (
    get_val,
    pace_from_speed,
    speed_to_pace_min_per_km,
    format_duration,
    parse_bounds,
    compute_trimp_timeweighted,
    efficiency_factor,
    decoupling,
    zones_time,
    to_excel,
    ewma_daily,
    build_ics,
)

# =========================================================
# UI
# =========================================================
st.set_page_config(page_title="CapyRun — FIT Analyzer", page_icon="🏃", layout="wide")
st.title("🏃 CapyRun — FIT Analyzer")
st.caption("Загрузи один или несколько .fit → отчёт / прогресс / план + календарь (ICS) + Excel")

# Supabase клиент
supabase = get_supabase()

# Sidebar: auth + profile
# Sidebar: auth + profile
with st.sidebar:
    # Авторизация
    user = auth_sidebar(supabase)
    if not user:
        # Если не залогинен — форма логина + stop()
        st.stop()

    # 2) Профиль атлета (HR/zones) — загрузка и UI
    profile_row = load_or_init_profile(supabase, user.id)
    hr_rest, hr_max, zone_bounds_text = profile_sidebar(supabase, user, profile_row)

uploaded = st.file_uploader("Загрузите FIT-файл(ы)", type=["fit"], accept_multiple_files=True)

# =========================================================
# Parsing logic
# =========================================================
def parse_fit_file(uploaded_file, hr_rest: int, hr_max: int):
    """Вернёт df_rec, df_laps, df_ses, summary (с time_s, time_min, time_hms)."""
    fit = FitFile(uploaded_file)

    # Records
    rec_rows = []
    for m in fit.get_messages("record"):
        rec_rows.append({
            "timestamp": get_val(m, "timestamp"),
            "hr":        get_val(m, "heart_rate"),
            "speed":     get_val(m, "speed", "enhanced_speed"),  # m/s
            "cadence":   get_val(m, "cadence"),
            "power":     get_val(m, "power"),
            "elev":      get_val(m, "altitude", "enhanced_altitude"),
            "dist":      get_val(m, "distance"),                 # meters (cumulative)
        })
    df_rec = pd.DataFrame(rec_rows)
    if not df_rec.empty:
        df_rec["timestamp"] = pd.to_datetime(df_rec["timestamp"], errors="coerce")
        df_rec = df_rec.sort_values("timestamp").reset_index(drop=True)
        if df_rec["timestamp"].notna().any():
            t0 = df_rec["timestamp"].min()
            df_rec["t_rel_s"] = (df_rec["timestamp"] - t0).dt.total_seconds()
        else:
            df_rec["t_rel_s"] = range(len(df_rec))
        df_rec["dt_s"] = pd.Series(df_rec["t_rel_s"]).diff().fillna(0).clip(lower=0)
        df_rec["pace"] = df_rec["speed"].apply(pace_from_speed)

    # Laps
    lap_rows = []
    for m in fit.get_messages("lap"):
        lap_rows.append({
            "start_time": get_val(m, "start_time"),
            "total_distance_m": get_val(m, "total_distance"),
            "total_timer_time_s": get_val(m, "total_timer_time"),
            "avg_hr": get_val(m, "avg_heart_rate"),
            "max_hr": get_val(m, "max_heart_rate"),
            "avg_speed_m_s": get_val(m, "avg_speed", "enhanced_avg_speed"),
            "max_speed_m_s": get_val(m, "max_speed", "enhanced_max_speed"),
            "avg_cadence": get_val(m, "avg_cadence"),
            "total_ascent_m": get_val(m, "total_ascent"),
            "total_descent_m": get_val(m, "total_descent"),
            "lap_trigger": get_val(m, "lap_trigger"),
        })
    df_laps = pd.DataFrame(lap_rows)
    if not df_laps.empty:
        df_laps["start_time"] = pd.to_datetime(df_laps["start_time"], errors="coerce")
        df_laps = df_laps.sort_values("start_time").reset_index(drop=True)

    # Sessions
    ses_rows = []
    for m in fit.get_messages("session"):
        ses_rows.append({
            "start_time": get_val(m, "start_time"),
            "sport": get_val(m, "sport"),
            "sub_sport": get_val(m, "sub_sport"),
            "total_distance_m": get_val(m, "total_distance"),
            "total_elapsed_time_s": get_val(m, "total_elapsed_time"),
            "total_timer_time_s": get_val(m, "total_timer_time"),
            "avg_hr": get_val(m, "avg_heart_rate"),
            "max_hr": get_val(m, "max_heart_rate"),
            "avg_speed_m_s": get_val(m, "avg_speed", "enhanced_avg_speed"),
            "max_speed_m_s": get_val(m, "max_speed", "enhanced_max_speed"),
            "avg_cadence": get_val(m, "avg_cadence"),
            "total_ascent_m": get_val(m, "total_ascent"),
            "total_descent_m": get_val(m, "total_descent"),
        })
    df_ses = pd.DataFrame(ses_rows)

    # Summary per workout
    start_time = None
    if not df_ses.empty and pd.notna(df_ses.iloc[0].get("start_time")):
        start_time = pd.to_datetime(df_ses.iloc[0]["start_time"])
    elif not df_rec.empty and df_rec["timestamp"].notna().any():
        start_time = df_rec["timestamp"].min()

    # distance
    if not df_ses.empty and pd.notna(df_ses.iloc[0].get("total_distance_m")):
        distance_km = df_ses.iloc[0]["total_distance_m"] / 1000.0
    elif not df_rec.empty and df_rec["dist"].notna().any():
        distance_km = df_rec["dist"].max() / 1000.0
    else:
        distance_km = None

    # duration
    if not df_ses.empty and pd.notna(df_ses.iloc[0].get("total_timer_time_s")):
        time_s = float(df_ses.iloc[0]["total_timer_time_s"])
    elif not df_rec.empty and "t_rel_s" in df_rec and pd.notna(df_rec["t_rel_s"]).any():
        time_s = float(df_rec["t_rel_s"].max() - df_rec["t_rel_s"].min())
    else:
        time_s = None
    time_min = (time_s / 60.0) if (time_s is not None) else None
    time_hms = format_duration(time_s) if time_s is not None else None

    # avg hr
    if not df_ses.empty and pd.notna(df_ses.iloc[0].get("avg_hr")):
        avg_hr = float(df_ses.iloc[0]["avg_hr"])
    elif not df_rec.empty and pd.notna(df_rec["hr"]).any():
        avg_hr = float(pd.Series(df_rec["hr"]).mean())
    else:
        avg_hr = None

    # TRIMP
    trimp = compute_trimp_timeweighted(
        df_rec["hr"] if "hr" in df_rec else None,
        df_rec["dt_s"] if "dt_s" in df_rec else None,
        hr_rest, hr_max
    )

    # EF / Decoupling
    ef = efficiency_factor(df_rec["speed"] if "speed" in df_rec else None,
                           df_rec["hr"] if "hr" in df_rec else None)
    de = decoupling(df_rec["speed"] if "speed" in df_rec else None,
                    df_rec["hr"] if "hr" in df_rec else None)

    summary = {
        "start_time": start_time,
        "date": start_time.date() if start_time else None,
        "sport": (df_ses.iloc[0]["sport"] if not df_ses.empty else None),
        "distance_km": round(distance_km, 2) if distance_km else None,
        "time_s": round(time_s) if time_s is not None else None,
        "time_min": round(time_min, 1) if time_min is not None else None,
        "time_hms": time_hms,
        "avg_hr": int(round(avg_hr)) if avg_hr else None,
        "TRIMP": int(round(trimp)) if trimp else None,
        "EF": round(ef, 4) if ef else None,
        "Pa:Hr_%": round(de, 1) if de is not None else None,
    }

    return df_rec, df_laps, df_ses, summary

# =========================================================
# Main logic
# =========================================================
if not uploaded:
    st.info("Загрузи один или несколько .fit файлов, чтобы увидеть отчёт/прогресс.")
else:
    # ---------------- Один файл ----------------
    if len(uploaded) == 1:
        f = uploaded[0]
        df_rec, df_laps, df_ses, summary = parse_fit_file(f, hr_rest, hr_max)

        bounds = parse_bounds(zone_bounds_text)
        zt = zones_time(df_rec["hr"], bounds) if (not df_rec.empty and bounds) else None

        # KPIs
        c1, c2, c3 = st.columns(3)
        with c1:
            st.metric("Дистанция", f"{summary['distance_km']:.2f} км" if summary["distance_km"] else "—")
        with c2:
            st.metric("Время", summary["time_hms"] or (f"{summary['time_min']:.1f} мин" if summary["time_min"] else "—"))
        with c3:
            st.metric("TRIMP (≈)", f"{summary['TRIMP']}" if summary["TRIMP"] else "—")

        c4, c5, c6 = st.columns(3)
        with c4:
            st.metric("EF (скорость/HR)", f"{summary['EF']}" if summary["EF"] else "—")
        with c5:
            st.metric("Decoupling Pa:Hr", f"{summary['Pa:Hr_%']}%" if summary["Pa:Hr_%"] is not None else "—")
        with c6:
            st.metric("Средний HR", f"{summary['avg_hr']}" if summary["avg_hr"] else "—")

        st.divider()

        # Charts
        if not df_rec.empty:
            left, right = st.columns(2)
            with left:
                st.subheader("Пульс и темп")
                base = pd.DataFrame({
                    "t_min": pd.Series(df_rec["t_rel_s"]) / 60.0,
                    "HR": df_rec["hr"],
                    "Pace (мин/км)": pd.to_numeric(pd.Series(df_rec["speed"]).apply(speed_to_pace_min_per_km), errors="coerce")
                })
                st.altair_chart(alt.Chart(base).mark_line().encode(x="t_min:Q", y="HR:Q").interactive(), use_container_width=True)
                st.altair_chart(alt.Chart(base).mark_line().encode(x="t_min:Q", y=alt.Y("Pace (мин/км):Q", sort="descending")).interactive(), use_container_width=True)
            with right:
                st.subheader("Каденс и высота")
                base2 = pd.DataFrame({
                    "t_min": pd.Series(df_rec["t_rel_s"]) / 60.0,
                    "Cadence (spm)": df_rec["cadence"],
                    "Elevation (m)": df_rec["elev"],
                })
                st.altair_chart(alt.Chart(base2).mark_line().encode(x="t_min:Q", y="Cadence (spm):Q").interactive(), use_container_width=True)
                st.altair_chart(alt.Chart(base2).mark_line().encode(x="t_min:Q", y="Elevation (m):Q").interactive(), use_container_width=True)

        # Zones
        st.subheader("Зоны пульса")
        if zt is not None:
            df_z = zt.rename_axis("Zone").reset_index(name="seconds")
            total = df_z["seconds"].sum()
            df_z["%"] = (df_z["seconds"] / total * 100).round(1)
            st.dataframe(df_z)
        else:
            st.write("Нет данных HR или не заданы границы зон.")

        # Tables
        st.subheader("Сессия")
        st.dataframe(df_ses if not df_ses.empty else pd.DataFrame(columns=["—"]))
        st.subheader("Круги (laps)")
        st.dataframe(df_laps if not df_laps.empty else pd.DataFrame(columns=["—"]))
        st.subheader("Точки (records) — без GPS")
        st.dataframe(df_rec.head(500) if not df_rec.empty else pd.DataFrame(columns=["—"]))
        if not df_rec.empty and len(df_rec) > 500:
            st.caption(f"Показаны первые 500 строк из {len(df_rec)}.")

        # Downloads
        xls = to_excel({
            "Summary": pd.DataFrame([summary]),
            "Sessions": df_ses,
            "Laps": df_laps,
            "Records": df_rec
        })
        st.download_button("⬇️ Скачать Excel", data=xls,
                           file_name="fit_report.xlsx",
                           mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        # Save to DB
        if st.button("📦 Сохранить тренировку в историю"):
            save_workouts(supabase, user.id, [summary])
            st.success("Сохранено в БД")

    # ---------------- Несколько файлов ----------------
    else:
        st.subheader("📈 Прогресс: сводка по тренировкам")
        summaries = []
        for f in uploaded:
            df_rec, df_laps, df_ses, summary = parse_fit_file(f, hr_rest, hr_max)
            summaries.append(summary)

        df_sum = pd.DataFrame(summaries).dropna(subset=["date"]).sort_values("start_time").reset_index(drop=True)
        if df_sum.empty:
            st.info("Недостаточно данных с датами для построения трендов.")
            st.stop()

        df_sum["date"] = pd.to_datetime(df_sum["date"]).dt.normalize()
        if "time_s" in df_sum.columns:
            df_sum["time_hms"] = df_sum["time_s"].apply(format_duration)

        st.dataframe(df_sum)

        # Daily load + ATL/CTL/TSB
        st.subheader("Нагрузка (TRIMP) по дням и тренды ATL/CTL/TSB")
        daily = df_sum.groupby("date").agg(
            TRIMP=("TRIMP", "sum"),
            distance_km=("distance_km", "sum")
        ).reset_index()

        full = pd.DataFrame({"date": pd.date_range(df_sum["date"].min(), df_sum["date"].max(), freq="D")})
        daily = full.merge(daily, on="date", how="left").fillna({"TRIMP": 0.0, "distance_km": 0.0})

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

        # Plan for next week
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

        # ICS export
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

                # опционально: локация и напоминание
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

        # Excel export
        xls = to_excel({"Workouts": df_sum, "DailyLoad": daily, "NextWeekPlan": plan_df})
        st.download_button("⬇️ Скачать Excel (прогресс + план)", data=xls,
                           file_name="capyrun_progress.xlsx",
                           mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        # Save all to DB
        if st.button("📦 Сохранить все тренировки в историю"):
            save_workouts(supabase, user.id, summaries)
            st.success("Сохранено в БД")

        # History from DB
        with st.expander("📚 Мои тренировки"):
            df_hist = fetch_workouts(supabase, user.id, limit=100)
            if not df_hist.empty:
                df_hist = df_hist.copy()
                if "time_s" in df_hist.columns:
                    df_hist["время"] = df_hist["time_s"].apply(format_duration)
                st.dataframe(df_hist)
            else:
                st.write("Пока пусто.")
