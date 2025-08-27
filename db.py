# capyrun/db.py
import pandas as pd

def save_workouts(supabase, user_id: str, summaries: list):
    rows = []
    for s in summaries or []:
        if not s: 
            continue
        time_s = None
        if s.get("time_s") is not None:
            time_s = int(s["time_s"])
        elif s.get("time_min") is not None:
            time_s = int(round(float(s["time_min"]) * 60))

        rows.append({
            "user_id": user_id,
            "start_time": s.get("start_time"),
            "date": s.get("date"),
            "sport": s.get("sport"),
            "distance_km": s.get("distance_km"),
            "time_s": time_s,
            "avg_hr": s.get("avg_hr"),
            "trimp": s.get("TRIMP"),
            "ef": s.get("EF"),
            "decoupling": s.get("Pa:Hr_%"),
            "raw_summary": s,
        })
    if rows:
        supabase.table("workouts").insert(rows).execute()

def fetch_workouts(supabase, user_id: str, limit: int = 100) -> pd.DataFrame:
    q = supabase.table("workouts").select(
        "start_time,date,sport,distance_km,time_s,avg_hr,trimp,ef,decoupling"
    ).eq("user_id", user_id).order("start_time", desc=True).limit(limit).execute()
    import pandas as pd
    return pd.DataFrame(q.data or [])
