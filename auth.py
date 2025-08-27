# capyrun/auth.py
from typing import Optional
import streamlit as st
from supabase import create_client, Client

# Создаём клиент один раз (кэшируется между перезапусками)
@st.cache_resource
def get_supabase() -> Client:
    url = st.secrets["supabase"]["url"]
    key = st.secrets["supabase"]["anon_key"]
    return create_client(url, key)

def auth_sidebar(supabase: Client):
    """
    Рисует блок авторизации в сайдбаре и возвращает текущего пользователя (или None).
    Сохраняет пользователя в st.session_state["sb_user"].
    """
    st.subheader("👤 Аккаунт")

    if "sb_user" not in st.session_state:
        st.session_state.sb_user = None

    mode = st.radio("Режим", ["Вход", "Регистрация"], horizontal=True)

    if mode == "Вход":
        email = st.text_input("Email", key="login_email")
        password = st.text_input("Пароль", type="password", key="login_pwd")
        if st.button("Войти"):
            try:
                res = supabase.auth.sign_in_with_password({"email": email, "password": password})
                st.session_state.sb_user = res.user
                st.success("Вошли")
                st.experimental_rerun()
            except Exception as e:
                st.error(f"Ошибка входа: {e}")

    else:
        email = st.text_input("Email", key="signup_email")
        password = st.text_input("Пароль", type="password", key="signup_pwd")
        if st.button("Создать аккаунт"):
            try:
                supabase.auth.sign_up({"email": email, "password": password})
                st.success("Аккаунт создан. Теперь войдите во вкладке «Вход».")
            except Exception as e:
                st.error(f"Ошибка регистрации: {e}")

    user = st.session_state.sb_user
    if user:
        st.caption(f"Вы: {user.email}")
        if st.button("Выйти"):
            supabase.auth.sign_out()
            st.session_state.sb_user = None
            st.experimental_rerun()

    return user
