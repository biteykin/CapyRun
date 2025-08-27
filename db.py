# db.py — сохранение/чтение тренировок в Supabase (JWT прокидываем в PostgREST, маппинг колонок, сериализация)

from __future__ import annotations
import math
import datetime as dt
from typing import List, Dict, Any

import numpy as np
import pandas as pd

# ---- Маппинг "ключ из summary" -> "колонка в БД" ----
KEY_MAP_SAVE = {
    "Pa:Hr_%": "pa_hr_pct",
    "TRIMP": "trimp",
    "EF": "ef",
}
KEY_MAP_LOAD = {v: k for k, v in KEY_MAP_SAVE.items()}


def _attach_auth_token(supabase) -> None:
    """
    Прокидывает access_token текущего пользователя в PostgREST.
    Иначе RLS видит auth.uid() = null и блокирует insert/select.
    """
    try:
        sess = supabase.auth.get_session()
        token = None
        if sess:
            # supabase-py >=2: sess.access_token
            token = getattr(sess, "access_token", None)
            # иногда объект-обёртка: sess.session.access_token
            if token is None and hasattr(sess, "session"):
                token = getattr(sess.session, "access_token", None)
            # на всякий случай, если это dict
            if token is None and isinstance(sess, dict):
                token = sess.get("access_token")
        if token:
            # разные версии клиента: postgrest.auth(...) или rest.auth(...)
            if hasattr(supabase, "postgrest") and hasattr(supabase.postgrest, "auth"):
                supabase.postgrest.auth(token)
            elif hasattr(supabase, "rest") and hasattr(supabase.rest, "auth"):
                supabase.rest.auth(token)
    except Exception:
        pass  # не падать, просто не получится вставить — покажем RLS-ошибку выше


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
        out[KEY_MAP_SAVE.get(k, k)] = _jsonable(v)
    return out


def save_workouts(supabase, user_id: str, summaries: List[Dict[str, Any]]) -> None:
    if not summaries:
        return
    # критично: подложить JWT перед запросом
    _attach_auth_token(supabase)

    rows = [_normalize_row_for_save(user_id, r or {}) for r in summaries]
    try:
        supabase.table("workouts").insert(rows).execute()
    except Exception as e:
        # дружелюбный вывод причины
        try:
            import streamlit as st
            if hasattr(e, "args") and e.args and isinstance(e.args[0], dict):
                info = e.args[0]
                code = info.get("code")
                message = info.get("message")
                details = info.get("details")
                hint = info.get("hint")
                st.error(f"Supabase insert error [{code}]: {message}\n{details or ''}\n{hint or ''}")
            else:
                st.error(f"Supabase insert error: {getattr(e, 'message', None) or str(e)}")
        except Exception:
            pass
        raise


def fetch_workouts(supabase, user_id: str, limit: int = 200) -> pd.DataFrame:
    # тоже нужен JWT, иначе select отрежется RLS
    _attach_auth_token(supabase)

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
