# parsing.py
import pandas as pd
from fitparse import FitFile
from utils import (
    get_val,
    pace_from_speed,
    format_duration,
    compute_trimp_timeweighted,
    efficiency_factor,
    decoupling,
)

def parse_fit_file(uploaded_file, hr_rest: int, hr_max: int):
    """Возвращает df_rec, df_laps, df_ses, summary."""
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

    # Summary
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
