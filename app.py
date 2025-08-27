import io
import math
from datetime import datetime

import altair as alt
import numpy as np
import pandas as pd
import streamlit as st
from fitparse import FitFile

# ---------- UI ----------
st.set_page_config(page_title="CapyRun Quick Report", page_icon="🏃", layout="wide")
st.title("🏃 CapyRun — Quick FIT Report")
st.caption("Загрузи .fit → получи сводку, графики и Excel")

with st.sidebar:
    st.header("⚙️ Параметры анализа")
    hr_rest = st.number_input("Пульс в покое (HRrest)", min_value=30, max_value=100, value=60, step=1)
    hr_max  = st.number_input("Макс. пульс (HRmax)", min_value=140, max_value=220, value=190, step=1)
    zone_bounds = st.text_input(
        "Границы зон HR (уд/мин, через запятую)",
        value="120,140,155,170,185"
    )
    st.caption("Пример: 120,140,155,170,185 → получится Z1…Z5")

uploaded = st.file_uploader("Загрузите FIT-файл", type=["fit"], accept_multiple_files=False)

# ---------- helpers ----------
def semicircles_to_degrees(x):
    if x is None or (isinstance(x, float) and math.isnan(x)): return None
    return float(x) * (180.0 / (2**31))

def get_val(msg, name, alt_name=None):
    v = msg.get_value(name)
    if (v is None) and alt_name:
        v = msg.get_value(alt_name)
    return v

