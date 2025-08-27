# profile.py — профиль пользователя (ЧСС, зоны), сохранение в Supabase с RLS

from __future__ import annotations
import datetime as dt
from typing import Any, Dict, Optional, Tuple

import streamlit as st

DEFAULTS = {
    "hr_rest": 50,
    "hr_max": 185,
    "zone_bounds_text": "120,140,155,170",  # пример
}

def _attach_auth_token(supabase) -> Optional[str]:
    """
    Вставляет JWT в PostgREST/REST клиент Supabase для корректной работы RLS.
    """
    token = None
    # 1. Пробуем взять из session_state (быстрее)
    token = st.session_state.get("sb_access_token", None)
    # 2. Если нет — пробуем через supabase.auth.get_session()
    if not token:
        try:
            sess = supabase.auth.get_session()
            if sess is not None:
                # supabase-py >=2.0: session is dict or object
                token = getattr(sess, "access_token", None)
                if token is None and hasattr(sess, "session"):
                    token = getattr(sess.session, "access_token", None)
                if token is None and isinstance(sess, dict):
                    token = sess.get("access_token")
        except Exception:
            pass
    # 3. Вставляем токен в postgrest/rest
    if token:
        try:
            if hasattr(supabase, "postgrest") and hasattr(supabase.postgrest, "auth"):
                supabase.postgrest.auth(token)
            elif hasattr(supabase, "rest") and hasattr(supabase.rest, "auth"):
                supabase.rest.auth(token)
        except Exception:
            pass
    return token

def _get_current_user_id(supabase) -> Optional[str]:
    """
    Получает user_id текущего пользователя через supabase.auth.get_user().
    """
    try:
        gu = supabase.auth.get_user()
        # supabase-py >=2.0: gu.user.id, иногда gu["user"]["id"]
        if hasattr(gu, "user") and hasattr(gu.user, "id"):
            return gu.user.id
        if isinstance(gu, dict):
            user = gu.get("user")
            if isinstance(user, dict):
                return user.get("id")
    except Exception:
        pass
    return None

def load_or_init_profile(supabase, user_id: str) -> Dict[str, Any]:
    """
    Загружает профиль по user_id. Если нет строки — возвращает дефолты (без создания).
    """
    _attach_auth_token(supabase)
    if not user_id:
        return {"user_id": None, **DEFAULTS}
    try:
        res = (
            supabase.table("profiles")
            .select("user_id, hr_rest, hr_max, zone_bounds_text")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        # supabase-py: .data (v2), .json (v1), или []
        data = getattr(res, "data", None) or getattr(res, "json", None) or []
        if data and isinstance(data, list) and data[0]:
            row = data[0]
            return {
                "user_id": row.get("user_id", user_id),
                "hr_rest": row.get("hr_rest", DEFAULTS["hr_rest"]),
                "hr_max": row.get("hr_max", DEFAULTS["hr_max"]),
                "zone_bounds_text": row.get("zone_bounds_text", DEFAULTS["zone_bounds_text"]),
            }
    except Exception as e:
        st.warning(f"Не удалось загрузить профиль: {e}")
    return {"user_id": user_id, **DEFAULTS}

def save_profile(supabase, hr_rest: int, hr_max: int, zone_bounds_text: str) -> bool:
    """
    Сохраняет профиль текущего пользователя (upsert по user_id).
    user_id берётся из supabase.auth.get_user(), а не из параметров.
    """
    _attach_auth_token(supabase)
    uid = _get_current_user_id(supabase)
    if not uid:
        st.error("Нет активной сессии. Войдите в аккаунт и повторите.")
        return False

    # Используем dict comprehension для row, чтобы избежать лишних проверок
    row = {
        "user_id": uid,
        "hr_rest": int(hr_rest) if hr_rest is not None else None,
        "hr_max": int(hr_max) if hr_max is not None else None,
        "zone_bounds_text": (zone_bounds_text or "").strip(),
        "updated_at": dt.datetime.utcnow().isoformat(),
    }

    try:
        supabase.table("profiles").upsert(row, on_conflict="user_id").execute()
        return True
    except Exception as e:
        # Оптимизированная обработка ошибок
        msg = "Профиль не сохранён (проверь RLS/политики в Supabase)."
        info = getattr(e, "args", [None])[0]
        if isinstance(info, dict):
            code = info.get("code", "")
            message = info.get("message", "")
            details = info.get("details", "")
            hint = info.get("hint", "")
            msg = f"Профиль не сохранён [{code}]: {message}\n{details}\n{hint}"
        st.error(msg)
        return False

def profile_sidebar(supabase, user: Dict[str, Any], profile_row: Dict[str, Any]) -> Tuple[int, int, str]:
    """
    Рендерит блок профиля в сайдбаре.
    Возвращает (hr_rest, hr_max, zone_bounds_text).
    """
    st.markdown("### ⚙️ Профиль")
    hr_rest = st.number_input(
        "Пульс в покое (HRrest)",
        min_value=30, max_value=120,
        value=int(profile_row.get("hr_rest", DEFAULTS["hr_rest"])),
        step=1,
        key="ui_hr_rest"
    )
    hr_max = st.number_input(
        "Максимальный пульс (HRmax)",
        min_value=120, max_value=240,
        value=int(profile_row.get("hr_max", DEFAULTS["hr_max"])),
        step=1,
        key="ui_hr_max"
    )
    zone_bounds_text = st.text_input(
        "Границы зон ЧСС (через запятую)",
        value=str(profile_row.get("zone_bounds_text", DEFAULTS["zone_bounds_text"])),
        key="ui_zone_bounds"
    )

    if st.button("💾 Сохранить профиль", use_container_width=True, key="btn_save_profile"):
        with st.spinner("Сохраняем профиль..."):
            ok = save_profile(supabase, hr_rest, hr_max, zone_bounds_text)
        if ok:
            st.success("Профиль сохранён.")
        # если не ок — save_profile уже показал ошибку

    return int(hr_rest), int(hr_max), zone_bounds_text