import io
import math
import numpy as np
import pandas as pd
import altair as alt
import streamlit as st
from fitparse import FitFile

# ---------- UI ----------
st.set_page_config(page_title="CapyRun Quick Report", page_icon="🏃", layout="wide")
st.title("🏃 CapyRun — Quick FIT Report")
st.caption("Загрузи .fit → получи сводку, графики, зоны, compliance и Excel")

with st.sidebar:
    st.header("⚙️ Параметры анализа")
    hr_rest = st.number_input("Пульс в покое (HRrest)", min_value=30, max_value=100, value=60, step=1)
    hr_max  = st.number_input("Макс. пульс (HRmax)", min_value=140, max_value=220, value=190, step=1)
    zone_bounds = st.text_input("Границы зон HR (уд/мин, через запятую)", value="120,140,155,170,185")
    st.caption("Пример: 120,140,155,170,185 → получится Z1…Z5")

uploaded = st.file_uploader("Загрузите FIT-файл", type=["fit"], accept_multiple_files=False)

# ---------- helpers ----------
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

def compute_trimp(hr_series, hr_rest, hr_max):
    if hr_series is None or hr_series.isna().all(): return None
    rel = (hr_series - hr_rest) / max(1, (hr_max - hr_rest))
    rel = rel.clip(lower=0)
    # грубо нормируем к минутам (временной шаг учитываем ниже при compliance)
    return rel.mean() * (len(hr_series) / 60.0) * 100

def zones_time(series, bounds):
    if series is None or series.isna().all(): return None
    bins = [-np.inf] + bounds + [np.inf]
    z = pd.cut(series, bins=bins, labels=[f"Z{i}" for i in range(1, len(bins))])
    return z.value_counts().sort_index()

def efficiency_factor(speed, hr):
    if speed is None or hr is None: return None
    valid = speed.notna() & hr.notna() & (hr > 0)
    if not valid.any(): return None
    return (speed[valid].mean() / hr[valid].mean())

def decoupling(speed, hr):
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
            for i, col in enumerate(df.columns):
                maxlen = min(60, max(len(str(col)), *(len(str(x)) for x in df[col].head(200).fillna("").astype(str))))
                ws.set_column(i, i, max(9, maxlen + 1))
    bio.seek(0)
    return bio

def parse_bounds(text):
    try:
        b = [int(x.strip()) for x in text.split(",") if x.strip()]
        b = [v for v in b if 30 <= v <= 240]
        b.sort()
        return b
    except Exception:
        return []

