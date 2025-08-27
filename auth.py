import os
import streamlit as st
from supabase import create_client, Client

# =========================================================
# Чтение конфигурации
# =========================================================
def _read_supabase_creds():
    """Читает URL/KEY из st.secrets или ENV. Возвращает (url, key) либо (None, None)."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    try:
        if "supabase" in st.secrets:
            sb = st.secrets["supabase"]
            # st.secrets["supabase"] ведёт себя как dict
            url = sb.get("url", url)
            key = sb.get("key", key)
    except Exception:
        pass
    return url, key


def get_supabase() -> Client:
    url, key = _read_supabase_creds()
    if not url or not key:
        st.error(
            "⚠️ Supabase не сконфигурирован.\n\n"
            "Добавь секреты `[supabase] url/key` в `.streamlit/secrets.toml` "
            "или ENV `SUPABASE_URL` / `SUPABASE_KEY`."
        )
        st.caption(
            "Пример `.streamlit/secrets.toml`:\n\n"
            "[supabase]\n"
            "url = \"https://YOUR_PROJECT.supabase.co\"\n"
            "key = \"YOUR_ANON_OR_SERVICE_KEY\""
        )
        st.stop()
    return create_client(url, key)

# =========================================================
# Авторизация
# =========================================================
def auth_sidebar(supabase: Client, show_when_authed: bool = False):
    """Отрисовывает форму входа/регистрации в сайдбаре и возвращает user либо None.
       Режим ('login' | 'signup') синхронизируется через st.session_state['auth_mode'].
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
                    st.session_state["auth_mode"] = "login"  # после регистрации показываем форму входа
                    st.experimental_rerun()
            except Exception as e:
                st.error("Не удалось создать аккаунт.")
                st.caption(str(e))

    return session.user if session else None

# =========================================================
# Блок аккаунта в сайдбаре (ниже профиля)
# =========================================================
def account_block(supabase: Client, user):
    st.markdown("### 👤 Аккаунт")
    st.caption(f"Вы вошли как **{user.email}**")
    if st.button("Выйти", use_container_width=True):
        supabase.auth.sign_out()
        st.experimental_rerun()