def pace_from_speed(spd):
    if spd is None or spd <= 0: return None
    sec_per_km = 1000.0 / spd
    m = int(sec_per_km // 60)
    s = int(round(sec_per_km % 60))
    return f"{m}:{s:02d}"

def compute_trimp(hr_series, hr_rest, hr_max):
    # Bannister TRIMP (унисекс-упрощение): суммируем по минутам
    if hr_series.isna().all(): return None
    rel = (hr_series - hr_rest) / max(1, (hr_max - hr_rest))
    rel = rel.clip(lower=0)
    # аппроксимация под минутные шаги — интерполяция по времени:
    # тут шаг по времени не ровный → считаем по dt
    return rel.mean() * (len(hr_series) / 60.0) * 100  # простая нормировка «в попугаях»

def zones_time(series, bounds):
    # bounds: [b1,b2,b3,b4,b5] → зоны: (-inf,b1], (b1,b2], ..., (b5,inf)
    if series is None or series.isna().all(): 
        return None
    bins = [-np.inf] + bounds + [np.inf]
    z = pd.cut(series, bins=bins, labels=[f"Z{i}" for i in range(1, len(bins))])
    return z.value_counts().sort_index()

def efficiency_factor(speed, hr):
    if speed.isna().all() or hr.isna().all(): return None
    valid = speed.notna() & hr.notna() & (hr > 0)
    if not valid.any(): return None
    return (speed[valid].mean() / hr[valid].mean())

def decoupling(speed, hr):
    # Pa:Hr — изменение EF между половинами тренировки
    valid = speed.notna() & hr.notna() & (hr > 0)
    if valid.sum() < 20: return None
    idx = np.where(valid)[0]
    half = len(idx) // 2
    first = idx[:half]; second = idx[half:]
    if len(first) < 10 or len(second) < 10: return None
    ef1 = speed.iloc[first].mean() / hr.iloc[first].mean()
    ef2 = speed.iloc[second].mean() / hr.iloc[second].mean()
    if ef1 <= 0: return None
    return (ef2/ef1 - 1.0) * 100.0

def to_excel(dfs_named: dict):
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter", datetime_format="yyyy-mm-dd hh:mm:ss") as writer:
        for name, df in dfs_named.items():
            df.to_excel(writer, sheet_name=name, index=False)
            ws = writer.sheets[name]
            if not df.empty:
                ws.autofilter(0, 0, len(df), max(0, len(df.columns)-1))
            ws.freeze_panes(1, 0)
            # узкая автоширина
            for i, col in enumerate(df.columns):
                maxlen = min(60, max(len(str(col)), *(len(str(x)) for x in df[col].head(200).fillna("").astype(str))))
                ws.set_column(i, i, max(9, maxlen + 1))
    bio.seek(0)
    return bio

# ---------- parsing ----------
if uploaded:
    fit = FitFile(uploaded)

    # Records
    rec_rows = []
    for m in fit.get_messages("record"):
        rec_rows.append({
            "timestamp": get_val(m, "timestamp"),
            "hr":        get_val(m, "heart_rate"),
            "speed":     get_val(m, "speed", "enhanced_speed"),        # m/s
            "cadence":   get_val(m, "cadence"),
            "power":     get_val(m, "power"),
            "elev":      get_val(m, "altitude", "enhanced_altitude"),
            "dist":      get_val(m, "distance"),                        # meters, cumulative
            # координаты не сохраняем
        })
    df_rec = pd.DataFrame(rec_rows)
    if not df_rec.empty:
        df_rec["timestamp"] = pd.to_datetime(df_rec["timestamp"], errors="coerce")
        df_rec = df_rec.sort_values("timestamp").reset_index(drop=True)
        # относительное время
        if df_rec["timestamp"].notna().any():
            t0 = df_rec["timestamp"].min()
            df_rec["t_rel_s"] = (df_rec["timestamp"] - t0).dt.total_seconds()
        else:
            df_rec["t_rel_s"] = np.arange(len(df_rec))
        # темп строкой:
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

    # Sessions (берём первую)
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

    # ---------- metrics ----------
    bounds = []
    try:
        bounds = [int(x.strip()) for x in zone_bounds.split(",") if x.strip()]
        bounds = [b for b in bounds if 30 <= b <= 240]
        bounds.sort()
    except Exception:
        pass

    if not df_rec.empty:
        trimp = compute_trimp(df_rec["hr"], hr_rest, hr_max)
        ef = efficiency_factor(df_rec["speed"], df_rec["hr"])
        de = decoupling(df_rec["speed"], df_rec["hr"])
        zt = zones_time(df_rec["hr"], bounds) if bounds else None
    else:
        trimp = ef = de = None
        zt = None

    # ---------- layout ----------
    col1, col2, col3 = st.columns(3)
    with col1:
        dist_km = None
        if not df_ses.empty and pd.notna(df_ses.iloc[0].get("total_distance_m")):
            dist_km = df_ses.iloc[0]["total_distance_m"] / 1000.0
        elif not df_rec.empty and df_rec["dist"].notna().any():
            dist_km = df_rec["dist"].max() / 1000.0
        st.metric("Дистанция", f"{dist_km:.2f} км" if dist_km else "—")
    with col2:
        if not df_ses.empty and pd.notna(df_ses.iloc[0].get("total_timer_time_s")):
            mins = df_ses.iloc[0]["total_timer_time_s"] / 60.0
        elif not df_rec.empty and df_rec["t_rel_s"].notna().any():
            mins = (df_rec["t_rel_s"].max() - df_rec["t_rel_s"].min()) / 60.0
        else:
            mins = None
        st.metric("Время", f"{mins:.1f} мин" if mins else "—")
    with col3:
        st.metric("TRIMP (≈)", f"{trimp:.0f}" if trimp else "—")

    col4, col5, col6 = st.columns(3)
    with col4:
        st.metric("EF (скорость/HR)", f"{ef:.4f}" if ef else "—")
    with col5:
        st.metric("Decoupling Pa:Hr", f"{de:.1f}%" if de is not None else "—")
    with col6:
        if not df_ses.empty and pd.notna(df_ses.iloc[0].get("avg_hr")):
            st.metric("Средний HR", int(df_ses.iloc[0]["avg_hr"]))
        else:
            st.metric("Средний HR", "—")

    st.divider()

    # ---------- charts ----------
    if not df_rec.empty:
        left, right = st.columns(2)
        with left:
            st.subheader("Пульс и темп")
            base = pd.DataFrame({
                "t_min": df_rec["t_rel_s"] / 60.0,
                "HR": df_rec["hr"],
                "Pace (мин/км)": pd.to_numeric(
                    df_rec["speed"].apply(lambda s: 1000/s if (s and s>0) else np.nan),
                    errors="coerce"
                )/60.0
            })
            hr_line = alt.Chart(base).mark_line().encode(x="t_min:Q", y="HR:Q")
            pace_line = alt.Chart(base).mark_line().encode(x="t_min:Q", y=alt.Y("Pace (мин/км):Q", sort="descending"))
            st.altair_chart((hr_line).interactive().resolve_scale(y='independent'), use_container_width=True)
            st.altair_chart((pace_line).interactive().resolve_scale(y='independent'), use_container_width=True)

        with right:
            st.subheader("Каденс и высота")
            base2 = pd.DataFrame({
                "t_min": df_rec["t_rel_s"] / 60.0,
                "Cadence (spm)": df_rec["cadence"],
                "Elevation (m)": df_rec["elev"],
            })
            cad_line = alt.Chart(base2).mark_line().encode(x="t_min:Q", y="Cadence (spm):Q")
            elev_line = alt.Chart(base2).mark_line().encode(x="t_min:Q", y="Elevation (m):Q")
            st.altair_chart(cad_line.interactive(), use_container_width=True)
            st.altair_chart(elev_line.interactive(), use_container_width=True)

    # ---------- zones ----------
    st.subheader("Зоны пульса")
    if zt is not None:
        df_z = zt.rename_axis("Zone").reset_index(name="seconds")
        total = df_z["seconds"].sum()
        df_z["%"] = (df_z["seconds"] / total * 100).round(1)
        st.dataframe(df_z)
    else:
        st.write("Нет данных HR или не заданы границы зон.")

    # ---------- tables ----------
    st.subheader("Сессия")
    st.dataframe(df_ses if not df_ses.empty else pd.DataFrame(columns=["—"]))

    st.subheader("Круги (laps)")
    st.dataframe(df_laps if not df_laps.empty else pd.DataFrame(columns=["—"]))

    st.subheader("Точки (records) — без GPS")
    st.dataframe(df_rec.head(500) if not df_rec.empty else pd.DataFrame(columns=["—"]))
    if not df_rec.empty and len(df_rec) > 500:
        st.caption(f"Показаны первые 500 строк из {len(df_rec)}.")

    # ---------- download ----------
    xls = to_excel({
        "Summary": pd.DataFrame([{
            "distance_km": (dist_km if dist_km else None),
            "time_min": (mins if mins else None),
            "TRIMP": (round(trimp) if trimp else None),
            "EF": (float(ef) if ef else None),
            "Pa:Hr_%": (float(de) if de is not None else None),
            "hr_rest": hr_rest, "hr_max": hr_max
        }]),
        "Sessions": df_ses,
        "Laps": df_laps,
        "Records": df_rec,
    })
    st.download_button("⬇️ Скачать Excel", data=xls, file_name="fit_report.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

else:
    st.info("Загрузи .fit файл слева, чтобы увидеть отчёт.")
