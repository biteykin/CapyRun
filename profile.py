# profile.py
from typing import Any, Dict, Optional
import streamlit as st

DEFAULT_PROFILE: Dict[str, Any] = {
    "hr_rest": 50,
    "hr_max": 190,
    "zone_bounds_text": "110,130,145,160,175",
}

def _safe_select_profile(supabase, user_id: str) -> Optional[Dict[str, Any]]:
    try:
        res = supabase.table("user_profiles").select("*").eq("id", user_id).execute()
        data = getattr(res, "data", None) or []
        return data[0] if data else None
    except Exception:
        st.warning("Нет доступа к таблице user_profiles (RLS/политики). Использую значения по умолчанию.")
        return None

def _safe_upsert_profile(supabase, row: Dict[str, Any]) -> bool:
    try:
        supabase.table("user_profiles").upsert(row, on_conflict="id").execute()
        return True
    except Exception:
        st.warning("Не удалось сохранить профиль (RLS/политики).")
        return False

def load_or_init_profile(supabase, user_id: str) -> Dict[str, Any]:
    if not user_id:
        return {**DEFAULT_PROFILE, "id": None}

    row = _safe_select_profile(supabase, user_id)
    if row:
        return row

    default_row = {"id": user_id, **DEFAULT_PROFILE}
    _safe_upsert_profile(supabase, default_row)
    row2 = _safe_select_profile(supabase, user_id)
    return row2 or default_row

def profile_sidebar(supabase, user: Dict[str, Any], profile_row: Dict[str, Any]):
    st.markdown("### ⚙️ Параметры анализа")

    hr_rest = st.number_input(
        "Пульс в покое (HRrest)",
        min_value=30, max_value=100,
        value=int(profile_row.get("hr_rest", DEFAULT_PROFILE["hr_rest"])),
        step=1, key="ui_hr_rest",
    )
    hr_max = st.number_input(
        "Макс. пульс (HRmax)",
        min_value=140, max_value=230,
        value=int(profile_row.get("hr_max", DEFAULT_PROFILE["hr_max"])),
        step=1, key="ui_hr_max",
    )
    zone_bounds_text = st.text_input(
        "Границы зон HR (через запятую)",
        value=str(profile_row.get("zone_bounds_text", DEFAULT_PROFILE["zone_bounds_text"])),
        help="Напр.: 110,130,145,160,175",
        key="ui_zone_bounds",
    )

    if st.button("💾 Сохранить профиль"):
        row = {
            "id": user.get("id") if isinstance(user, dict) else getattr(user, "id", None),
            "hr_rest": int(hr_rest),
            "hr_max": int(hr_max),
            "zone_bounds_text": zone_bounds_text.strip(),
        }
        ok = _safe_upsert_profile(supabase, row)
        if ok:
            st.success("Профиль сохранён.")
        else:
            st.error("Профиль не сохранён (проверь RLS/политики в Supabase).")

    return int(hr_rest), int(hr_max), zone_bounds_text
