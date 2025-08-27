# app.py — CapyRun FIT Analyzer v3.1 (date merge fix)

import io
import math
import numpy as np
import pandas as pd
import altair as alt
import streamlit as st
from fitparse import FitFile
from datetime import timedelta
from math import exp

# ---------------- UI / Sidebar ----------------
st.set_page_config(page_title="CapyRun — FIT Analyzer v3.1", page_icon="🏃", layout="wide")
st.title("🏃 CapyRun — FIT Analyzer v3.1")
st.caption("Загрузи один или несколько .fit → отчёт по сессии / тренды нагрузки / черновик плана + Excel")

with st.sidebar:
    st.header("⚙️ Параметры анализа")
    hr_rest = st.number_input("Пульс в покое (HRrest)", min_value=30, max_value=100, value=60, step=1)
    hr_max  = st.number_input("Макс. пульс (HRmax)", min_value=140, max_value=220, value=190, step=1)
    zone_bounds = st.text_input("Границы зон HR (уд/мин, через запятую)", value="120,140,155,170,185")
    st.caption("Пример: 120,140,155,170,185 → получится Z1…Z5")

uploaded = st.file_uploader("Загрузите FIT-файл(ы)", type=["fit"], accept_multiple_files=True)

# ---------------- Helpers ----------------
def get_val(msg, name, alt_name=None):
    v = msg.get_value(name)
    if (v is None) and alt_name:
        v = msg.get_value(alt_name)
    return v

def pace_from_speed(spd):
    if spd is None or spd <= 0: return None
    sec_per_km = 1000.0 / spd
    m = int(sec_per_km // 60); s = int(round(sec_per_km % 60))
    return f"{m}:{s:02d}"

def speed_to_pace_min_per_km(spd):
    if spd is None or spd <= 0: return np.nan
    return (1000.0 / spd) / 60.0

def parse_bounds(text):
    try:
        b = [int(x.strip()) for x in text.split(",") if x.strip()]
        b = [v for v in b if 30 <= v <= 240]
        b.sort()
        return b
    except Exception:
        return []

def compute_trimp_timeweighted(hr, dt, hr_rest, hr_max):
    """TRIMP ≈ суммируем относительную интенсивность по времени (в минутах)."""
    if hr is None or dt is None or hr.isna().all() or dt.isna().all(): return None
    rel = (hr - hr_rest) / max(1, (hr_max - hr_rest))
    rel = rel.clip(lower=0)
    minutes = dt.fillna(0) / 60.0
    val = float((rel * minutes).sum() * 100.0)
    return val if val > 0 else None

def efficiency_factor(speed, hr):
    if speed is None or hr is None: return None
    valid = speed.notna() & hr.notna() & (hr > 0)
    if not valid.any(): return None
    return float(speed[valid].mean() / hr[valid].mean())

def decoupling(speed, hr):
    valid = speed.notna() & hr.notna() & (hr > 0)
    idx = np.where(valid)[0]
    if len(idx) < 40: return None
    half = len(idx) // 2
    first = idx[:half]; second = idx[half:]
    if len(first) < 20 or len(second) < 20: return None
    ef1 = speed.iloc[first].mean() / hr.iloc[first].mean()
    ef2 = speed.iloc[second].mean() / hr.iloc[second].mean()
    if ef1 <= 0: return None
    return float((ef2/ef1 - 1.0) * 100.0)

def zones_time(series, bounds):
    if series is None or series.isna().all() or not bounds: return None
    bins = [-np.inf] + bounds + [np.inf]
    z = pd.cut(series, bins=bins, labels=[f"Z{i}" for i in range(1, len(bins))])
    return z.value_counts().sort_index()

def to_excel(dfs_named: dict):
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter", datetime_format="yyyy-mm-dd hh:mm:ss") as writer:
        for name, df in dfs_named.items():
            df.to_excel(writer, sheet_name=name, index=False)
            ws = writer.sheets[name]
            if not df.empty:
                ws.autofilter(0, 0, len(df), max(0, len(df.columns)-1))
            ws.freeze_panes(1, 0)
            for i, col in enumerate(df.columns):
                maxlen = min(60, max(len(str(col)), *(len(str(x)) for x in df[col].head(200).fillna("").astype(str))))
                ws.set_column(i, i, max(9, maxlen + 1))
    bio.seek(0)
    return bio

# ---------------- Parsing for one file ----------------
def parse_fit_file(uploaded_file):
    fit = FitFile(uploaded_file)

    # Records
    rec_rows = []
    for m in fit.get_messages("record"):
        rec_rows.append({
            "timestamp": get_val(m, "timestamp"),
            "hr":        get_val(m, "heart_rate"),
            "speed":     get_val(m, "speed", "enhanced_speed"),      # m/s
            "cadence":   get_val(m, "cadence"),
            "power":     get_val(m, "power"),
            "elev":      get_val(m, "altitude", "enhanced_altitude"),
            "dist":      get_val(m, "distance"),                     # meters (cumulative)
        })
    df_rec = pd.DataFrame(rec_rows)
    if not df_rec.empty:
        df_rec["timestamp"] = pd.to_datetime(df_rec["timestamp"], errors="coerce")
        df_rec = df_rec.sort_values("timestamp").reset_index(drop=True)
        if df_rec["timestamp"].notna().any():
            t0 = df_rec["timestamp"].min()
            df_rec["t_rel_s"] = (df_rec["timestamp"] - t0).dt.total_seconds()
        else:
            df_rec["t_rel_s"] = np.arange(len(df_rec))
        df_rec["dt_s"] = df_rec["t_rel_s"].diff().fillna(0).clip(lower=0)  # неотрицательные шаги
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

    # time
    if not df_ses.empty and pd.notna(df_ses.iloc[0].get("total_timer_time_s")):
        time_min = df_ses.iloc[0]["total_timer_time_s"] / 60.0
    elif not df_rec.empty and df_rec["t_rel_s"].notna().any():
        time_min = (df_rec["t_rel_s"].max() - df_rec["t_rel_s"].min()) / 60.0
    else:
        time_min = None

    # avg hr
    avg_hr = None
    if not df_ses.empty and pd.notna(df_ses.iloc[0].get("avg_hr")):
        avg_hr = float(df_ses.iloc[0]["avg_hr"])
    elif not df_rec.empty and df_rec["hr"].notna().any():
        avg_hr = float(df_rec["hr"].mean())

    # TRIMP (взвешенный по времени)
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
        "date": start_time.date() if start_time else None,  # будет нормализовано позже
        "sport": (df_ses.iloc[0]["sport"] if not df_ses.empty else None),
        "distance_km": round(distance_km, 2) if distance_km else None,
        "time_min": round(time_min, 1) if time_min else None,
        "avg_hr": round(avg_hr) if avg_hr else None,
        "TRIMP": round(trimp) if trimp else None,
        "EF": round(ef, 4) if ef else None,
        "Pa:Hr_%": round(de, 1) if de is not None else None,
    }

    return df_rec, df_laps, df_ses, summary

