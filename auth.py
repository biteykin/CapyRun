# auth.py
from __future__ import annotations
import streamlit as st
from typing import Optional, Dict

# ---- Supabase client ----
try:
    from supabase import create_client, Client  # type: ignore
except Exception:
    create_client = None
    Client = object  # type: ignore

SESSION_USER_KEY = "auth_user"  # единый источник правды

def get_supabase() -> "Client":
    url = st.secrets["supabase"]["url"]
    key = st.secrets["supabase"]["anon_key"]
    if create_client is None:
        raise RuntimeError("supabase lib not installed")
    return create_client(url, key)

# ---- Низкоуровневые действия ----
def _sign_in(supabase: "Client", email: str, password: str) -> Optional[Dict]:
    # Возвращаем лёгкий dict с id/email
    res = supabase.auth.sign_in_with_password({"email": email, "password": password})
    if res and res.user:
        return {"id": res.user.id, "email": res.user.email}
    return None

def _sign_up(supabase: "Client", email: str, password: str) -> Optional[Dict]:
    res = supabase.auth.sign_up({"email": email, "password": password})
    # Некоторые проекты требуют подтверждения email — тогда сразу логина не будет
    # Попробуем получить актуального пользователя из сессии:
    if getattr(res, "user", None):
        return {"id": res.user.id, "email": res.user.email}
    session = supabase.auth.get_session()
    if session and session.user:
        return {"id": session.user.id, "email": session.user.email}
    return None

def _sign_out(supabase: "Client") -> None:
    try:
        supabase.auth.sign_out()
    except Exception:
        pass

# ---- Главная функция сайдбара ----
def auth_sidebar(supabase: "Client") -> Optional[Dict]:
    """
    Рендерит ИЛИ форму логина/регистрации, ИЛИ блок профиля.
    Возвращает объект пользователя (dict) при авторизации, иначе None.
    """
    # единый placeholder — сюда кладём форму ИЛИ профиль
    box = st.empty()

    user = st.session_state.get(SESSION_USER_KEY)
    if user:
        with box.container():
            st.markdown("### Аккаунт")
            st.markdown(f"Вы: **{user.get('email','')}**")
            if st.button("Выйти", use_container_width=True, key="btn_logout"):
                # чистим локальное состояние формы, выходим из Supabase и перерисовываемся
                for k in ("auth_mode", "auth_email", "auth_password"):
                    st.session_state.pop(k, None)
                st.session_state[SESSION_USER_KEY] = None
                _sign_out(supabase)
                st.rerun()
        return user

    # --- Если не авторизован: показываем форму ---
    with box.container():
        st.markdown("### Аккаунт")
        mode = st.radio("Режим", ["Вход", "Регистрация"], horizontal=True, key="auth_mode")
        email = st.text_input("Email", key="auth_email")
        password = st.text_input("Пароль", type="password", key="auth_password")

        if mode == "Регистрация":
            do = st.button("Создать аккаунт", use_container_width=True, key="btn_signup")
            if do:
                new_user = _sign_up(supabase, email.strip(), password)
                if new_user:
                    st.session_state[SESSION_USER_KEY] = new_user
                    # очищаем поля, чтобы форма не «всплывала» из-за state
                    for k in ("auth_mode", "auth_email", "auth_password"):
                        st.session_state.pop(k, None)
                    st.success("Аккаунт создан. Вы вошли.")
                    st.rerun()
                else:
                    st.warning("Проверьте почту для подтверждения или попробуйте войти.")
        else:
            do = st.button("Войти", use_container_width=True, key="btn_login")
            if do:
                signed = _sign_in(supabase, email.strip(), password)
                if signed:
                    st.session_state[SESSION_USER_KEY] = signed
                    for k in ("auth_mode", "auth_email", "auth_password"):
                        st.session_state.pop(k, None)
                    st.rerun()
                else:
                    st.error("Неверный email или пароль.")

    return None
