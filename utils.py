# utils.py — общие хелперы для CapyRun

import io
import numpy as np
import pandas as pd
import datetime as dt
from math import exp

# ------------ Generic helpers ------------
def get_val(msg, name, alt_name=None):
    v = msg.get_value(name)
    if (v is None) and alt_name:
        v = msg.get_value(alt_name)
    return v

def pace_from_speed(spd):
    """Вернуть темп 'М:СС' из скорости м/с. None если скорость невалидна."""
    if spd is None:
        return None
    try:
        spd = float(spd)
    except (TypeError, ValueError):
        return None
    if spd <= 0:
        return None
    sec_per_km = 1000.0 / spd
    m = int(sec_per_km // 60)
    s = int(round(sec_per_km % 60))
    return f"{m}:{s:02d}"

def speed_to_pace_min_per_km(spd):
    """Вернуть темп в мин/км (float) из скорости м/с. np.nan если скорость невалидна."""
    if spd is None:
        return np.nan
    try:
        spd = float(spd)
    except (TypeError, ValueError):
        return np.nan
    if spd <= 0:
        return np.nan
    return (1000.0 / spd) / 60.0

def format_duration(seconds):
    """Из секунд → 'Ч:ММ:СС' (или 'М:СС' если <1 ч)."""
    if seconds is None:
        return None
    try:
        seconds = int(round(float(seconds)))
    except (TypeError, ValueError):
        return None
    if seconds < 0:
        return None
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m}:{s:02d}"

def parse_bounds(text):
    try:
        b = [int(x.strip()) for x in text.split(",") if x.strip()]
        b = [v for v in b if 30 <= v <= 240]
        b.sort()
        return b
    except Exception:
        return []

def compute_trimp_timeweighted(hr, dt_seconds, hr_rest, hr_max):
    """TRIMP ≈ сумма относительной интенсивности по времени (минуты)."""
    if hr is None or dt_seconds is None:
        return None
    hr = pd.Series(hr)
    dt_seconds = pd.Series(dt_seconds)
    if hr.isna().all() or dt_seconds.isna().all():
        return None
    rel = (hr - hr_rest) / max(1, (hr_max - hr_rest))
    rel = rel.clip(lower=0)
    minutes = dt_seconds.fillna(0) / 60.0
    val = float((rel * minutes).sum() * 100.0)
    return val if val > 0 else None

def efficiency_factor(speed, hr):
    if speed is None or hr is None:
        return None
    speed = pd.Series(speed)
    hr = pd.Series(hr)
    valid = speed.notna() & hr.notna() & (hr > 0)
    if not valid.any():
        return None
    return float(speed[valid].mean() / hr[valid].mean())

def decoupling(speed, hr):
    speed = pd.Series(speed)
    hr = pd.Series(hr)
    valid = speed.notna() & hr.notna() & (hr > 0)
    idx = np.where(valid)[0]
    if len(idx) < 40:
        return None
    half = len(idx) // 2
    first = idx[:half]
    second = idx[half:]
    if len(first) < 20 or len(second) < 20:
        return None
    ef1 = speed.iloc[first].mean() / hr.iloc[first].mean()
    ef2 = speed.iloc[second].mean() / hr.iloc[second].mean()
    if ef1 <= 0:
        return None
    return float((ef2 / ef1 - 1.0) * 100.0)

def zones_time(series, bounds):
    if series is None or not bounds:
        return None
    series = pd.Series(series)
    if series.isna().all():
        return None
    bins = [-np.inf] + bounds + [np.inf]
    z = pd.cut(series, bins=bins, labels=[f"Z{i}" for i in range(1, len(bins))])
    return z.value_counts().sort_index()

def to_excel(dfs_named: dict):
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="xlsxwriter", datetime_format="yyyy-mm-dd hh:mm:ss") as writer:
        for name, df in dfs_named.items():
            if not isinstance(df, pd.DataFrame):
                df = pd.DataFrame(df)
            df.to_excel(writer, sheet_name=name, index=False)
            ws = writer.sheets[name]
            if not df.empty:
                ws.autofilter(0, 0, len(df), max(0, len(df.columns) - 1))
            ws.freeze_panes(1, 0)
            for i, col in enumerate(df.columns):
                sample = df[col].head(200).fillna("").astype(str).tolist() if not df.empty else []
                maxlen = min(60, max(len(str(col)), *(len(s) for s in sample)) if sample else len(str(col)))
                ws.set_column(i, i, max(9, maxlen + 1))
    bio.seek(0)
    return bio

def ewma_daily(load, tau_days):
    alpha = 1 - exp(-1.0 / tau_days)
    out = []
    prev = 0.0
    for v in load:
        prev = prev + alpha * (v - prev)
        out.append(prev)
    return np.array(out)

# ------------ ICS builder ------------
def build_ics(
    plan_df: pd.DataFrame,
    start_date: dt.date,
    workout_time: dt.time,
    selected_days: list,
    duration_minutes: int,
    location: str = "",
    alert_minutes: int = 0,
) -> str:
    day_to_idx = {"Пн":0,"Вт":1,"Ср":2,"Чт":3,"Пт":4,"Сб":5,"Вс":6}

    def dtstamp():
        return dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    def fmt_dt(d: dt.date, t: dt.time):
        return dt.datetime.combine(d, t).strftime("%Y%m%dT%H%M%S")

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

        evt = [
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{dtstamp()}",
            f"DTSTART:{start}",
            f"DTEND:{end}",
            f"SUMMARY:{title}",
            f"DESCRIPTION:{desc}",
        ]
        if location:
            evt.append(f"LOCATION:{location}")

        if alert_minutes and int(alert_minutes) > 0:
            evt += [
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                "DESCRIPTION:Workout reminder",
                f"TRIGGER:-PT{int(alert_minutes)}M",
                "END:VALARM",
            ]

        evt.append("END:VEVENT")
        lines += evt

    lines.append("END:VCALENDAR")
    return "\n".join(lines)

# для лендинга
import streamlit as st
import streamlit.components.v1 as components

def set_auth_mode(mode: str):
    """Сохраняет желаемый режим в сайдбаре: 'login' | 'signup'."""
    if mode in ("login", "signup"):
        st.session_state["auth_mode"] = mode

def open_sidebar():
    """
    Принудительно разворачивает сайдбар, если он свернут.
    Делает несколько попыток, т.к. DOM может рендериться не сразу.
    """
    components.html(
        """
        <script>
        (function() {
          function expandOnce() {
            const doc = window.parent?.document;
            if (!doc) return;
            const btn =
              doc.querySelector('[data-testid="stSidebarCollapseButton"]') ||
              doc.querySelector('[data-testid="baseButton-headerNoPadding"]') ||
              doc.querySelector('[data-testid="stSidebar"] button');
            const sidebar = doc.querySelector('[data-testid="stSidebar"]');
            const aria = btn ? btn.getAttribute('aria-expanded') : null;
            const collapsedAria = aria === 'false';
            const collapsedByWidth = sidebar ? sidebar.offsetWidth < 20 : false;
            if (btn && (collapsedAria || collapsedByWidth)) btn.click();
          }
          for (let i = 0; i < 15; i++) setTimeout(expandOnce, 120 * (i + 1));
        })();
        </script>
        """,
        height=0,
    )
