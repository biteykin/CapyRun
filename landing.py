# landing.py
import streamlit as st
from utils import open_sidebar, set_auth_mode

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
            set_auth_mode("login")      # переключаем радиокнопку в сайдбаре
            open_sidebar()              # принудительно раскрываем сайдбар
            st.toast("Форма входа и регистрации — в сайдбаре слева 👈", icon="🔑")
    with col2:
        if st.button("✨ Зарегистрироваться", use_container_width=True, key="btn_landing_signup"):
            set_auth_mode("signup")     # переключаем радиокнопку в сайдбаре
            open_sidebar()              # принудительно раскрываем сайдбар
            st.toast("Форма входа и регистрации — в сайдбаре слева 👈", icon="✨")

    st.caption("Форма входа и регистрации — в сайдбаре слева 👈")
