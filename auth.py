# auth.py
from __future__ import annotations
import re
from typing import Optional, Dict, Any
import streamlit as st

# --- Supabase client ---
try:
    from supabase import create_client, Client  # type: ignore
except Exception:
    create_client = None
    Client = object  # type: ignore

SESSION_USER_KEY = "auth_user"

def get_supabase() -> "Client":
    url = st.secrets["supabase"]["url"]
    key = st.secrets["supabase"]["anon_key"]
    if create_client is None:
        raise RuntimeError("supabase lib not installed")
    return create_client(url, key)

# --- helpers ---
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

def _current_user(supabase) -> Optional[Dict[str, Any]]:
    """Надёжно достаём текущего пользователя из сессии/кеша."""
    # 1) session
    try:
        sess = supabase.auth.get_session()
        if sess and getattr(sess, "user", None):
            return {"id": sess.user.id, "email": sess.user.email}
    except Exception:
        pass
    # 2) get_user
    try:
        gu = supabase.auth.get_user()
        if gu and getattr(gu, "user", None):
            return {"id": gu.user.id, "email": gu.user.email}
    except Exception:
        pass
    # 3) session_state
    u = st.session_state.get(SESSION_USER_KEY)
    if isinstance(u, dict) and u.get("id"):
        return u
    return None

def _normalize_user(u: Any) -> Optional[Dict[str, Any]]:
    if not u:
        return None
    # supabase python SDK возвращает объекты с полями .user или .id
    if hasattr(u, "user") and getattr(u, "user", None):
        return {"id": u.user.id, "email": u.user.email}
    if hasattr(u, "id") and hasattr(u, "email"):
        return {"id": u.id, "email": u.email}
    if isinstance(u, dict):
        if u.get("id") and u.get("email") is not None:
            return {"id": u["id"], "email": u.get("email")}
    return None

# --- low-level auth actions with safe error handling ---
def _sign_in(supabase, email: str, password: str) -> tuple[Optional[Dict], Optional[str]]:
    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        user = _normalize_user(getattr(res, "user", None)) or _normalize_user(res)
        if user:
            return user, None
        # иногда сессия не в res, пробуем вытащить после логина
        user2 = _current_user(supabase)
        return (user2, None) if user2 else (None, "Не удалось войти. Проверьте email/пароль.")
    except Exception as e:
        return None, "Неверный email или пароль."

def _sign_up(supabase, email: str, password: str) -> tuple[Optional[Dict], Optional[str], bool]:
    """
    Возвращает: (user, error, needs_confirmation)
    needs_confirmation=True, если включено подтверждение email и сессии пока нет.
    """
    # клиентская валидация
    if not EMAIL_RE.match(email):
        return None, "Некорректный email.", False
    if len(password) < 6:
        return None, "Пароль слишком короткий (минимум 6 символов).", False

    try:
        res = supabase.auth.sign_up({"email": email, "password": password})
        # Если включён autoconfirm=OFF и нужен клик по письму:
        # обычно res.user есть, но сессии нет. Проверим текущего пользователя:
        user_now = _current_user(supabase)
        if user_now:
            return user_now, None, False
        user_norm = _normalize_user(getattr(res, "user", None)) or _normalize_user(res)
        # если пользователя нет в сессии, но sign_up прошёл — скорее всего, требуется подтверждение
        if user_norm and not user_now:
            return user_norm, None, True
        if not user_norm:
            return None, "Регистрация не завершена. Проверьте письмо для подтверждения.", True
        return user_norm, None, False
    except Exception as e:
        # аккуратная расшифровка частых кейсов
        msg = f"{e}"
        if "weak password" in msg.lower():
            return None, "Пароль слишком слабый. Минимум 6 символов.", False
        if "User already registered" in msg or "already registered" in msg.lower():
            return None, "Такой email уже зарегистрирован. Попробуйте войти.", False
        return None, "Не удалось создать аккаунт. Проверьте email/пароль или настройки почты.", False

def _sign_out(supabase) -> None:
    try:
        supabase.auth.sign_out()
    except Exception:
        pass

# --- main sidebar UI ---
def auth_sidebar(supabase: "Client") -> Optional[Dict[str, Any]]:
    """
    Сайдбар: либо форма, либо блок аккаунта.
    Корректно обрабатывает подтверждение email и ошибки пароля.
    """
    box = st.empty()
    user = _current_user(supabase)

    if user:
        with box.container():
            st.markdown("### Аккаунт")
            st.markdown(f"Вы: **{user.get('email','')}**")
            if st.button("Выйти", use_container_width=True, key="btn_logout"):
                for k in ("auth_mode", "auth_email", "auth_password"):
                    st.session_state.pop(k, None)
                st.session_state[SESSION_USER_KEY] = None
                _sign_out(supabase)
                st.rerun()
        st.session_state[SESSION_USER_KEY] = user
        return user

    with box.container():
        st.markdown("### Аккаунт")
        mode = st.radio("Режим", ["Вход", "Регистрация"], horizontal=True, key="auth_mode")
        email = st.text_input("Email", key="auth_email")
        password = st.text_input("Пароль", type="password", key="auth_password")

        if mode == "Регистрация":
            if st.button("Создать аккаунт", use_container_width=True, key="btn_signup"):
                user_new, err, needs_conf = _sign_up(supabase, email.strip(), password)
                if user_new:
                    st.session_state[SESSION_USER_KEY] = user_new
                    st.success("Аккаунт создан.")
                    st.rerun()
                elif needs_conf and not err:
                    st.info("Мы отправили письмо для подтверждения. Перейдите по ссылке и затем войдите.")
                else:
                    st.error(err or "Не удалось создать аккаунт.")
        else:
            if st.button("Войти", use_container_width=True, key="btn_login"):
                user_signed, err = _sign_in(supabase, email.strip(), password)
                if user_signed:
                    st.session_state[SESSION_USER_KEY] = user_signed
                    st.rerun()
                else:
                    st.error(err or "Не удалось войти.")

    return None
