# auth.py
import os
import streamlit as st
from supabase import create_client, Client

def _read_supabase_creds():
    """Читает URL/KEY из st.secrets или ENV. Возвращает (url, key) либо (None, None)."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    try:
        # Попытка из secrets (перекрывает ENV, если есть)
        if "supabase" in st.secrets:
            sb = st.secrets["supabase"]
            # у st.secrets вложенные объекты ведут себя как dict
            url = sb.get("url", url)
            key = sb.get("key", key)
    except Exception:
        # ничего — просто останемся на ENV/None
        pass
    return url, key

def get_supabase() -> Client:
    url, key = _read_supabase_creds()
    if not url or not key:
        st.error(
            "Supabase не сконфигурирован. "
            "Добавь секреты **supabase.url** и **supabase.key** или ENV `SUPABASE_URL`/`SUPABASE_KEY`."
        )
        st.caption("Пример secrets.toml:\n\n"
                   "[supabase]\nurl = \"https://YOUR_PROJECT.supabase.co\"\nkey = \"YOUR_SERVICE_OR_ANON_KEY\"")
        st.stop()
    return create_client(url, key)

def auth_sidebar(supabase: Client, show_when_authed: bool = False):
    # ... твоя текущая реализация (без изменений) ...
    # здесь логин/регистрация и возврат user
    ...

def account_block(supabase: Client, user):
    # ... как у тебя было ...
    ...
