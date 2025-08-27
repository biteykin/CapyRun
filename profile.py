# new code

from __future__ import annotations
import datetime as dt
from typing import Any, Dict, Optional, Tuple

import streamlit as st

DEFAULTS = {
    "hr_rest": 50,
    "hr_max": 185,
    "zone_bounds_text": "120,140,155,170",
}

# ---------------- internals ----------------

def _attach_auth_token(supabase) -> Optional[str]:
    """Attach access_token to PostgREST; return token or None."""
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
    """Return current user's uid from several sources."""
    # 1) from passed user (from app.py / auth_sidebar)
    if isinstance(user, dict) and user.get("id"):
        return str(user["id"])

    # 2) from session_state (where auth_sidebar puts user object)
    u = st.session_state.get("auth_user")
    if isinstance(u, dict) and u.get("id"):
        return str(u["id"])

    # 3) from supabase.auth.get_user()
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

# ---------------- public API ----------------

def load_or_init_profile(supabase, user_id: str) -> Dict[str, Any]:
    """
    Load profile by user_id. If not found, return defaults (without creating).
    """
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
        st.warning(f"Could not load profile: {e}")
    return {"user_id": user_id, **DEFAULTS}


def save_profile(supabase, user: Optional[Dict[str, Any]], hr_rest: int, hr_max: int, zone_bounds_text: str) -> bool:
    """
    Upsert profile by user_id. user_id is taken from passed user/session, not from field params.
    """
    token = _attach_auth_token(supabase)
    uid = _get_current_user_id(supabase, user)

    if not uid:
        st.error("No active session. Please log in and try again.")
        # Debug hint to understand why no uid
        st.caption(f"DEBUG: token_present={bool(token)} | session_user={bool(st.session_state.get('auth_user'))}")
        return False

    row = {
        "user_id": uid,
        "hr_rest": int(hr_rest) if hr_rest is not None else None,
        "hr_max": int(hr_max) if hr_max is not None else None,
        "zone_bounds_text": (zone_bounds_text or "").strip(),
        "updated_at": dt.datetime.utcnow().isoformat(),
    }

    try:
        # upsert by user_id (in DB: user_id PRIMARY KEY)
        supabase.table("profiles").upsert(row, on_conflict="user_id").execute()
        return True
    except Exception as e:
        # Unpack PostgREST message if possible
        msg = "Profile not saved (check RLS/policies in Supabase)."
        if hasattr(e, "args") and e.args and isinstance(e.args[0], dict):
            info = e.args[0]
            code = info.get("code")
            message = info.get("message")
            details = info.get("details")
            hint = info.get("hint")
            msg = f"Profile not saved [{code}]: {message}\n{details or ''}\n{hint or ''}"
        st.error(msg)
        return False


def profile_sidebar(supabase, user: Dict[str, Any], profile_row: Dict[str, Any]) -> Tuple[int, int, str]:
    """
    Render profile block in sidebar.
    Returns (hr_rest, hr_max, zone_bounds_text).
    """
    st.markdown("### ⚙️ Profile")
    hr_rest = st.number_input("Resting HR (HRrest)", 30, 120, int(profile_row.get("hr_rest", DEFAULTS["hr_rest"])))
    hr_max  = st.number_input("Max HR (HRmax)", 120, 240, int(profile_row.get("hr_max", DEFAULTS["hr_max"])))
    zone_bounds_text = st.text_input("HR Zone Bounds (comma-separated)", value=str(profile_row.get("zone_bounds_text", DEFAULTS["zone_bounds_text"])))

    if st.button("💾 Save Profile", use_container_width=True, key="btn_save_profile"):
        with st.spinner("Saving profile..."):
            ok = save_profile(supabase, user, hr_rest, hr_max, zone_bounds_text)
        if ok:
            st.success("Profile saved.")

    return int(hr_rest), int(hr_max), zone_bounds_text
