# db_workouts.py
from __future__ import annotations

from typing import Tuple, Optional, List, Dict, Any, Union
from datetime import datetime
import uuid


# ---------- ВСПОМОГАТЕЛЬНОЕ ----------

def _extract_response(resp) -> Tuple[Optional[Union[dict, list]], Optional[str]]:
    """
    Унифицированный разбор ответа supabase-py (v1/v2).
    Возвращает (data, error_message).
    """
    data = getattr(resp, "data", None)
    err = getattr(resp, "error", None)
    if isinstance(resp, dict):
        data = resp.get("data", data)
        err = resp.get("error", err)
    if err and isinstance(err, dict):
        err = err.get("message") or str(err)
    return data, (str(err) if err else None)


def _ensure_auth(supabase) -> None:
    """
    Подшивает access_token текущей сессии к postgrest-клиенту,
    чтобы RLS (auth.uid()) работал корректно. Совместимо с v1/v2.
    """
    try:
        token = None

        # supabase-py v2
        if hasattr(supabase, "auth") and hasattr(supabase.auth, "get_session"):
            sess = supabase.auth.get_session()
            # sess может быть объектом или dict
            token = getattr(sess, "access_token", None) or (sess and sess.get("access_token"))

        # fallback для некоторых конфигураций v1
        if not token and hasattr(supabase, "auth") and hasattr(supabase.auth, "get_user"):
            user = supabase.auth.get_user()
            token = getattr(user, "access_token", None) or (user and user.get("access_token"))

        if token and hasattr(supabase, "postgrest") and hasattr(supabase.postgrest, "auth"):
            supabase.postgrest.auth(token)
    except Exception:
        # Не валим приложение, просто молча продолжаем — запрос тогда упрётся в 401/403 и его поймаем выше.
        pass


# ---------- ОСНОВНЫЕ ФУНКЦИИ ----------

def save_workout(
    supabase,
    *,
    user_id: str,
    filename: str,
    size_bytes: int,
    parsed: Optional[dict] = None,
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Сохраняет тренировку в таблицу public.workouts.
    Совместимо с разными версиями supabase-py:
      - Пытается insert().select(...).single().execute() (новые клиенты)
      - Если .select() недоступен — делает insert().execute(), затем добирает строку по заранее сгенерированному id
    Возвращает: (ok, error_message, inserted_row)
    """
    try:
        _ensure_auth(supabase)
        parsed = parsed or {}

        workout_id = str(uuid.uuid4())  # генерим id на клиенте, чтобы при старых клиентах можно было достать запись
        payload = {
            "id": workout_id,
            "user_id": user_id,
            "filename": filename,
            "size_bytes": size_bytes,
            "sport": parsed.get("sport"),
            "duration_sec": parsed.get("duration_sec"),
            "distance_m": parsed.get("distance_m"),
            "moving_time_sec": parsed.get("moving_time_sec"),
            "fit_summary": parsed,  # JSONB
            "uploaded_at": datetime.utcnow().isoformat(),
        }

        builder = supabase.table("workouts").insert(payload)

        # Попытка №1: новый API с .select().single()
        try:
            resp = builder.select(
                "id, filename, sport, duration_sec, distance_m, uploaded_at, user_id"
            ).single().execute()
            data, err = _extract_response(resp)
            if err:
                return False, err, None
            if not data:
                # Добираем запись по id (на случай пустого data)
                resp2 = (
                    supabase.table("workouts")
                    .select("id, filename, sport, duration_sec, distance_m, uploaded_at, user_id")
                    .eq("id", workout_id).single().execute()
                )
                data2, err2 = _extract_response(resp2)
                if err2:
                    return False, err2, None
                if not data2:
                    return False, "Вставка не вернула строку (возможны RLS-политики).", None
                return True, None, data2
            return True, None, data

        except AttributeError:
            # Старые клиенты: .select() отсутствует у результата insert()
            resp = builder.execute()
            data, err = _extract_response(resp)
            if err:
                return False, err, None

            # Некоторые версии возвращают вставленные строки сразу
            row = None
            if isinstance(data, list) and data:
                row = data[0]
            elif isinstance(data, dict) and data:
                row = data

            if not row or "id" not in row:
                # Добираем по нашему заранее сгенерированному id
                resp2 = (
                    supabase.table("workouts")
                    .select("id, filename, sport, duration_sec, distance_m, uploaded_at, user_id")
                    .eq("id", workout_id).single().execute()
                )
                data2, err2 = _extract_response(resp2)
                if err2:
                    return False, err2, None
                if not data2:
                    return False, "Вставка не вернула строку (возможны RLS-политики).", None
                return True, None, data2

            # Нормализуем возвращаемую строку
            return True, None, {
                "id": row.get("id", workout_id),
                "filename": row.get("filename", filename),
                "sport": row.get("sport"),
                "duration_sec": row.get("duration_sec"),
                "distance_m": row.get("distance_m"),
                "uploaded_at": row.get("uploaded_at"),
                "user_id": row.get("user_id", user_id),
            }

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
    Пробуем ORDER BY uploaded_at, если нет — created_at, если нет — без ORDER BY
    и сортируем уже на клиенте.
    """
    _ensure_auth(supabase)

    # 1) Попытка с uploaded_at
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
        pass  # упали из-за отсутствия колонки — пробуем дальше

    # 2) Попытка с created_at (часто такая колонка есть по привычке)
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

    # 3) Без ORDER BY → сортируем в Python по лучшему доступному полю
    resp = (
        supabase.table("workouts")
        .select("*")
        .eq("user_id", user_id)
        .limit(limit)
        .execute()
    )
    data, err = _extract_response(resp)
    rows = data or []
    # сортировка в памяти
    def _key(r):
        return (
            r.get("uploaded_at")
            or r.get("created_at")
            or r.get("inserted_at")
            or ""
        )
    rows.sort(key=_key, reverse=True)
    return rows

def get_workout_by_id(supabase, *, workout_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Возвращает одну тренировку текущего пользователя по id.
    Берём все колонки (*), чтобы точно получить fit_summary.
    """
    _ensure_auth(supabase)
    resp = (
        supabase.table("workouts")
        .select("*")
        .eq("id", workout_id)
        .eq("user_id", user_id)  # защита от чужих данных при включённом RLS
        .single()
        .execute()
    )
    data, err = _extract_response(resp)
    if err:
        return None
    return data