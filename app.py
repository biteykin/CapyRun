# app.py — CapyRun (оркестратор)
import streamlit as st
from typing import Any
import pandas as pd
from db_workouts import list_workouts, save_workout, get_workout_by_id
from datetime import datetime

# наши модули
from auth import get_supabase, auth_sidebar, account_block
from profile import load_or_init_profile, profile_sidebar
from landing import render_landing
from views_single import render_single_workout
from views_multi import render_multi_workouts

st.set_page_config(
    page_title="CapyRun — FIT Analyzer",
    page_icon="🏃",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ===== Глобальные стили (немного воздуха и скругления) =====
st.markdown("""
<style>
  .block-container { padding-top: 1.2rem; padding-bottom: 2rem; }
  .stDataFrame { border-radius: 12px; overflow: hidden; }
</style>
""", unsafe_allow_html=True)

# ==== routing helpers ====
def get_route():
    try:
        qp = dict(st.query_params)
    except Exception:
        qp = st.experimental_get_query_params()
    page = qp.get("page"); sub = qp.get("sub")
    if isinstance(page, list): page = page[0]
    if isinstance(sub,  list): sub  = sub[0]
    return (page or "home"), (sub or None)

def set_route(page: str, sub: str = None, **extra):
    params = {"page": page}
    if sub: params["sub"] = sub
    if extra: params.update(extra)
    st.experimental_set_query_params(**params)

def user_display(user) -> str:
    for k in ("email","user_metadata","name","id"):
        try:
            if isinstance(user, dict):
                if k=="user_metadata" and "full_name" in user.get(k, {}): return user[k]["full_name"]
                if user.get(k): return str(user[k])
            else:
                v = getattr(user, k, None)
                if isinstance(v, dict) and "full_name" in v: return v["full_name"]
                if v: return str(v)
        except Exception: pass
    return "Профиль"

def _user_id(u: Any):
    return u.get("id") if isinstance(u, dict) else getattr(u, "id", None)

def _fmt_hhmmss(sec):
    try:
        sec = int(sec or 0)
        h = sec // 3600
        m = (sec % 3600) // 60
        s = sec % 60
        return f"{h:d}:{m:02d}:{s:02d}" if h else f"{m:d}:{s:02d}"
    except Exception:
        return "—"

def _fmt_km(meters):
    try:
        return f"{(float(meters or 0)/1000):.2f} км"
    except Exception:
        return "—"

def _fmt_pace_min_per_km(m_per_s):
    """ожидает скорость м/с → вернёт темп мин/км; если нет данных — '—'"""
    try:
        v = float(m_per_s or 0.0)
        if v <= 0:
            return "—"
        pace_sec = 1000.0 / v  # сек на км
        m = int(pace_sec // 60)
        s = int(round(pace_sec % 60))
        return f"{m}:{s:02d}/км"
    except Exception:
        return "—"

# ===== Subnav helper =====
def render_subnav(page: str, items: list[tuple[str,str]], current_sub: str | None):
    st.markdown("""
    <style>
      .cr-subnav{display:flex;gap:8px;margin:.25rem 0 1rem;}
      .cr-pill button{
        padding:6px 10px !important; border-radius:999px !important;
        background:transparent !important; border:1px solid rgba(0,0,0,0.1) !important;
      }
      .cr-pill button:hover{background:rgba(0,0,0,0.04) !important;}
      .cr-pill.active button{background:#111827 !important; color:#fff !important; border-color:rgba(0,0,0,0.25) !important;}
    </style>
    """, unsafe_allow_html=True)
    st.markdown('<div class="cr-subnav">', unsafe_allow_html=True)
    for sid, label in items:
        cls = "cr-pill active" if current_sub==sid else "cr-pill"
        st.markdown(f'<span class="{cls}">', unsafe_allow_html=True)
        if st.button(label, key=f"sub_{page}_{sid}"):
            set_route(page, sid); st.rerun()
        st.markdown('</span>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

supabase = get_supabase()

with st.sidebar:
    # форма логина видна только когда НЕ авторизован
    user = auth_sidebar(supabase, show_when_authed=False)

    if user:
        # ===== ChatGPT-like, компактный, белые ссылки, меню наверху, профиль в самом низу слева =====
        st.markdown("""
<style>
  :root{
    --sb-bg:#0e0f13; --sb-border:rgba(255,255,255,.08);
    --fg:#e6e6e6; --fg-dim:#b0b0b0;
    --item-hover:rgba(255,255,255,.06); --item-active:rgba(255,255,255,.12);
  }
  section[data-testid="stSidebar"]{
    background:var(--sb-bg);
    border-right:1px solid var(--sb-border);
    font-size:14px;
  }

  /* ===== ВЕРХНИЙ СТИКИ-ХЕДЕР (рядом с иконкой сворачивания) ===== */
  .gpt-header{
    position: sticky; top: 0; z-index: 5;
    background: var(--sb-bg);
    padding: 8px 6px 6px;
    border-bottom: 1px solid var(--sb-border);
  }
  .gpt-brand{
    display:flex; align-items:center; gap:10px;
    color:#fff; font-weight:700; margin:0; /* без лишних отступов */
  }
  .gpt-logo{
    width:26px; height:26px; border-radius:8px;
    display:flex; align-items:center; justify-content:center;
    background:radial-gradient(120px 60px at 20% 20%, #ffffff12 10%, #ffffff08 40%, #0000 70%);
  }

  /* ===== СПИСОК МЕНЮ — плотный, без подчёркиваний ===== */
  .gpt-list{ display:flex; flex-direction:column; gap:2px; margin:8px 4px 0; } /* небольшой отступ после хедера */
  .gpt-item{
    display:flex; align-items:center; gap:8px;
    padding:7px 10px; border-radius:10px;
    text-decoration:none !important; color:var(--fg) !important; background:transparent;
  }
  .gpt-item:visited, .gpt-item:hover, .gpt-item:active{
    text-decoration:none !important; color:var(--fg) !important;
  }
  .gpt-item:hover{ background:var(--item-hover); }
  .gpt-item.active{ background:var(--item-active); color:#fff !important; }

  /* Нижняя маленькая подпись профиля слева */
  .gpt-profile-bottom{
    position:fixed; left:12px; bottom:10px;
    display:flex; align-items:center; gap:8px;
    color:var(--fg-dim); font-size:13px;
  }
  .gpt-ava-sm{ width:22px; height:22px; border-radius:50%; background:#202225;
               display:flex; align-items:center; justify-content:center; font-weight:700; }
</style>
""", unsafe_allow_html=True)

        # — ВЕРХ: бренд в стик-хедере (ровно под иконкой сворачивания)
        st.markdown(
            '<div class="gpt-header"><div class="gpt-brand"><div class="gpt-logo">🏃‍♂️</div><div>CapyRun</div></div></div>',
            unsafe_allow_html=True
        )

        # — МЕНЮ: сразу под брендом, компактный список
        st.markdown('<div class="gpt-list">', unsafe_allow_html=True)
        for pid, icon, label in [
            ("home","🏠","Главная страница"),
            ("goals","🎯","Цели"),
            ("plan","📅","Тренировочный план"),
            ("coach","💬","Общение с тренером"),
            ("workouts","📋","Мои тренировки"),
            ("nutrition","🍽️","Дневник питания"),
            ("profile","👤","Профиль"),
            ("badges","🥇","Бейджи и рекорды"),
        ]:
            active_cls = "active" if get_route()[0] == pid else ""
            href = f"?page={pid}"
            st.markdown(f'<a class="gpt-item {active_cls}" href="{href}"><span>{icon}</span><span>{label}</span></a>',
                        unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

        # — НИЗ: маленькая строка аккаунта слева (без кнопки «Выйти»)
        uname = user_display(user); initials = (uname[:1] if uname else "U").upper()
        st.markdown(f'<div class="gpt-profile-bottom"><div class="gpt-ava-sm">{initials}</div><div>{uname}</div></div>',
                    unsafe_allow_html=True)