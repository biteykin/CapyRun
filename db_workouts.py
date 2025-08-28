# db_workouts.py
from typing import Tuple, Optional, List, Dict, Any, Union
from datetime import datetime

# ---------- helpers ----------

def _extract_response(resp) -> Tuple[Optional[Union[dict, list]], Optional[str]]:
    data = getattr(resp, "data", None)
    err = getattr(resp, "error", None)
    if isinstance(resp, dict):
        data = resp.get("data", data)
        err = resp.get("error", err)
    if err and isinstance(err, dict):
        err = err.get("message") or str(err)
    return data, (str(err) if err else None)

def _ensure_auth(supabase) -> None:
    """Подшиваем access_token к postgrest-клиенту, чтобы работали RLS-политики."""
    try:
        token = None
        # v2
        if hasattr(supabase, "auth") and hasattr(supabase.auth, "get_session"):
            sess = supabase.auth.get_session()
            token = getattr(sess, "access_token", None) or (sess and sess.get("access_token"))
        # v1 fallback
        if not token and hasattr(supabase, "auth") and hasattr(supabase.auth, "get_user"):
            user = supabase.auth.get_user()
            token = getattr(user, "access_token", None) or (user and user.get("access_token"))
        if token and hasattr(supabase, "postgrest") and hasattr(supabase.postgrest, "auth"):
            supabase.postgrest.auth(token)
    except Exception:
        pass

# ---------- API ----------

def save_workout(
    supabase,
    *,
    user_id: str,
    filename: str,
    size_bytes: int,
    parsed: Optional[dict] = None,
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Сохраняет тренировку в public.workouts и возвращает вставленную строку.
    Не отправляем 'id' (пусть БД сама генерит serial/uuid — неважно).
    Поддержка клиентов supabase-py с/без insert().select().single().
    """
    try:
        _ensure_auth(supabase)
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

        builder = supabase.table("workouts").insert(payload)

        # Попытка №1 — новый API
        try:
            resp = builder.select(
                "id, filename, sport, duration_sec, distance_m, uploaded_at, user_id"
            ).single().execute()
            data, err = _extract_response(resp)
            if err:
                return False, err, None
            if data:
                return True, None, data
        except AttributeError:
            # пойдём по пути старого клиента
            pass

        # Попытка №2 — старый клиент: insert().execute()
        resp = builder.execute()
        data, err = _extract_response(resp)
        if err:
            return False, err, None

        row = None
        if isinstance(data, list) and data:
            row = data[0]
        elif isinstance(data, dict) and data:
            row = data

        if row:
            return True, None, {
                "id": row.get("id"),
                "filename": row.get("filename", filename),
                "sport": row.get("sport"),
                "duration_sec": row.get("duration_sec"),
                "distance_m": row.get("distance_m"),
                "uploaded_at": row.get("uploaded_at"),
                "user_id": row.get("user_id", user_id),
            }

        # Попытка №3 — добираем по эвристике: последняя запись этого пользователя с тем же файлом
        try:
            q = (
                supabase.table("workouts")
                .select("*")
                .eq("user_id", user_id)
                .eq("filename", filename)
                .eq("size_bytes", size_bytes)
                .order("uploaded_at", desc=True)
                .limit(1)
                .execute()
            )
            data2, err2 = _extract_response(q)
            if not err2 and isinstance(data2, list) and data2:
                return True, None, data2[0]
        except Exception:
            pass

        return True, None, None

    except Exception as e:
        return False, str(e), None

def list_workouts(
    supabase,
    *,
    user_id: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Возвращает последние N тренировок пользователя.
    Мягкая сортировка: пробуем uploaded_at → created_at → сортируем в памяти.
    """
    _ensure_auth(supabase)

    # 1) uploaded_at
    try:
        resp = (
            supabase.table("workouts")
            .select("*")
            .eq("user_id", user_id)
            .order("uploaded_at", desc=True)
            .limit(limit)
            .execute()
        )
        data, err = _extract_response(resp)
        if not err:
            return data or []
    except Exception:
        pass

    # 2) created_at
    try:
        resp = (
            supabase.table("workouts")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        data, err = _extract_response(resp)
        if not err:
            return data or []
    except Exception:
        pass

    # 3) без сортировки → сортируем на клиенте
    resp = (
        supabase.table("workouts")
        .select("*")
        .eq("user_id", user_id)
        .limit(limit)
        .execute()
    )
    data, err = _extract_response(resp)
    rows = data or []
    def _key(r):
        return r.get("uploaded_at") or r.get("created_at") or r.get("inserted_at") or ""
    rows.sort(key=_key, reverse=True)
    return rows

from typing import Optional, Dict, Any

def get_workout_by_id(supabase, *, workout_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Возвращает одну тренировку (включая fit_summary) текущего пользователя."""
    _ensure_auth(supabase)
    resp = (
        supabase.table("workouts")
        .select("*")
        .eq("id", workout_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    data, err = _extract_response(resp)
    if err:
        return None
    return data