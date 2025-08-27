# landing.py
import streamlit as st
from utils import open_sidebar

def _switch_and_focus(mode: str, toast_icon: str):
    st.session_state["auth_mode"] = mode if mode in ("login", "signup") else "login"
    st.session_state["_just_switched_auth"] = True
    open_sidebar()
    st.toast("Форма входа и регистрации — в сайдбаре слева 👈", icon=toast_icon)
    st.rerun()

def render_landing() -> None:
    st.markdown(
        """# CapyRun — AI-тренер для бега и фитнеса 🧠🏃‍♂️
Отслеживай тренировки, смотри понятные графики и получай персональные советы, как стать быстрее и выносливее.

### Что умеет CapyRun
- 📈 Графики темпа, пульса и зон — без воды, только суть.
- 🧭 Персональные рекомендации по твоим данным — что улучшить уже на следующем забеге.
- ❤️ Зоны ЧСС: авторасчёт и разбор, где ты «жёг», а где «работал базу».
- 🎯 Цели и прогресс: видно рост и узкие места.
- ⚙️ Импорт `.fit`: загрузи — и получи аналитику за минуты.
- 🔒 Приватность: авторизация и хранение на Supabase.
"""
    )

    col1, col2 = st.columns(2)
    if col1.button("🔑 Войти", use_container_width=True, key="btn_landing_login"):
        _switch_and_focus("login", "🔑")
    if col2.button("✨ Зарегистрироваться", use_container_width=True, key="btn_landing_signup"):
        _switch_and_focus("signup", "✨")

    st.caption("Форма входа и регистрации — в сайдбаре слева 👈")
