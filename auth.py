# auth.py
import streamlit as st
from supabase import create_client, Client

_SB_URL = st.secrets["supabase"]["url"]
_SB_KEY = st.secrets["supabase"]["key"]

def get_supabase() -> Client:
    return create_client(_SB_URL, _SB_KEY)

def auth_sidebar(supabase: Client, show_when_authed: bool = False):
    """Отрисовывает форму входа/регистрации в сайдбаре и возвращает user либо None.
       Режим ('Вход'|'Регистрация') синхронизируется через st.session_state['auth_mode'].
    """
    session = supabase.auth.get_session()
    user = session.user if session else None

    # Если уже залогинен
    if user and not show_when_authed:
        st.markdown("### Аккаунт")
        st.caption(f"Вы вошли как **{user.email}**")
        if st.button("Выйти", use_container_width=True):
            supabase.auth.sign_out()
            st.experimental_rerun()
        return user

    st.markdown("### Вход / Регистрация")

    # --- режим по умолчанию и синхронизация с лендингом ---
    default_mode = st.session_state.get("auth_mode", "login")
    modes = {"Вход": "login", "Регистрация": "signup"}

    # Выставляем индекс по текущему режиму
    mode_names = list(modes.keys())
    current_index = 0 if modes[mode_names[0]] == default_mode else 1

    chosen = st.radio(
        "Режим",
        mode_names,
        index=current_index,
        horizontal=True,
        label_visibility="collapsed",
    )
    # Если пользователь сам переключил радио — обновим session_state
    st.session_state["auth_mode"] = modes[chosen]

    # --- формы ---
    if st.session_state["auth_mode"] == "login":
        with st.form("auth_login", clear_on_submit=False):
            email = st.text_input("Email", key="auth_email_login")
            password = st.text_input("Пароль", type="password", key="auth_pwd_login")
            submit = st.form_submit_button("Войти", use_container_width=True)
        if submit:
            try:
                res = supabase.auth.sign_in_with_password({"email": email, "password": password})
                if res.user:
                    st.success("Готово! Форма входа и регистрации — в сайдбаре слева 👈")
                    st.experimental_rerun()
            except Exception as e:
                st.error("Не удалось войти. Проверьте данные.")
                st.caption(str(e))
    else:
        with st.form("auth_signup", clear_on_submit=False):
            email = st.text_input("Email", key="auth_email_signup")
            password = st.text_input("Пароль", type="password", key="auth_pwd_signup")
            submit = st.form_submit_button("Создать аккаунт", use_container_width=True)
        if submit:
            try:
                res = supabase.auth.sign_up({"email": email, "password": password})
                if res.user:
                    st.success("Аккаунт создан! Форма входа и регистрации — в сайдбаре слева 👈")
                    # После регистрации логика может требовать подтверждение email.
                    # Оставим режим на 'login', чтобы было видно форму входа.
                    st.session_state["auth_mode"] = "login"
                    st.experimental_rerun()
            except Exception as e:
                st.error("Не удалось создать аккаунт.")
                st.caption(str(e))

    return session.user if session else None
