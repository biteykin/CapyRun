# --- в auth.py ---

# ... импорты и остальной код остаются ...

def account_block(supabase, user):
    """Небольшой блок аккаунта c кнопкой выхода (без формы)."""
    st.markdown("### Аккаунт")
    st.markdown(f"Вы: **{user.get('email','')}**")
    if st.button("Выйти", use_container_width=True, key="btn_logout"):
        for k in ("auth_mode", "auth_email", "auth_password"):
            st.session_state.pop(k, None)
        st.session_state["auth_user"] = None
        try:
            supabase.auth.sign_out()
        except Exception:
            pass
        st.rerun()

def auth_sidebar(supabase, show_when_authed: bool = True):
    """
    Если пользователь не авторизован — рисуем форму и возвращаем None.
    Если авторизован:
      - при show_when_authed=True: рисуем блок аккаунта и возвращаем user
      - при show_when_authed=False: НИЧЕГО не рисуем, просто возвращаем user
    """
    box = st.empty()

    # достаём текущего пользователя как раньше
    user = _current_user(supabase)
    if user:
        st.session_state["auth_user"] = user
        if not show_when_authed:
            return user
        with box.container():
            account_block(supabase, user)
        return user

    # --- форма логина/регистрации (как было) ---
    with box.container():
        st.markdown("### Аккаунт")
        mode = st.radio("Режим", ["Вход", "Регистрация"], horizontal=True, key="auth_mode")
        email = st.text_input("Email", key="auth_email")
        password = st.text_input("Пароль", type="password", key="auth_password")

        if mode == "Регистрация":
            if st.button("Создать аккаунт", use_container_width=True, key="btn_signup"):
                user_new, err, needs_conf = _sign_up(supabase, email.strip(), password)
                if user_new:
                    st.session_state["auth_user"] = user_new
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
                    st.session_state["auth_user"] = user_signed
                    st.rerun()
                else:
                    st.error(err or "Не удалось войти.")
    return None
