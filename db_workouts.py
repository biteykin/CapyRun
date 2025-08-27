# db_workouts.py
from __future__ import annotations
from typing import Tuple, Optional, List, Dict, Any
from datetime import datetime
import uuid

def _extract_response(resp) -> Tuple[Optional[dict | list], Optional[str]]:
    data = getattr(resp, "data", None)
    err = getattr(resp, "error", None)
    if isinstance(resp, dict):
        data = resp.get("data", data)
        err = resp.get("error", err)
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
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Универсальная вставка, совместимая с разными версиями supabase-py:
    - Пытается insert().select(...).single().execute() (новые клиенты)
    - Если .select() недоступен — insert().execute(), затем добираем строку по заранее сгенерированному id
    """
    try:
        parsed = parsed or {}

        workout_id = str(uuid.uuid4())
        payload = {
            "id": workout_id,
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

        builder = supabase.table("workouts").insert(payload)

        # 1) Новый API
        try:
            resp = builder.select("id, filename, sport, duration_sec, distance_m, uploaded_at").single().execute()
            data, err = _extract_response(resp)
            if err:
                return False, err, None
            if not data:
                resp2 = (
                    supabase.table("workouts")
                    .select("id, filename, sport, duration_sec, distance_m, uploaded_at")
                    .eq("id", workout_id).single().execute()
                )
                data2, err2 = _extract_response(resp2)
                if err2:
                    return False, err2, None
                if not data2:
                    return False, "Вставка не вернула строку (возможны RLS/политики).", None
                return True, None, data2
            return True, None, data

        except AttributeError:
            # 2) Старый клиент — без .select()
            resp = builder.execute()
            data, err = _extract_response(resp)
            if err:
                return False, err, None

            row = None
            if isinstance(data, list) and data:
                row = data[0]
            elif isinstance(data, dict) and data:
                row = data

            if not row or "id" not in row:
                resp2 = (
                    supabase.table("workouts")
                    .select("id, filename, sport, duration_sec, distance_m, uploaded_at")
                    .eq("id", workout_id).single().execute()
                )
                data2, err2 = _extract_response(resp2)
                if err2:
                    return False, err2, None
                if not data2:
                    return False, "Вставка не вернула строку (возможны RLS/политики).", None
                return True, None, data2

            return True, None, {
                "id": row.get("id", workout_id),
                "filename": row.get("filename", filename),
                "sport": row.get("sport"),
                "duration_sec": row.get("duration_sec"),
                "distance_m": row.get("distance_m"),
                "uploaded_at": row.get("uploaded_at"),
            }

    except Exception as e:
        return False, str(e), None

def list_workouts(
    supabase,
    *,
    user_id: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    resp = (
        supabase.table("workouts")
        .select("id, uploaded_at, filename, sport, duration_sec, distance_m")
        .eq("user_id", user_id)
        .order("uploaded_at", desc=True)
        .limit(limit)
        .execute()
    )
    data, err = _extract_response(resp)
    if err:
        return []
    return data or []