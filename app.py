# app.py — CapyRun (оркестратор)
import streamlit as st
from typing import Any

# наши модули
from auth import get_supabase, auth_sidebar, account_block
from profile import load_or_init_profile, profile_sidebar
from landing import render_landing
from views_single import render_single_workout
from views_multi import render_multi_workouts

st.set_page_config(
    page_title="CapyRun — FIT Analyzer",
    page_icon="🏃",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("🏃 CapyRun — FIT Analyzer")
st.caption("Загрузи один или несколько .fit → отчёт / прогресс / план + календарь (ICS) + Excel")

def _user_id(u: Any):
    return u.get("id") if isinstance(u, dict) else getattr(u, "id", None)

supabase = get_supabase()

# --- Сайдбар: только auth + профиль (НИКАКИХ render_landing() внутри!) ---
with st.sidebar:
    user = auth_sidebar(supabase, show_when_authed=False)
    if user:
        profile_row = load_or_init_profile(supabase, _user_id(user))
        hr_rest, hr_max, zone_bounds_text = profile_sidebar(supabase, user, profile_row)
        st.divider()
        account_block(supabase, user)

# --- Если не залогинен — рисуем лендинг В ОСНОВНОЙ ОБЛАСТИ и выходим ---
if not user:
    render_landing()
    st.stop()

# --- Основной контент (после авторизации) ---
uploaded_files = st.file_uploader("Загрузите FIT-файл(ы)", type=["fit"], accept_multiple_files=True)

if not uploaded_files:
    st.info("Загрузи один или несколько .fit файлов, чтобы увидеть отчёт/прогресс.")
else:
    if len(uploaded_files) == 1:
        render_single_workout(
            file=uploaded_files[0],
            supabase=supabase,
            user_id=_user_id(user),
            hr_rest=hr_rest,
            hr_max=hr_max,
            zone_bounds_text=zone_bounds_text,
        )
    else:
        render_multi_workouts(
            files=uploaded_files,
            supabase=supabase,
            user_id=_user_id(user),
            hr_rest=hr_rest,
            hr_max=hr_max,
        )