# ---------- parsing ----------
if uploaded:
    fit = FitFile(uploaded)

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
        df_rec["pace"] = df_rec["speed"].apply(pace_from_speed)
        # dt для более корректной интеграции по времени
        df_rec["dt_s"] = df_rec["t_rel_s"].diff().fillna(0)

    # Laps
    lap_rows = []
    for m in fit.get_messages("lap"):
        lap_rows.append({
            "message_index": get_val(m, "message_index"),
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
            "intensity": get_val(m, "intensity"),
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

    # Workout steps (targets) — если есть в файле
    ws_rows = []
    for m in fit.get_messages("workout_step"):
        ws_rows.append({
            "message_index": get_val(m, "message_index"),
            "duration_type": get_val(m, "duration_type"),
            "duration_value": get_val(m, "duration_value"),
            "target_type": get_val(m, "target_type"),
            # ниж/верх для кастомных целей (встречается у Garmin)
            "custom_target_value_low": get_val(m, "custom_target_value_low"),
            "custom_target_value_high": get_val(m, "custom_target_value_high"),
            "intensity": get_val(m, "intensity"),
        })
    df_steps = pd.DataFrame(ws_rows)

    # ---------- metrics ----------
    bounds = parse_bounds(zone_bounds)
    if not df_rec.empty:
        trimp = compute_trimp(df_rec["hr"], hr_rest, hr_max)
        ef = efficiency_factor(df_rec["speed"], df_rec["hr"])
        de = decoupling(df_rec["speed"], df_rec["hr"])
        zt = zones_time(df_rec["hr"], bounds) if bounds else None
    else:
        trimp = ef = de = None
        zt = None

    # ---------- summary metrics UI ----------
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
                "Pace (мин/км)": pd.to_numeric(df_rec["speed"].apply(speed_to_pace_min_per_km), errors="coerce")
            })
            hr_line = alt.Chart(base).mark_line().encode(x="t_min:Q", y="HR:Q")
            pace_line = alt.Chart(base).mark_line().encode(x="t_min:Q", y=alt.Y("Pace (мин/км):Q", sort="descending"))
            st.altair_chart(hr_line.interactive(), use_container_width=True)
            st.altair_chart(pace_line.interactive(), use_container_width=True)
        with right:
            st.subheader("Каденс и высота")
            base2 = pd.DataFrame({
                "t_min": df_rec["t_rel_s"] / 60.0,
                "Cadence (spm)": df_rec["cadence"],
                "Elevation (m)": df_rec["elev"],
            })
            st.altair_chart(alt.Chart(base2).mark_line().encode(x="t_min:Q", y="Cadence (spm):Q").interactive(), use_container_width=True)
            st.altair_chart(alt.Chart(base2).mark_line().encode(x="t_min:Q", y="Elevation (m):Q").interactive(), use_container_width=True)

    # ---------- zones ----------
    st.subheader("Зоны пульса")
    if zt is not None:
        df_z = zt.rename_axis("Zone").reset_index(name="seconds")
        total = df_z["seconds"].sum()
        df_z["%"] = (df_z["seconds"] / total * 100).round(1)
        st.dataframe(df_z)
    else:
        st.write("Нет данных HR или не заданы границы зон.")

    # ---------- interval compliance ----------
    st.subheader("Interval Compliance")
    def friendly_target_row(t_type, lo, hi):
        if t_type == "heart_rate":
            return f"HR {int(lo)}–{int(hi)} bpm" if (lo and hi) else None
        if t_type == "speed":  # покажем как темп
            def f(x): 
                return pace_from_speed(x) if x and x>0 else "—"
            return f"Pace {f(hi)}–{f(lo)} (мин/км)" if (lo and hi) else None  # внимание: speed↑ => pace↓
        if t_type == "power":
            return f"Power {int(lo)}–{int(hi)} W" if (lo and hi) else None
        return None

    comp_rows = []
    if not df_laps.empty:
        # подготовим границы лап
        lap_bounds = []
        for i, r in df_laps.iterrows():
            start = r["start_time"]
            if i < len(df_laps)-1:
                end = df_laps.loc[i+1, "start_time"]
            else:
                end = df_rec["timestamp"].max() if not df_rec.empty else (start + pd.Timedelta(seconds=r.get("total_timer_time_s") or 0))
            lap_bounds.append((start, end))
        # сопоставим с workout_steps по индексу (простое правило)
        for i, (start, end) in enumerate(lap_bounds):
            step = df_steps.iloc[i] if (not df_steps.empty and i < len(df_steps)) else None
            t_mask = (df_rec["timestamp"] >= start) & (df_rec["timestamp"] < end) if not df_rec.empty else None
            seg = df_rec.loc[t_mask] if (t_mask is not None and t_mask.any()) else pd.DataFrame(columns=df_rec.columns)

            t_type = None; lo = hi = None
            if step is not None and pd.notna(step.get("target_type")):
                t_type = str(step["target_type"])
                lo = step.get("custom_target_value_low")
                hi = step.get("custom_target_value_high")
                # у Garmin для speed это м/с, для HR — bpm, для power — W (обычно)
            # если целей нет — можно оценить «стабильность темпа/HR» как суррогат
            in_target_pct = None
            if t_type in ("heart_rate", "speed", "power") and not seg.empty and lo and hi:
                metric = None
                if t_type == "heart_rate": metric = "hr"
                elif t_type == "speed":    metric = "speed"
                elif t_type == "power":    metric = "power"
                v = seg[metric]
                dt = seg["dt_s"].replace(0, 1.0)  # защита от нулей
                inrange = (v >= lo) & (v <= hi)
                if inrange.any():
                    in_target_pct = round(100.0 * (dt[inrange].sum() / dt.sum()), 1)
            elif not seg.empty:
                # суррогатная «ровность темпа» — чем меньше std(pace), тем лучше (приводим к 0–100)
                pace_min = seg["speed"].apply(speed_to_pace_min_per_km)
                var = float(np.nanstd(pace_min))
                in_target_pct = max(0, 100 - min(100, var * 30)) if not np.isnan(var) else None

            comp_rows.append({
                "lap": i+1,
                "start_time": start,
                "duration_s": round((end-start).total_seconds(), 1) if (pd.notna(start) and pd.notna(end)) else None,
                "target": friendly_target_row(t_type, lo, hi) if t_type else "(нет цели)",
                "avg_pace": pace_from_speed(df_laps.loc[i,"avg_speed_m_s"]) if pd.notna(df_laps.loc[i,"avg_speed_m_s"]) else None,
                "avg_hr": int(df_laps.loc[i,"avg_hr"]) if pd.notna(df_laps.loc[i,"avg_hr"]) else None,
                "compliance_%": in_target_pct
            })
    df_comp = pd.DataFrame(comp_rows)
    if not df_comp.empty:
        st.dataframe(df_comp)
    else:
        st.write("Нет лап или данных для оценки.")

    # ---------- coach notes (rule-based) ----------
    st.subheader("Coach Notes")
    notes = []

    # 1) decoupling
    if de is not None:
        if de >= 8:
            notes.append("Высокий Pa:Hr (≈≥8%). Похоже на утомление/жару/недосон — снизь объём или беги медленнее на следующем Z2.")
        elif de >= 5:
            notes.append("Умеренный Pa:Hr (5–8%). Следи за восстановлением и гидратацией на длительных.")

    # 2) zones balance
    if zt is not None and not zt.empty:
        total_s = zt.sum()
        z1z2 = (zt.iloc[0:2].sum() / total_s) * 100 if len(zt) >= 2 else None
        if z1z2 is not None and z1z2 < 60:
            notes.append("Мало лёгкой работы (Z1–Z2 <60%). Для прогресса добавь спокойных километров.")
        z5p = (zt.iloc[-1] / total_s) * 100 if len(zt) >= 5 else None
        if z5p is not None and z5p > 15:
            notes.append("Много высокоинтенсивной работы (>15% Z5). Дай телу восстановиться 1–2 дня.")

    # 3) easy too hot
    if not df_ses.empty and pd.notna(df_ses.iloc[0].get("avg_hr")):
        thr = hr_rest + 0.7 * (hr_max - hr_rest)  # ориентир границы аэробной
        if df_ses.iloc[0]["avg_hr"] > thr:
            notes.append("Средний HR выше разумной зоны для лёгкой пробежки. Притормози на easy, держи дыхание разговорным.")

    # 4) compliance hint
    if not df_comp.empty and df_comp["compliance_%"].notna().any():
        low = df_comp["compliance_%"].dropna()
        if (low < 70).any():
            notes.append("Есть интервалы с низким попаданием в цель (<70%). Сузь коридор целей или убери внешние раздражители (ветер, подъемы).")

    if notes:
        for n in notes:
            st.write("• " + n)
    else:
        st.write("Отлично! Нарушений ритма и перегруза не видно. Продолжай в том же духе 💪")

    # ---------- details ----------
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
        "Compliance": df_comp
    })
    st.download_button("⬇️ Скачать Excel", data=xls,
        file_name="fit_report.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

else:
    st.info("Загрузи .fit файл слева, чтобы увидеть отчёт.")
