import streamlit as st

def render_landing() -> None:
    st.set_page_config(page_title="CapyRun — AI-тренер", layout="wide", initial_sidebar_state="expanded")

    st.markdown("# CapyRun — AI-тренер для бега и фитнеса 🧠🏃‍♂️")
    st.markdown(
        "Отслеживай тренировки, смотри понятные графики и получай персональные советы, "
        "как стать быстрее и выносливее."
    )

    st.markdown("### Что умеет CapyRun")
    st.markdown(
        "- 📈 Графики темпа, пульса и зон — без воды, только суть.\n"
        "- 🧭 Персональные рекомендации на основе твоих данных — что подтянуть уже на следующем забеге.\n"
        "- ❤️ Зоны ЧСС: авторасчёт и разбор, где ты «жёг», а где «работал базу».\n"
        "- 🎯 Цели и прогресс: видно рост и узкие места.\n"
        "- ⚙️ Импорт `.fit`: загрузи — и получи аналитику за минуты.\n"
        "- 🔒 Приватность: авторизация и хранение на Supabase."
    )

    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("🔑 Войти", use_container_width=True):
            st.session_state["auth_intent"] = "login"
            st.toast("Открой сайдбар справа и войди", icon="🔑")
    with col2:
        if st.button("✨ Зарегистрироваться", use_container_width=True):
            st.session_state["auth_intent"] = "signup"
            st.toast("Открой сайдбар справа и зарегистрируйся", icon="✨")

    st.caption("Форма входа и регистрации — в сайдбаре справа ↑")
