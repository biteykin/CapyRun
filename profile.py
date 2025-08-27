# profile.py
from typing import Any, Dict, Optional
import streamlit as st

# Значения по умолчанию
DEFAULT_PROFILE: Dict[str, Any] = {
    "hr_rest": 50,
    "hr_max": 190,
    "zone_bounds_text": "110,130,145,160,175",
}

# --- утилиты -----------------------------------------------------------------

def _uid(user: Any) -> Optional[str]:
    """Достаёт id пользователя из dict или объекта."""
    if isinstance(user, dict):
        return user.get("id")
    return getattr(user, "id", None)

def _safe_select_profile(supabase, user_id: str) -> Optional[Dict[str, Any]]:
    """Вернёт строку профиля или None. Любые ошибки не роняют UI."""
    try:
        res = supabase.table("user_profiles").select("*").eq("id", user_id).execute()
        data = getattr(res, "data", None) or []
        return data[0] if data else None
    except Exception:
        st.warning("Нет доступа к таблице user_profiles (RLS/политики). Использую значения по умолчанию.")
        return None

def save_profile(supabase, user_id: str, hr_rest: int, hr_max: int, zones: str) -> bool:
    """
    Сохраняет профиль с явным select→update/insert (без upsert).
    Возвращает True при успехе, иначе False.
    """
    # есть ли запись?
    try:
        res = supabase.table("user_profiles").select("id").eq("id", user_id).execute()
        exists = bool(getattr(res, "data", []) )
    except Exception:
        return False

    try:
        if exists:
            supabase.table("user_profiles").update({
                "hr_rest": hr_rest,
                "hr_max": hr_max,
                "zone_bounds_text": zones,
            }).eq("id", user_id).execute()
        else:
            supabase.table("user_profiles").insert({
                "id": user_id,
                "hr_rest": hr_rest,
                "hr_max": hr_max,
                "zone_bounds_text": zones,
            }).execute()
        return True
    except Exception:
        return False

# --- публичные функции -------------------------------------------------------

def load_or_init_profile(supabase, user_id: str) -> Dict[str, Any]:
    """
    Возвращает профиль пользователя. Если записи нет — пытается создать дефолт.
    Никогда не роняет приложение: при недоступной БД возвращает дефолт.
    """
    if not user_id:
        return {**DEFAULT_PROFILE, "id": None}

    # 1) пробуем прочитать
    row = _safe_select_profile(supabase, user_id)
    if row:
        return row

    # 2) записи нет — попробуем создать дефолтную
    default_row = {"id": user_id, **DEFAULT_PROFILE}
    created_ok = save_profile(supabase, user_id, default_row["hr_rest"], default_row["hr_max"], default_row["zone_bounds_text"])

    if created_ok:
        reread = _safe_select_profile(supabase, user_id)
        if reread:
            return reread

    # 3) совсем без доступа — вернём дефолт и дадим UI работать
    return default_row

def profile_sidebar(supabase, user: Dict[str, Any], profile_row: Dict[str, Any]):
    """
    Рендерит параметры анализа в сайдбаре и возвращает: hr_rest, hr_max, zone_bounds_text.
    """
    st.markdown("### ⚙️ Параметры анализа")

    hr_rest = st.number_input(
        "Пульс в покое (HRrest)",
        min_value=30, max_value=100,
        value=int(profile_row.get("hr_rest", DEFAULT_PROFILE["hr_rest"])),
        step=1,
        key="ui_hr_rest",
    )
    hr_max = st.number_input(
        "Макс. пульс (HRmax)",
        min_value=140, max_value=230,
        value=int(profile_row.get("hr_max", DEFAULT_PROFILE["hr_max"])),
        step=1,
        key="ui_hr_max",
    )
    zone_bounds_text = st.text_input(
        "Границы зон HR (через запятую)",
        value=str(profile_row.get("zone_bounds_text", DEFAULT_PROFILE["zone_bounds_text"])),
        help="Напр.: 110,130,145,160,175",
        key="ui_zone_bounds",
    )

    if st.button("💾 Сохранить профиль"):
        uid = _uid(user)
        ok = bool(uid) and save_profile(
            supabase,
            uid,
            int(hr_rest),
            int(hr_max),
            zone_bounds_text.strip(),
        )
        if ok:
            st.success("Профиль сохранён.")
        else:
            st.error("Профиль не сохранён (проверь RLS/политики в Supabase).")

    return int(hr_rest), int(hr_max), zone_bounds_text
