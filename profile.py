# profile.py
from __future__ import annotations
from typing import Dict, Any, Optional
import streamlit as st

try:
    from postgrest.exceptions import APIError  # type: ignore
except Exception:
    class APIError(Exception):  # fallback, чтобы не падать при импорте
        pass

# Значения по умолчанию, если у пользователя ещё нет профиля
DEFAULT_PROFILE: Dict[str, Any] = {
    "hr_rest": 50,
    "hr_max": 190,
    # Границы зон через запятую (пример): Z1..Z5 по HR
    "zone_bounds_text": "110,130,145,160,175",
}

def _select_profile(supabase, user_id: str) -> Optional[Dict[str, Any]]:
    res = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
    data = getattr(res, "data", None) or []
    return data[0] if data else None

def load_or_init_profile(supabase, user_id: str) -> Dict[str, Any]:
    """
    Возвращает строку профиля пользователя из user_profiles.
    Если записи нет — создаёт через UPSERT по user_id.
    Никогда не падает наружу из-за APIError: вернёт хотя бы дефолт.
    """
    if not user_id:
        # На всякий случай, чтобы не ловить obscure errors
        return {**DEFAULT_PROFILE, "user_id": None}

    # 1) Пытаемся прочитать
    row = _select_profile(supabase, user_id)
    if row:
        return row

    # 2) Нет записи — создаём UPSERT-ом (без гонок и дублей)
    new_row = {"user_id": user_id, **DEFAULT_PROFILE}
    try:
        supabase.table("user_profiles").upsert(
            new_row,
            on_conflict="user_id",
        ).execute()
    except APIError as e:
        # Возможные причины: RLS/политики, ограничения схемы, конфликт и т.п.
        # Пробуем ещё раз просто прочитать — возможно, запись уже существует.
        st.warning("Не удалось сразу создать профиль — проверяю существующую запись.")
    finally:
        row2 = _select_profile(supabase, user_id)
        if row2:
            return row2
        # Совсем крайний случай: отдать дефолт, чтобы UI не падал
        st.warning("Профиль не найден и не создан. Проверь политики RLS для user_profiles.")
        return new_row

def profile_sidebar(supabase, user: Dict[str, Any], profile_row: Dict[str, Any]):
    """
    Рендер параметров анализа и возврат значений для app.py:
    hr_rest, hr_max, zone_bounds_text
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
        help="Напр., 110,130,145,160,175  (между Z1..Z5)",
        key="ui_zone_bounds",
    )

    # Кнопка сохранения
    if st.butto
