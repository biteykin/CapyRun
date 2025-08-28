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

# ===== Routing helpers =====
def get_route():
    try:
        qp = dict(st.query_params)
    except Exception:
        qp = st.experimental_get_query_params()
    page = qp.get("page", ["home"])[0] if isinstance(qp.get("page"), list) else qp.get("page", "home")
    sub = qp.get("sub", [None])[0] if isinstance(qp.get("sub"), list) else qp.get("sub", None)
    return page or "home", sub

def set_route(page: str, sub: str = None):
    try:
        if sub:
            st.query_params.update({"page": page, "sub": sub})
        else:
            st.query_params.update({"page": page})
            st.query_params.pop("sub", None)
    except Exception:
        if sub:
            st.experimental_set_query_params(page=page, sub=sub)
        else:
            st.experimental_set_query_params(page=page)

st.title("🏃 CapyRun — FIT Analyzer")
st.caption("Загрузи один или несколько .fit → отчёт / прогресс / план + календарь (ICS) + Excel")

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

supabase = get_supabase()

# --- Сайдбар: только auth + профиль (НИКАКИХ render_landing() внутри!) ---
with st.sidebar:
    user = auth_sidebar(supabase, show_when_authed=False)
    if user:
        profile_row = load_or_init_profile(supabase, _user_id(user))
        hr_rest, hr_max, zone_bounds_text = profile_sidebar(supabase, user, profile_row)
        st.divider()
        account_block(supabase, user)

        # ====== NAVIGATION ======
        st.markdown("### 🧭 Навигация")

        def nav_btn(label, page, sub=None, key=None, icon=""):
            if st.button(f"{icon} {label}", key=key or f"nav_{page}_{sub or 'root'}"):
                set_route(page, sub)
                st.rerun()

        # Главная
        nav_btn("Главная страница", "home", icon="🏠")

        # Мои тренировки
        with st.expander("Мои тренировки", expanded=True):
            nav_btn("Список тренировок", "workouts", "list", icon="📋")
            nav_btn("Фильтры", "workouts", "filters", icon="🔎")
            nav_btn("Добавить тренировку", "workouts", "add", icon="➕")

        # Цели
        with st.expander("Цели", expanded=False):
            nav_btn("Мои цели", "goals", "overview", icon="🎯")

        # План
        with st.expander("Тренировочный план", expanded=False):
            nav_btn("План", "plan", "overview", icon="📅")

        # Общение
        with st.expander("Общение с тренером", expanded=False):
            nav_btn("Чат с тренером", "coach", "chat", icon="💬")

        # Питание
        with st.expander("Дневник питания", expanded=False):
            nav_btn("История", "nutrition", "history", icon="🍽️")
            nav_btn("Калории", "nutrition", "calories", icon="🔥")
            nav_btn("Фильтры", "nutrition", "filters", icon="🧮")
            nav_btn("Добавить приём пищи", "nutrition", "add", icon="➕")

        # Профиль
        with st.expander("Профиль", expanded=False):
            nav_btn("Данные пользователя", "profile", "data", icon="👤")
            nav_btn("Логин", "profile", "login", icon="🔐")
            nav_btn("Промо-код", "profile", "promo", icon="🏷️")
            nav_btn("Деавторизация", "profile", "logout", icon="🚪")

        # Бейджи
        with st.expander("Бейджи и рекорды", expanded=False):
            nav_btn("Мои бейджи", "badges", "overview", icon="🥇")

# --- Если не залогинен — лендинг и выходим ---
if not user:
    render_landing()
    st.stop()

uid = _user_id(user)
if not uid:
    st.error("Не удалось определить user_id. Перелогинься, пожалуйста.")
    st.stop()

# ====== ROUTER ======
page, sub = get_route()

if page == "home":
    render_home_page(supabase, uid)

elif page == "workouts":
    if sub == "list" or sub is None:
        render_workouts_list(supabase, uid)
    elif sub == "filters":
        render_workouts_filters(supabase, uid)
    elif sub == "add":
        render_workouts_add(supabase, uid, hr_rest, hr_max, zone_bounds_text)
    elif sub == "detail":
        qp = dict(st.query_params)
        workout_id = qp.get("workout_id")
        if isinstance(workout_id, list):
            workout_id = workout_id[0]
        render_workout_detail_view(supabase, user_id=uid, workout_id=workout_id)

elif page == "goals":
    render_goals_overview(supabase, uid)

elif page == "plan":
    render_plan_overview(supabase, uid)

elif page == "coach":
    render_coach_chat(supabase, uid)

elif page == "nutrition":
    if sub == "history" or sub is None:
        render_nutrition_history(supabase, uid)
    elif sub == "calories":
        render_nutrition_calories(supabase, uid)
    elif sub == "filters":
        render_nutrition_filters(supabase, uid)
    elif sub == "add":
        render_nutrition_add(supabase, uid)

elif page == "profile":
    if sub == "data" or sub is None:
        render_profile_data(supabase, uid)
    elif sub == "login":
        render_profile_login(supabase, uid)
    elif sub == "promo":
        render_profile_promo(supabase, uid)
    elif sub == "logout":
        render_profile_logout(supabase, uid)

elif page == "badges":
    render_badges_overview(supabase, uid)

else:
    st.error("Страница не найдена")

# ====== PAGES ======

