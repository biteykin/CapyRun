# profile.py — vDEBUG-3
from __future__ import annotations
import datetime as dt
from typing import Any, Dict, Optional, Tuple
import streamlit as st

DEFAULTS = {"hr_rest": 50, "hr_max": 185, "zone_bounds_text": "120,140,155,170"}
PROFILE_VERSION = "profile.py vDEBUG-3"  # ← покажем на экране, чтобы знать, что файл активен

def _attach_auth_token(supabase) -> Optional[str]:
    token = None
    try:
        token = st.session_state.get("sb_access_token")
    except Exception:
        pass
    if not token:
        try:
            sess = supabase.auth.get_session()
            if sess is not None:
                token = getattr(sess, "access_token", None)
                if token is None and hasattr(sess, "session"):
                    token = getattr(sess.session, "access_token", None)
                if token is None and isinstance(sess, dict):
                    token = sess.get("access_token")
        except Exception:
            pass
    if token:
        try:
            if hasattr(supabase, "postgrest") and hasattr(supabase.postgrest, "auth"):
                supabase.postgrest.auth(token)
            elif hasattr(supabase, "rest") and hasattr(supabase.rest, "auth"):
                supabase.rest.auth(token)
        except Exception:
            pass
    return token

def _get_current_user_id(supabase, user: Optional[Dict[str, Any]] = None) -> Optional[str]:
    if isinstance(user, dict) and user.get("id"):
        return str(user["id"])
    u = st.session_state.get("auth_user")
    if isinstance(u, dict) and u.get("id"):
        return str(u["id"])
    try:
        gu = supabase.auth.get_user()
        uid = getattr(getattr(gu, "user", None), "id", None)
        if uid is None and isinstance(gu, dict):
            uid = gu.get("user", {}).get("id")
        if uid:
            return str(uid)
    except Exception:
        pass
    return None

def load_or_init_profile(supabase, user_id: str) -> Dict[str, Any]:
    _attach_auth_token(supabase)
    try:
        res = (
            supabase.table("profiles")
            .select("user_id, hr_rest, hr_max, zone_bounds_text")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        data = getattr(res, "data", None) or getattr(res, "json", None) or []
        if data:
            row = data[0]
            return {
                "user_id": row.get("user_id"),
                "hr_rest": row.get("hr_rest", DEFAULTS["hr_rest"]),
                "hr_max": row.get("hr_max", DEFAULTS["hr_max"]),
                "zone_bounds_text": row.get("zone_bounds_text", DEFAULTS["zone_bounds_text"]),
            }
    except Exception as e:
        st.warning(f"Не удалось загрузить профиль: {e}")
    return {"user_id": user_id, **DEFAULTS}

def save_profile(supabase, user: Optional[Dict[str, Any]], hr_rest: int, hr_max: int, zone_bounds_text: str) -> bool:
    token = _attach_auth_token(supabase)
    uid = _get_current_user_id(supabase, user)

    # ЯВНАЯ ДИАГНОСТИКА:
    st.info(f"DEBUG(save_profile): token_present={bool(token)} | uid={uid} | ss.auth_user={bool(st.session_state.get('auth_user'))}")

    if not uid:
        st.error("Нет активной сессии. Войдите в аккаунт и повторите. (см. DEBUG выше)")
        return False

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
        msg = "Профиль не сохранён (проверь RLS/политики в Supabase)."
        if hasattr(e, "args") and e.args and isinstance(e.args[0], dict):
            info = e.args[0]; code = info.get("code"); message = info.get("message")
            details = info.get("details"); hint = info.get("hint")
            msg = f"Профиль не сохранён [{code}]: {message}\n{details or ''}\n{hint or ''}"
        st.error(msg)
        st.exception(e)  # ← полный трейсбек в UI для диагностики
        return False

def profile_sidebar(supabase, user: Dict[str, Any], profile_row: Dict[str, Any]) -> Tuple[int, int, str]:
    st.markdown("### ⚙️ Профиль")
    st.caption(PROFILE_VERSION)  # ← видно активную версию файла
    hr_rest = st.number_input("Пульс в покое (HRrest)", 30, 120, int(profile_row.get("hr_rest", DEFAULTS["hr_rest"])))
    hr_max  = st.number_input("Максимальный пульс (HRmax)", 120, 240, int(profile_row.get("hr_max", DEFAULTS["hr_max"])))
    zone_bounds_text = st.text_input("Границы зон ЧСС (через запятую)", value=str(profile_row.get("zone_bounds_text", DEFAULTS["zone_bounds_text"])))

    if st.button("💾 Сохранить профиль", use_container_width=True, key="btn_save_profile"):
        with st.spinner("Сохраняем профиль..."):
            ok = save_profile(supabase, user, hr_rest, hr_max, zone_bounds_text)
        if ok:
            st.success("Профиль сохранён.")
    return int(hr_rest), int(hr_max), zone_bounds_text
