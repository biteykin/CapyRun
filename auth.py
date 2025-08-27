# auth.py
from __future__ import annotations
import re
import os
from typing import Optional, Dict, Any
import streamlit as st

# --- Supabase client (lazy import-friendly) ---
try:
    from supabase import create_client, Client  # type: ignore
except Exception:
    create_client = None
    Client = object  # type: ignore

SESSION_USER_KEY = "auth_user"
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def get_supabase() -> "Client":
    """Создаёт клиент Supabase, читая конфиг из st.secrets или ENV."""
    url = None
    key = None

    try:
        if "supabase" in st.secrets:
            sb = st.secrets["supabase"]
            url = sb.get("url")
            key = sb.get("anon_key") or sb.get("key")
    except Exception:
        pass

    url = url or os.getenv("SUPABASE_URL")
    key = key or os.getenv("SUPABASE_KEY")

    if not url or not key:
        st.error(
            "⚠️ Supabase не сконфигурирован. Добавь `[supabase] url` и `anon_key` (или `key`) "
            "в `.streamlit/secrets.toml` или ENV `SUPABASE_URL` / `SUPABASE_KEY`."
        )
        st.stop()

    if create_client is None:
        st.error("Библиотека `supabase` не установлена. Установи пакет `supabase`.")
        st.stop()

    return create_client(url, key)


# ---------- helpers ----------
def _current_user(supabase) -> Optional[Dict[str, Any]]:
    try:
        sess = supabase.auth.get_session()
        if sess and getattr(sess, "user", None):
            return {"id": sess.user.id, "email": sess.user.email}
    except Exception:
        pass
    try:
        gu = supabase.auth.get_user()
        if gu and getattr(gu, "user", None):
            return {"id": gu.user.id, "email": gu.user.email}
    except Exception:
        pass
    u = st.session_state.get(SESSION_USER_KEY)
    return u if isinstance(u, dict) and u.get("id") else None


def _normalize_user(u: Any) -> Optional[Dict[str, Any]]:
    if not u:
        return None
    if hasattr(u, "user") and getattr(u, "user", None):
        return {"id": u.user.id, "email": u.user.email}
    if hasattr(u, "id") and hasattr(u, "email"):
        return {"id": u.id, "email": u.email}
    if isinstance(u, dict) and u.get("id") is not None:
        return {"id": u["id"], "email": u.get("email")}
    return None


def _sign_out(supabase) -> None:
    try:
        supabase.auth.sign_out()
    except Exception:
        pass


# ---------- low-level auth with safe errors ----------
def _sign_in(supabase, email: str, password: str) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        user = _normalize_user(getattr(res, "user", None)) or _normalize_user(res) or _current_user(supabase)
        return (user, None) if user else (None, "Неверный email или пароль.")
    except Exception:
        return None, "Неверный email или пароль."


def _sign_up(supabase, email: str, password: str) -> tuple[Optional[Dict[str, Any]], Optional[str], bool]:
    if not EMAIL_RE.match(email):
        return None, "Некорректный email.", False
    if len(password) < 6:
        return None, "Пароль слишком короткий (минимум 6 символов).", False
    try:
        res = supabase.auth.sign_up({"email": email, "password": password})
        user_now = _current_user(supabase)
        if user_now:
            return user_now, None, False
        user_norm = _normalize_user(getattr(res, "user", None)) or _normalize_user(res)
        return (user_norm, None, True) if not user_now else (user_norm, None, False)
    except Exception as e:
        msg = f"{e}".lower()
        if "weak password" in msg:
            return None, "Пароль слишком слабый. Минимум 6 символов.", False
        if "already registered" in msg:
            return None, "Такой email уже зарегистрирован. Попробуйте войти.", False
        return None, "Не удалось создать аккаунт. Проверьте email/пароль или настройки почты.", False


# ---------- UI blocks ----------
def account_block(supabase, user: Dict[str, Any]) -> None:
    st.markdown("### 👤 Аккаунт")
    st.markdown(f"Вы: **{user.get('email','')}**")
    if st.button("Выйти", use_container_width=True, key="btn_logout"):
        for k in ("auth_mode", "auth_email", "auth_password"):
            st.session_state.pop(k, None)
        st.session_state[SESSION_USER_KEY] = None
        _sign_out(supabase)
        st.rerun()


def auth_sidebar(supabase, show_when_authed: bool = True) -> Optional[Dict[str, Any]]:
    """
    - Если не авторизован — рисует форму, возвращает None.
    - Если авторизован:
        * show_when_authed=True  -> рисует account_block и возвращает user
        * show_when_authed=False -> ничего не рисует, просто возвращает user
    """
    box = st.empty()
    user = _current_user(supabase)
    if user:
        st.session_state[SESSION_USER_KEY] = user
        if not show_when_authed:
            return user
        with box.container():
            account_block(supabase, user)
        return user

    # --- Не авторизован: форма ---
    with box.container():
        st.markdown("### Вход / Регистрация")

        # режим извне: "login" | "signup"
        external_mode = st.session_state.get("auth_mode", "login")
        label_for_external = "Вход" if external_mode == "login" else "Регистрация"

        # если только что переключили на лендинге → подставим в радио
        if st.session_state.get("_just_switched_auth"):
            st.session_state["auth_mode_radio"] = label_for_external
            st.session_state["_just_switched_auth"] = False

        mode_label = st.radio(
            "Режим",
            ["Вход", "Регистрация"],
            key="auth_mode_radio",
            horizontal=True,
            label_visibility="collapsed",
        )

        # двунаправленная синхронизация
        st.session_state["auth_mode"] = "login" if mode_label == "Вход" else "signup"

        email = st.text_input("Email", key="auth_email")
        password = st.text_input("Пароль", type="password", key="auth_password")

        if st.session_state["auth_mode"] == "signup":
            if st.button("Создать аккаунт", use_container_width=True, key="btn_signup"):
                user_new, err, needs_conf = _sign_up(supabase, email.strip(), password)
                if user_new:
                    st.session_state[SESSION_USER_KEY] = user_new
                    st.success("Аккаунт создан! Форма входа и регистрации — в сайдбаре слева 👈")
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
                    st.success("Готово! Форма входа и регистрации — в сайдбаре слева 👈")
                    st.rerun()
                else:
                    st.error(err or "Не удалось войти.")

    return None
