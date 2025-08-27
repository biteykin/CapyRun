# views_single.py
import pandas as pd
import altair as alt
import streamlit as st
from parsing import parse_fit_file
from db import save_workouts
from utils import (
    speed_to_pace_min_per_km,
    parse_bounds,
    zones_time,
    to_excel,
)

def render_single_workout(file, supabase, user_id, hr_rest: int, hr_max: int, zone_bounds_text: str):
    df_rec, df_laps, df_ses, summary = parse_fit_file(file, hr_rest, hr_max)

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
        save_workouts(supabase, user_id, [summary])
        st.success("Сохранено в БД")
