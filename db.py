# db.py — сохранение/чтение тренировок в Supabase (устойчиво к типам и с маппингом колонок)

from __future__ import annotations
import math
import datetime as dt
from typing import List, Dict, Any

import numpy as np
import pandas as pd

# ---- Маппинг "ключ из summary" -> "колонка в БД" (snake_case, нижний регистр) ----
KEY_MAP_SAVE = {
    "Pa:Hr_%": "pa_hr_pct",
    "TRIMP": "trimp",
    "EF": "ef",
    # остальные совпадают по имени: start_time, date, sport, distance_km, time_s, time_min, time_hms, avg_hr
}
KEY_MAP_LOAD = {v: k for k, v in KEY_MAP_SAVE.items()}

def _jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dt.datetime, pd.Timestamp)):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, (dt.timedelta, pd.Timedelta)):
        return int(value.total_seconds())

    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    if isinstance(value, (np.bool_,)):
        return bool(value)

    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}

    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    return value

def _normalize_row_for_save(user_id: str, row: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {"user_id": user_id}
    for k, v in row.items():
        safe_key = KEY_MAP_SAVE.get(k, k)  # переименуем при необходимости
        out[safe_key] = _jsonable(v)
    return out

def save_workouts(supabase, user_id: str, summaries: List[Dict[str, Any]]) -> None:
    if not summaries:
        return
    rows = [_normalize_row_for_save(user_id, r or {}) for r in summaries]
    try:
        supabase.table("workouts").insert(rows).execute()
    except Exception as e:
        # Покажем полезные детали ошибки (PostgREST обычно присылает code/message/details/hint)
        try:
            import streamlit as st  # мягкая зависимость, чтобы не тащить st в верхний уровень
            msg = getattr(e, "message", None) or str(e)
            # у APIError есть .args[0] с dict/json — попробуем достать поля
            if hasattr(e, "args") and e.args and isinstance(e.args[0], dict):
                info = e.args[0]
                code = info.get("code")
                message = info.get("message")
                details = info.get("details")
                hint = info.get("hint")
                st.error(f"Supabase insert error [{code}]: {message}\n{details or ''}\n{hint or ''}")
            else:
                st.error(f"Supabase insert error: {msg}")
        except Exception:
            pass
        raise  # пробросим, чтобы видеть трейсбек в логах/консоли

def fetch_workouts(supabase, user_id: str, limit: int = 200) -> pd.DataFrame:
    res = supabase.table("workouts") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("start_time", desc=False) \
        .limit(limit) \
        .execute()

    data = getattr(res, "data", None) or getattr(res, "json", None) or []
    df = pd.DataFrame(data)
    if df.empty:
        return df

    df = df.rename(columns=KEY_MAP_LOAD)

    if "start_time" in df.columns:
        df["start_time"] = pd.to_datetime(df["start_time"], errors="coerce")
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date

    return df
