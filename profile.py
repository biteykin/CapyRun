# capyrun/profile.py
import streamlit as st

def load_or_init_profile(supabase, user_id: str):
    """Грузим профиль; если нет — создаём с дефолтами и возвращаем."""
    try:
        resp = supabase.table("user_profiles").select("*").eq("id", user_id).single().execute()
        row = resp.data
    except Exception:
        row = None
    if not row:
        row = {"id": user_id, "hr_rest": 60, "hr_max": 190, "zone_bounds": "120,140,155,170,185"}
        supabase.table("user_profiles").insert(row).execute()
    return row

def profile_sidebar(supabase, user, profile_row):
    """UI блока параметров атлета + сохранение. Возвращает (hr_rest, hr_max, zone_bounds)."""
    st.header("⚙️ Параметры анализа")

    hr_rest = st.number_input("Пульс в покое (HRrest)", 30, 100, int(profile_row.get("hr_rest", 60)), 1)
    hr_max  = st.number_input("Макс. пульс (HRmax)", 140, 220, int(profile_row.get("hr_max", 190)), 1)
    zone_bounds = st.text_input("Границы зон HR (уд/мин, через запятую)",
                                value=profile_row.get("zone_bounds", "120,140,155,170,185"))
    if st.button("💾 Сохранить профиль"):
        supabase.table("user_profiles").update({
            "hr_rest": int(hr_rest),
            "hr_max": int(hr_max),
            "zone_bounds": zone_bounds
        }).eq("id", user.id).execute()
        st.success("Профиль сохранён")

    return int(hr_rest), int(hr_max), zone_bounds
