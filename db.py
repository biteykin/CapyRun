# db.py — сохранение/чтение тренировок в Supabase (без ошибок сериализации)

from __future__ import annotations
import math
import datetime as dt
from typing import List, Dict, Any, Optional

import numpy as np
import pandas as pd

# Ключи, которые лучше хранить в БД в «безопасном» виде
KEY_MAP_SAVE = {
    "Pa:Hr_%": "pa_hr_pct",
}
KEY_MAP_LOAD = {v: k for k, v in KEY_MAP_SAVE.items()}


def _jsonable(value: Any) -> Any:
    """Привести значение к JSON-сериализуемому виду."""
    # None
    if value is None:
        return None

    # datetime / date
    if isinstance(value, (dt.datetime, pd.Timestamp)):
        # ISO без таймзоны (или с, если у вас tz-aware)
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    if isinstance(value, dt.date):
        return value.isoformat()

    # timedelta
    if isinstance(value, (dt.timedelta, pd.Timedelta)):
        # Сохраняем в секундах
        return int(value.total_seconds())

    # numpy-типы
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    if isinstance(value, (np.bool_,)):
        return bool(value)

    # списки/словарики — рекурсия
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}

    # float с nan/inf
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value

    # прочие простые типы (int, str, bool)
    return value


def _normalize_row_for_save(user_id: str, row: Dict[str, Any]) -> Dict[str, Any]:
    """Переименовать «сложные» ключи, добавить user_id и сериализуемые значения."""
    out: Dict[str, Any] = {"user_id": user_id}
    for k, v in row.items():
        safe_key = KEY_MAP_SAVE.get(k, k)
        out[safe_key] = _jsonable(v)
    return out


def save_workouts(supabase, user_id: str, summaries: List[Dict[str, Any]]) -> None:
    """
    Сохранить список сводок тренировок в таблицу 'workouts'.
    Ожидается, что в БД есть колонка user_id и колонки под поля summary
    (например: start_time (timestamptz/ text), date (date/ text), sport, distance_km, time_s, time_min,
     time_hms, avg_hr, TRIMP, EF, pa_hr_pct и т.д.)
    """
    if not summaries:
        return

    rows = [_normalize_row_for_save(user_id, r or {}) for r in summaries]
    # Вставка
    supabase.table("workouts").insert(rows).execute()


def fetch_workouts(supabase, user_id: str, limit: int = 200) -> pd.DataFrame:
    """
    Получить историю тренировок пользователя.
    Переименуем поля обратно (pa_hr_pct -> 'Pa:Hr_%') для совместимости с UI.
    """
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

    # Переименуем «безопасные» ключи обратно под UI
    df = df.rename(columns=KEY_MAP_LOAD)

    # Попробуем привести даты в типы pandas (если сохраняли ISO-строками)
    if "start_time" in df.columns:
        df["start_time"] = pd.to_datetime(df["start_time"], errors="coerce")
    if "date" in df.columns:
        # date может прийти как строка — нормализуем
        df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date

    return df
