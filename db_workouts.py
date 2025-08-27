# db_workouts.py
from __future__ import annotations
from typing import Tuple, Optional, List, Dict, Any
from datetime import datetime

def _extract_response(resp) -> Tuple[Optional[dict], Optional[str]]:
    # Fast path for dicts
    if isinstance(resp, dict):
        data = resp.get("data")
        err = resp.get("error")
    else:
        data = getattr(resp, "data", None)
        err = getattr(resp, "error", None)
    if err and isinstance(err, dict):
        err = err.get("message") or str(err)
    return data, (str(err) if err else None)

def save_workout(
    supabase,
    *,
    user_id: str,
    filename: str,
    size_bytes: int,
    parsed: dict | None = None,
) -> Tuple[bool, Optional[str], Optional[dict]]:
    parsed = parsed or {}
    payload = {
        "user_id": user_id,
        "filename": filename,
        "size_bytes": size_bytes,
        "sport": parsed.get("sport"),
        "duration_sec": parsed.get("duration_sec"),
        "distance_m": parsed.get("distance_m"),
        "moving_time_sec": parsed.get("moving_time_sec"),
        "fit_summary": parsed,
        "uploaded_at": datetime.utcnow().isoformat(),
    }
    try:
        resp = (
            supabase.table("workouts")
            .insert(payload)
            .select("id, filename, sport, duration_sec, distance_m, uploaded_at")
            .single()
            .execute()
        )
        data, err = _extract_response(resp)
        if err or not data:
            return False, err or "Вставка не вернула строку (возможны RLS-политики).", None
        return True, None, data
    except Exception as e:
        return False, str(e), None

def list_workouts(
    supabase,
    *,
    user_id: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    try:
        resp = (
            supabase.table("workouts")
            .select("id, uploaded_at, filename, sport, duration_sec, distance_m")
            .eq("user_id", user_id)
            .order("uploaded_at", desc=True)
            .limit(limit)
            .execute()
        )
        data, err = _extract_response(resp)
        if err or not data:
            return []
        return data
    except Exception:
        return []