# ---------------- Main logic ----------------
if not uploaded:
    st.info("Загрузи один или несколько .fit файлов, чтобы увидеть отчёт/прогресс.")
else:
    # Один файл → детальный отчёт
    if len(uploaded) == 1:
        file = uploaded[0]
        df_rec, df_laps, df_ses, summary = parse_fit_file(file)

        bounds = parse_bounds(zone_bounds)
        zt = zones_time(df_rec["hr"], bounds) if (not df_rec.empty and bounds) else None

        # Summary metrics
        c1,c2,c3 = st.columns(3)
        with c1: st.metric("Дистанция", f"{summary['distance_km']:.2f} км" if summary["distance_km"] else "—")
        with c2: st.metric("Время", f"{summary['time_min']:.1f} мин" if summary["time_min"] else "—")
        with c3: st.metric("TRIMP (≈)", f"{summary['TRIMP']}" if summary["TRIMP"] else "—")

        c4,c5,c6 = st.columns(3)
        with c4: st.metric("EF (скорость/HR)", f"{summary['EF']}" if summary["EF"] else "—")
        with c5: st.metric("Decoupling Pa:Hr", f"{summary['Pa:Hr_%']}%" if summary["Pa:Hr_%"] is not None else "—")
        with c6: st.metric("Средний HR", f"{summary['avg_hr']}" if summary["avg_hr"] else "—")

        st.divider()

        # Charts
        if not df_rec.empty:
            left, right = st.columns(2)
            with left:
                st.subheader("Пульс и темп")
                base = pd.DataFrame({
                    "t_min": df_rec["t_rel_s"] / 60.0,
                    "HR": df_rec["hr"],
                    "Pace (мин/км)": pd.to_numeric(df_rec["speed"].apply(speed_to_pace_min_per_km), errors="coerce")
                })
                st.altair_chart(alt.Chart(base).mark_line().encode(x="t_min:Q", y="HR:Q").interactive(), use_container_width=True)
                st.altair_chart(alt.Chart(base).mark_line().encode(x="t_min:Q", y=alt.Y("Pace (мин/км):Q", sort="descending")).interactive(), use_container_width=True)
            with right:
                st.subheader("Каденс и высота")
                base2 = pd.DataFrame({
                    "t_min": df_rec["t_rel_s"] / 60.0,
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

        # Download
        xls = to_excel({
            "Summary": pd.DataFrame([summary]),
            "Sessions": df_ses,
            "Laps": df_laps,
            "Records": df_rec
        })
        st.download_button("⬇️ Скачать Excel", data=xls,
                           file_name="fit_report.xlsx",
                           mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    # Несколько файлов → дашборд прогресса
    else:
        st.subheader("📈 Прогресс: сводка по тренировкам")
        summaries = []
        for f in uploaded:
            df_rec, df_laps, df_ses, summary = parse_fit_file(f)
            summaries.append(summary)

        df_sum = pd.DataFrame(summaries).dropna(subset=["date"]).sort_values("start_time").reset_index(drop=True)

        # --- FIX: приводим тип ключа к datetime64[ns] (полночь) ---
        if not df_sum.empty:
            df_sum["date"] = pd.to_datetime(df_sum["date"]).dt.normalize()

        st.dataframe(df_sum)

        # ---- Ежедневная нагрузка и ATL/CTL/TSB ----
        st.subheader("Нагрузка (TRIMP) по дням и тренды ATL/CTL/TSB")

        if df_sum.empty:
            st.info("Недостаточно данных с датами для построения трендов.")
            st.stop()

        daily = df_sum.groupby("date").agg(
            TRIMP=("TRIMP", "sum"),
            distance_km=("distance_km", "sum")
        ).reset_index()

        # последовательные дни на интервале min..max по df_sum
        full = pd.DataFrame({
            "date": pd.date_range(df_sum["date"].min(), df_sum["date"].max(), freq="D")
        })
        daily = full.merge(daily, on="date", how="left").fillna({"TRIMP": 0.0, "distance_km": 0.0})

        # EWMA вручную (ежедневный шаг)
        def ewma(load, tau_days):
            alpha = 1 - exp(-1.0 / tau_days)
            out = []
            prev = 0.0
            for v in load:
                prev = prev + alpha * (v - prev)
                out.append(prev)
            return np.array(out)

        daily["ATL"] = ewma(daily["TRIMP"].values, tau_days=7)
        daily["CTL"] = ewma(daily["TRIMP"].values, tau_days=42)
        daily["TSB"] = daily["CTL"] - daily["ATL"]

        # график
        base = daily.melt(id_vars="date", value_vars=["TRIMP","ATL","CTL","TSB"], var_name="metric", value_name="value")
        chart = alt.Chart(base).mark_line().encode(
            x="date:T",
            y="value:Q",
            color="metric:N"
        ).interactive()
        st.altair_chart(chart, use_container_width=True)

        # quick KPIs за последнюю неделю
        last7 = daily.tail(7)
        c1,c2,c3,c4 = st.columns(4)
        with c1: st.metric("TRIMP 7д", f"{last7['TRIMP'].sum():.0f}")
        with c2: st.metric("DIST 7д", f"{last7['distance_km'].sum():.1f} км")
        with c3: st.metric("ATL (сегодня)", f"{daily['ATL'].iloc[-1]:.0f}")
        with c4: st.metric("TSB (сегодня)", f"{daily['TSB'].iloc[-1]:.0f}")

        # ---- Черновик плана на 7 дней ----
        st.subheader("📝 Черновик плана на следующую неделю")
        last_week_km = float(last7["distance_km"].sum())
        tsb = float(daily["TSB"].iloc[-1])

        # логика рекомендации объёма
        if tsb < -10:
            target_km = max(0.0, last_week_km * 0.9)  # лёгкий дилоад
            note = "TSB низкий → снизим объём (~-10%) для восстановления."
        elif tsb > 10:
            target_km = last_week_km * 1.10  # небольшой рост
            note = "TSB высокий → можно аккуратно поднять объём (~+10%)."
        else:
            target_km = last_week_km * 1.05  # поддержание/слегка вверх
            note = "TSB в норме → поддержим/слightly увеличим (~+5%)."

        # распределение объёма (км) по дням (примерная схема)
        dist_split = np.array([0.12,0.16,0.10,0.18,0.08,0.26,0.10])  # Пн..Вс
        day_names = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]
        km_plan = (dist_split * target_km).round(1)

        # типы сессий
        types = ["Easy Z1–Z2", "Tempo Z3 (20–30 мин)", "Easy Z1–Z2",
                 "Intervals Z4 (6×3’/2’)", "Recovery 30–40’ Z1", "Long Z2", "Easy + strides"]

        plan_df = pd.DataFrame({
            "День": day_names,
            "Тип": types,
            "Пробежка (км)": km_plan
        })

        st.write(note)
        st.dataframe(plan_df)

        st.write(note)
st.dataframe(plan_df)


# ---- Черновик плана на 7 дней ----
st.subheader("📝 Черновик плана на следующую неделю")

plan_df = pd.DataFrame()   # <-- гарантируем, что переменная существует
note = None

# готовим метрики за последнюю неделю
last7 = daily.tail(7) if not daily.empty else pd.DataFrame()

if not daily.empty and not last7.empty:
    last_week_km = float(last7["distance_km"].sum())
    tsb = float(daily["TSB"].iloc[-1])

    # логика рекомендации объёма
    if tsb < -10:
        target_km = max(0.0, last_week_km * 0.9)   # лёгкий дилоад
        note = "TSB низкий → снизим объём (~-10%) для восстановления."
    elif tsb > 10:
        target_km = last_week_km * 1.10            # небольшой рост
        note = "TSB высокий → можно аккуратно поднять объём (~+10%)."
    else:
        target_km = last_week_km * 1.05            # поддержание/слегка вверх
        note = "TSB в норме → поддержим/слегка увеличим (~+5%)."

    # распределение объёма (км) по дням (примерная схема)
    dist_split = np.array([0.12,0.16,0.10,0.18,0.08,0.26,0.10])  # Пн..Вс
    day_names = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]
    km_plan = (dist_split * target_km).round(1)

    # типы сессий
    types = ["Easy Z1–Z2", "Tempo Z3 (20–30 мин)", "Easy Z1–Z2",
             "Intervals Z4 (6×3’/2’)", "Recovery 30–40’ Z1", "Long Z2", "Easy + strides"]

    plan_df = pd.DataFrame({
        "День": day_names,
        "Тип": types,
        "Пробежка (км)": km_plan
    })

    if note:
        st.write(note)
    st.dataframe(plan_df)
else:
    st.info("Недостаточно данных для составления плана (нужно ≥1 день с данными).")

# === NEW: Экспорт плана в календарь (ICS) ===
import datetime as dt  # можно перенести в самый верх файла

with st.expander("📆 Экспорт плана в календарь (.ics)"):
    if plan_df.empty:
        st.warning("План пуст — сначала сформируй его выше.")
    else:
        # настройки экспорта
        today = dt.date.today()
        next_monday = today + dt.timedelta(days=(7 - today.weekday())) if today.weekday() != 0 else today

        start_date = st.date_input("Дата начала плана", value=next_monday, help="С какого понедельника начинаем расписание")
        workout_time = st.time_input("Время тренировки", value=dt.time(7, 0))
        selected_days = st.multiselect(
            "Какие дни добавить",
            options=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],
            default=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]
        )
        duration_minutes = st.number_input("Длительность события в календаре (мин)", min_value=15, max_value=240, value=60, step=5)

        # маппинг дней
        day_to_idx = {"Пн":0,"Вт":1,"Ср":2,"Чт":3,"Пт":4,"Сб":5,"Вс":6}

        def dtstamp():
            return dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

        def fmt_dt(d: dt.date, t: dt.time):
            return dt.datetime.combine(d, t).strftime("%Y%m%dT%H%M%S")

        def build_ics(plan_df, start_date, workout_time, selected_days, duration_minutes):
            lines = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//CapyRun//Weekly Plan//EN"
            ]
            for _, row in plan_df.iterrows():
                day = str(row["День"])
                if day not in selected_days:
                    continue
                idx = day_to_idx.get(day, 0)
                d = start_date + dt.timedelta(days=idx)
                start = fmt_dt(d, workout_time)
                end_dt = (dt.datetime.combine(d, workout_time) + dt.timedelta(minutes=int(duration_minutes)))
                end = end_dt.strftime("%Y%m%dT%H%M%S")

                title = f'{row["Тип"]} — {row["Пробежка (км)"]} км'
                desc = f'CapyRun: {row["Тип"]}. Плановый объём: {row["Пробежка (км)"]} км.'

                uid = f"{start}-{hash(title) & 0xffffffff}@capyrun"
                lines += [
                    "BEGIN:VEVENT",
                    f"UID:{uid}",
                    f"DTSTAMP:{dtstamp()}",
                    f"DTSTART:{start}",
                    f"DTEND:{end}",
                    f"SUMMARY:{title}",
                    f"DESCRIPTION:{desc}",
                    "END:VEVENT"
                ]
            lines.append("END:VCALENDAR")
            return "\n".join(lines)

        ics_text = build_ics(plan_df, start_date, workout_time, selected_days, duration_minutes)
        st.download_button(
            "📥 Скачать iCal (.ics)",
            data=ics_text,
            file_name="capyrun_plan.ics",
            mime="text/calendar"
        )



# ---- Выгрузка Excel: Progress + Plan ----
xls = to_excel({
    "Workouts": df_sum,
    "DailyLoad": daily,
    "NextWeekPlan": plan_df
})
st.download_button("⬇️ Скачать Excel (прогресс + план)", data=xls,
                   file_name="capyrun_progress.xlsx",
                   mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
