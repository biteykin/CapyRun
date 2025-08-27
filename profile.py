# profile.py
from typing import Any, Dict, Optional
import streamlit as st

# Значения по умолчанию
DEFAULT_PROFILE: Dict[str, Any] = {
    "hr_rest": 50,
    "hr_max": 190,
    "zone_bounds_text": "110,130,145,160,175",
}

def _select_profile(supabase, user_id: str) -> Optional[Dict[str, Any]]:
    res = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
    data = getattr(res, "data", None) or []
    return data[0] if data else None

def load_or_init_profile(supabase, user_id: str) -> Dict[str, Any]:
    """
    Возвращает профиль пользователя. Если записи нет — создаёт через UPSERT.
    Никогда не роняет приложение: вернёт хотя бы дефолт.
    """
    if not user_id:
        return {**DEFAULT_PROFILE, "user_id": None}

    # уже есть?
    row = _select_profile(supabase, user_id)
    if row:
        return row

    # создать (без дублей)
    new_row = {"user_id": user_id, **DEFAULT_PROFILE}
    try:
        supabase.table("user_profiles").upsert(new_row, on_conflict="user_id").execute()
    except Exception:
        # дадим UI жить, а наверху покажем предупреждение
        st.warning("Не удалось создать профиль (проверь RLS/схему). Использую значения по умолчанию.")
        return new_row

    # перечитать
    row2 = _select_profile(supabase, user_id)
    return row2 or new_row

def profile_sidebar(supabase, user: Dict[str, Any], profile_row: Dict[str, Any]):
    """
    Рендерит параметры анализа в сайдбаре и возвращает: hr_rest, hr_max, zone_bounds_text
    """
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
            "user_id": user.get("id") if isinstance(user, dict) else getattr(user, "id", None),
            "hr_rest": int(hr_rest),
            "hr_max": int(hr_max),
            "zone_bounds_text": zone_bounds_text.strip(),
        }
        try:
            supabase.table("user_profiles").upsert(row, on_conflict="user_id").execute()
            st.success("Профиль сохранён.")
        except Exception:
            st.error("Не удалось сохранить профиль. Проверь политики RLS и схему таблицы.")

    return int(hr_rest), int(hr_max), zone_bounds_text
