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

# --- Сайдбар: только навигация и авторизация, без профиля и аккаунта ---
with st.sidebar:
    # Авторизация: форма видна, только если пользователь НЕ залогинен.
    # Если залогинен — ничего не рисуем (как ты и хотел «убрать всё выше навигации»).
    user = auth_sidebar(supabase, show_when_authed=False)

    # ==== Бренд + стили (PostHog-like) ====
    st.markdown("""
    <style>
      /* Общий фон сайдбара — минимализм */
      section[data-testid="stSidebar"] {
        background: #0b0f19;            /* тёмный, как у PostHog Cloud */
        border-right: 1px solid rgba(255,255,255,0.06);
      }
      /* Бренд-заголовок */
      .cr-brand {
        display:flex; align-items:center; gap:10px;
        font-weight:700; font-size:18px; color:#fff; margin:8px 0 4px 0;
      }
      .cr-brand .logo {
        width:28px; height:28px; display:inline-flex; 
        align-items:center; justify-content:center;
        background: linear-gradient(135deg, #ff5a76, #ff8a00);
        border-radius:8px; color:#0b0f19; font-weight:900;
      }
      /* Заголовок секции */
      .cr-section {
        margin: 10px 0 6px 0; 
        font-size:12px; letter-spacing:.06em; 
        color:rgba(255,255,255,0.55); text-transform:uppercase;
      }
      /* Группа */
      .cr-group { margin: 8px 0 14px 0; }
      .cr-group-title {
        color: rgba(255,255,255,0.6);
        font-size: 12px; letter-spacing: .03em;
        margin: 8px 0 6px 0; text-transform: uppercase;
      }
      /* Элемент меню */
      .cr-item {
        display:flex; align-items:center; gap:10px;
        text-decoration:none; padding:10px 12px; border-radius:10px;
        color:#e5e7eb; font-weight:500; margin:4px 0;
        transition: all .15s ease;
        border: 1px solid transparent;
      }
      .cr-item:hover {
        background: rgba(255,255,255,0.04);
        border-color: rgba(255,255,255,0.08);
        transform: translateY(-1px);
      }
      .cr-item .ico { width:22px; text-align:center; }
      .cr-item.active {
        background: linear-gradient(135deg, rgba(255,90,118,0.18), rgba(255,138,0,0.18));
        border-color: rgba(255,255,255,0.12);
        color:#fff;
      }
      .cr-sep { height:1px; background: rgba(255,255,255,0.06); margin:12px 0; border-radius:1px; }
    </style>
    """, unsafe_allow_html=True)

    st.markdown("""
      <div class="cr-brand">
        <div class="logo">🏃</div>
        <div>CapyRun</div>
      </div>
      <div class="cr-section">🧭 Навигация</div>
    """, unsafe_allow_html=True)

    # Текущий маршрут (для подсветки активного пункта)
    def _get_qp():
        try: return dict(st.query_params)
        except Exception: return st.experimental_get_query_params()

    def _active(page, sub=None):
        qp = _get_qp()
        cur_p = (qp.get("page",[None])[0] if isinstance(qp.get("page"), list) else qp.get("page")) or "home"
        cur_s = (qp.get("sub",[None])[0] if isinstance(qp.get("sub"), list) else qp.get("sub"))
        return (cur_p == page) and ((cur_s or None) == (sub or None))

    def _href(page, sub=None, **extra):
        base = f"?page={page}" + (f"&sub={sub}" if sub else "")
        for k,v in extra.items():
            base += f"&{k}={v}"
        return base

    def nav_item(label, icon, page, sub=None, **extra):
        active_cls = "active" if _active(page, sub) else ""
        href = _href(page, sub, **extra)
        st.markdown(f"""
          <a class="cr-item {active_cls}" href="{href}">
            <span class="ico">{icon}</span>
            <span>{label}</span>
          </a>
        """, unsafe_allow_html=True)

    # ==== Группы меню (PostHog-like: простые группы, без expanders) ====
    st.markdown('<div class="cr-group">', unsafe_allow_html=True)
    st.markdown('<div class="cr-group-title">Главное</div>', unsafe_allow_html=True)
    nav_item("Главная страница", "🏠", "home")
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="cr-group">', unsafe_allow_html=True)
    st.markdown('<div class="cr-group-title">Мои тренировки</div>', unsafe_allow_html=True)
    nav_item("Список тренировок", "📋", "workouts", "list")
    nav_item("Фильтры", "🔎", "workouts", "filters")
    nav_item("Добавить тренировку", "➕", "workouts", "add")
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="cr-group">', unsafe_allow_html=True)
    st.markdown('<div class="cr-group-title">Цели</div>', unsafe_allow_html=True)
    nav_item("Мои цели", "🎯", "goals", "overview")
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="cr-group">', unsafe_allow_html=True)
    st.markdown('<div class="cr-group-title">Тренировочный план</div>', unsafe_allow_html=True)
    nav_item("План", "📅", "plan", "overview")
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="cr-group">', unsafe_allow_html=True)
    st.markdown('<div class="cr-group-title">Общение</div>', unsafe_allow_html=True)
    nav_item("Чат с тренером", "💬", "coach", "chat")
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="cr-group">', unsafe_allow_html=True)
    st.markdown('<div class="cr-group-title">Дневник питания</div>', unsafe_allow_html=True)
    nav_item("История", "🍽️", "nutrition", "history")
    nav_item("Калории", "🔥", "nutrition", "calories")
    nav_item("Фильтры", "🧮", "nutrition", "filters")
    nav_item("Добавить приём пищи", "➕", "nutrition", "add")
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="cr-group">', unsafe_allow_html=True)
    st.markdown('<div class="cr-group-title">Бейджи и рекорды</div>', unsafe_allow_html=True)
    nav_item("Мои бейджи", "🥇", "badges", "overview")
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('<div class="cr-sep"></div>', unsafe_allow_html=True)

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
        # hr_rest, hr_max, zone_bounds_text не определены в новой схеме — можно передать None
        render_workouts_add(supabase, uid, None, None, None)
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