def render_home_page(supabase, uid: str):
    st.title("🏠 Главная")
    st.subheader("Смешные мотивирующие цитаты")
    st.info("«Если сегодня не побежишь, завтра побежит кто-то другой… за твоей пиццей» 🍕🏃")
    st.button("Поделиться цитатой")
    st.subheader("Инсайты по тренировкам (ретро)")
    st.caption("Тут появятся автоматические инсайты на основе ваших сохранённых тренировок.")

def render_workouts_list(supabase, uid: str):
    st.title("📋 Мои тренировки — список")
    rows = list_workouts(supabase, user_id=uid, limit=100)
    if not rows:
        st.info("Пока нет сохранённых тренировок.")
        return
    for r in rows:
        c1, c2, c3, c4, c5 = st.columns([4,2,2,2,2])
        with c1:
            st.write(f"**{r.get('filename','(без имени)')}**")
            st.caption(f"id: `{r.get('id')}`")
        with c2: st.write(r.get("sport") or "—")
        with c3:
            d = r.get("duration_sec"); st.write(f"{int(d)//60} мин" if d else "—")
        with c4:
            dm = r.get("distance_m"); st.write(f"{dm/1000:.2f} км" if dm else "—")
        with c5:
            if st.button("Открыть", key=f"open_{r.get('id')}"):
                set_route("workouts", "detail")
                try:
                    st.query_params.update({"workout_id": r.get("id")})
                except Exception:
                    st.experimental_set_query_params(page="workouts", sub="detail", workout_id=r.get("id"))
                st.rerun()

def render_workouts_filters(supabase, uid: str):
    st.title("🔎 Фильтры тренировок")
    st.write("Здесь будут фильтры: по виду спорта, датам, дистанции, пульсу и т.д.")

def render_workouts_add(supabase, uid: str, hr_rest: int, hr_max: int, zone_bounds_text: str):
    st.title("➕ Добавить тренировку")
    uploaded = st.file_uploader("Выберите .fit файлы", type=["fit"], accept_multiple_files=True)
    if uploaded and st.button("Сохранить в БД"):
        saved, failed = 0, []
        for f in uploaded:
            try:
                ok, err, _ = save_workout(
                    supabase,
                    user_id=uid,
                    filename=getattr(f,"name","unknown.fit"),
                    size_bytes=len(f.getvalue()),
                    parsed=None,
                )
                if ok: saved += 1
                else: failed.append(f"{f.name}: {err}")
            except Exception as ex:
                failed.append(f"{f.name}: {ex}")
        if saved: st.success(f"Сохранено: {saved}")
        if failed: st.error("Не удалось сохранить:\n- " + "\n- ".join(failed))
        st.rerun()

def render_workout_detail_view(supabase, user_id: str, workout_id: str):
    st.title("📄 Детали тренировки")
    if not workout_id:
        st.info("Не выбран идентификатор тренировки.")
        return
    row = get_workout_by_id(supabase, workout_id=workout_id, user_id=user_id)
    if not row:
        st.error("Тренировка не найдена.")
        return
    c1,c2,c3,c4 = st.columns([4,2,2,2])
    with c1: st.markdown(f"**{row.get('filename','')}**"); st.caption(f"id: `{row.get('id')}`")
    with c2: st.write(row.get("sport") or "—")
    with c3:
        d = row.get("duration_sec"); st.write(f"{int(d)//60} мин" if d else "—")
    with c4:
        dm = row.get("distance_m"); st.write(f"{dm/1000:.2f} км" if dm else "—")
    st.divider()
    st.subheader("fit_summary")
    st.json(row.get("fit_summary") or {})
    if st.button("← Назад"):
        set_route("workouts","list"); st.rerun()

def render_goals_overview(supabase, uid: str):
    st.title("🎯 Цели"); st.write("Здесь вы будете ставить цели и следить за прогрессом.")

def render_plan_overview(supabase, uid: str):
    st.title("📅 Тренировочный план"); st.write("Ваш персональный план тренировок появится здесь.")

def render_coach_chat(supabase, uid: str):
    st.title("💬 Общение с тренером"); st.write("Здесь будет чат с тренером.")

def render_nutrition_history(supabase, uid: str):
    st.title("🍽️ Дневник питания — История"); st.write("История приёмов пищи появится здесь.")

def render_nutrition_calories(supabase, uid: str):
    st.title("🔥 Калории"); st.write("Сводки по калориям.")

def render_nutrition_filters(supabase, uid: str):
    st.title("🧮 Фильтры питания"); st.write("Фильтры по датам, категориям, БЖУ…")

def render_nutrition_add(supabase, uid: str):
    st.title("➕ Добавить приём пищи"); st.write("В 1-й версии добавление вручную; телеграм-бот — позже.")

def render_profile_data(supabase, uid: str):
    st.title("👤 Профиль — Данные пользователя")
    st.write("Возраст, пол, вес, пульс покоя, макс пульс (по возрасту), зоны, VO2max, результаты…")

def render_profile_login(supabase, uid: str):
    st.title("🔐 Профиль — Логин"); st.write("Управление входом.")

def render_profile_promo(supabase, uid: str):
    st.title("🏷️ Профиль — Промо-код"); st.write("Активация промо-кодов.")

def render_profile_logout(supabase, uid: str):
    st.title("🚪 Профиль — Деавторизация"); st.write("Кнопка выхода.")

def render_badges_overview(supabase, uid: str):
    st.title("🥇 Бейджи и рекорды"); st.write("Ваши ачивки и PB.")