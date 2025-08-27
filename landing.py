# landing.py
import streamlit as st
from utils import open_sidebar, set_auth_mode

def _switch_and_focus(mode: str, toast_icon: str):
    # 1) запоминаем желаемый режим для сайдбара
    if mode not in ("login", "signup"):
        mode = "login"
    st.session_state["auth_mode"] = mode
    st.session_state["_just_switched_auth"] = True

    # 2) раскрываем сайдбар
    open_sidebar()

    # 3) подсказка
    st.toast("Форма входа и регистрации — в сайдбаре слева 👈", icon=toast_icon)

    # 4) мгновенная перерисовка, чтобы радио в сайдбаре стало в нужное положение
    st.rerun()

def render_landing() -> None:
    st.markdown("# CapyRun — AI-тренер для бега и фитнеса 🧠🏃‍♂️")
    st.markdown(
        "Отслеживай тренировки, смотри понятные графики и получай персональные советы, "
        "как стать быстрее и выносливее."
    )

    st.markdown("### Что умеет CapyRun")
    st.markdown(
        "- 📈 Графики темпа, пульса и зон — без воды, только суть.\n"
        "- 🧭 Персональные рекомендации по твоим данным — что улучшить уже на следующем забеге.\n"
        "- ❤️ Зоны ЧСС: авторасчёт и разбор, где ты «жёг», а где «работал базу».\n"
        "- 🎯 Цели и прогресс: видно рост и узкие места.\n"
        "- ⚙️ Импорт `.fit`: загрузи — и получи аналитику за минуты.\n"
        "- 🔒 Приватность: авторизация и хранение на Supabase."
    )

    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("🔑 Войти", use_container_width=True, key="btn_landing_login"):
            _switch_and_focus("login", "🔑")
    with col2:
        if st.button("✨ Зарегистрироваться", use_container_width=True, key="btn_landing_signup"):
            _switch_and_focus("signup", "✨")

    st.caption("Форма входа и регистрации — в сайдбаре слева 👈")
