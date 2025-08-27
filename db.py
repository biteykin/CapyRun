# db.py — сохранение/чтение тренировок в Supabase (JWT, маппинг колонок, нормализация типов)

from __future__ import annotations
import math
import datetime as dt
from typing import List, Dict, Any, Tuple, Optional

import numpy as np
import pandas as pd

# ---- Маппинг "ключ из summary" -> "колонка в БД" ----
KEY_MAP_SAVE = {
    "Pa:Hr_%": "pa_hr_pct",
    "TRIMP": "trimp",
    "EF": "ef",
}
KEY_MAP_LOAD = {v: k for k, v in KEY_MAP_SAVE.items()}


def _attach_auth_token(supabase) -> Tuple[Optional[str], Optional[str]]:
    """
    Прокидывает access_token текущего пользователя в PostgREST.
    Возвращает (uid, token) текущего пользователя (или (None, None), если его нет).
    """
    # 1) получаем пользователя
    gu = supabase.auth.get_user()
    uid = None
    if gu is not None:
        # supabase-py >=2 возвращает объект с .user.id
        uid = getattr(getattr(gu, "user", None), "id", None)
        if uid is None and isinstance(gu, dict):
            uid = gu.get("user", {}).get("id")

    # 2) получаем access_token
    sess = supabase.auth.get_session()
    token = None
    if sess is not None:
        token = getattr(sess, "access_token", None)
        if token is None and hasattr(sess, "session"):
            token = getattr(sess.session, "access_token", None)
        if token is None and isinstance(sess, dict):
            token = sess.get("access_token")

    # 3) прокидываем токен в PostgREST клиент
    if token:
        if hasattr(supabase, "postgrest") and hasattr(supabase.postgrest, "auth"):
            supabase.postgrest.auth(token)
        elif hasattr(supabase, "rest") and hasattr(supabase.rest, "auth"):
            supabase.rest.auth(token)
        # если не умеет — не бросаем, просто не делаем

    return uid, token


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
    """
    Пишем через RPC-функцию insert_workouts: она сама ставит user_id = auth.uid().
    Если пользователь не аутентифицирован — не делаем ничего.
    """
    if not summaries:
        return

    # Нормализуем и маппим ключи (как раньше), но БЕЗ user_id — его проставит функция
    rows = []
    for r in summaries:
        r = r or {}
        norm = {}
        for k, v in r.items():
            sk = KEY_MAP_SAVE.get(k, k)  # trimp/ef/pa_hr_pct
            norm[sk] = _jsonable(v)
        rows.append(norm)

    # ВАЖНО: перед RPC должен быть прокинут JWT (иначе auth.uid() будет NULL)
    uid, token = _attach_auth_token(supabase)

    if not uid or not token:
        # Не аутентифицирован — не сохраняем, но не бросаем исключение
        return

    # Вызов RPC
    supabase.rpc("insert_workouts", {"_rows": rows}).execute()


def fetch_workouts(supabase, user_id: str, limit: int = 200) -> pd.DataFrame:
    uid, token = _attach_auth_token(supabase)
    # фильтруем по uid (если было получено), иначе по переданному user_id
    filter_uid = uid or user_id

    res = supabase.table("workouts") \
        .select("*") \
        .eq("user_id", filter_uid) \
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