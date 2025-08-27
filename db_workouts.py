# db_workouts.py
from __future__ import annotations
from typing import Tuple, Optional, Dict, Any
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
    - Пытается использовать insert().select(...).single().execute() (новые клиенты)
    - Если .select() недоступен — делает insert().execute(), затем добирает строку через select по id
    """
    try:
        parsed = parsed or {}

        workout_id = str(uuid.uuid4())  # генерим id на клиенте, чтобы можно было достать запись после insert
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

        # Попытка №1: новый API с .select().single()
        try:
            resp = builder.select("id, filename, sport, duration_sec, distance_m, uploaded_at").single().execute()
            data, err = _extract_response(resp)
            if err:
                return False, err, None
            if not data:
                # На всякий случай попробуем добрать запись по id
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
            # У старых клиентов нет .select() после insert
            resp = builder.execute()
            data, err = _extract_response(resp)
            if err:
                return False, err, None
            # Некоторые версии уже возвращают вставленные строки;
            # если да — берём первую, иначе — добираем по id
            row = None
            if isinstance(data, list) and data:
                row = data[0]
            elif isinstance(data, dict) and data:
                row = data

            if not row or "id" not in row:
                # Добираем запись по сгенерированному id
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

            # Если row есть — возвращаем его (или добираем витрину колонок, если хочется)
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