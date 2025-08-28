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

# --- Сайдбар: авторизация + минималистичное меню-кнопки ---
with st.sidebar:
    # Форма логина видно только когда пользователь не залогинен
    user = auth_sidebar(supabase, show_when_authed=False)

    if user:
        # ===== СТИЛИ (минималистично, не «кислотно») =====
        st.markdown("""
        <style>
          section[data-testid="stSidebar"] {
            background: #0e1117;
            border-right: 1px solid rgba(255,255,255,0.06);
          }
          .cr-brand {
            display:flex; align-items:center; gap:10px; margin:6px 0 10px 0;
            color:#fff; font-weight:700; font-size:18px;
          }
          .cr-brand .logo {
            width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center;
            background: radial-gradient(120px 60px at 20% 20%, #ff7a7a44 10%, #ff9d5b33 40%, #ffffff08 70%);
          }
          .cr-group-title { 
            color: rgba(255,255,255,0.55); 
            font-size: 11px; letter-spacing: .08em; text-transform: uppercase; 
            margin: 12px 0 6px 2px;
          }
          .cr-item-btn button {
            width: 100%; justify-content: flex-start;
            border-radius: 10px !important;
            background: transparent !important;
            border: 1px solid transparent !important;
            color: #e5e7eb !important;
            padding: 8px 10px !important;
          }
          .cr-item-btn button:hover {
            background: rgba(255,255,255,0.05) !important;
            border-color: rgba(255,255,255,0.08) !important;
          }
          .cr-item-btn.active button {
            background: linear-gradient(135deg, rgba(255,122,122,0.16), rgba(255,157,91,0.16)) !important;
            border-color: rgba(255,255,255,0.12) !important;
            color: #fff !important;
          }
        </style>
        """, unsafe_allow_html=True)

        # helpers для активного пункта и перехода
        def _qp_dict():
            try: return dict(st.query_params)
            except Exception: return st.experimental_get_query_params()
        def _is_active(page, sub=None):
            qp = _qp_dict()
            cur_p = (qp.get("page",[None])[0] if isinstance(qp.get("page"), list) else qp.get("page")) or "home"
            cur_s = (qp.get("sub",[None])[0] if isinstance(qp.get("sub"), list) else qp.get("sub")
                     if qp.get("sub") is not None else None)
            return (cur_p == page) and ((cur_s or None) == (sub or None))
        def nav_btn(label, page, sub=None, key=None):
            active = _is_active(page, sub)
            cls = "cr-item-btn active" if active else "cr-item-btn"
            with st.container():
                st.markdown(f'<div class="{cls}">', unsafe_allow_html=True)
                if st.button(label, key=key or f"nav_{page}_{sub or 'root'}"):
                    set_route(page, sub)
                    st.rerun()
                st.markdown('</div>', unsafe_allow_html=True)

        # Бренд
        st.markdown('<div class="cr-brand"><div class="logo">🏃</div><div>CapyRun</div></div>', unsafe_allow_html=True)

        # Группы меню (без «🧭 НАВИГАЦИЯ»)
        st.markdown('<div class="cr-group-title">Главное</div>', unsafe_allow_html=True)
        nav_btn("🏠 Главная", "home")

        st.markdown('<div class="cr-group-title">Мои тренировки</div>', unsafe_allow_html=True)
        nav_btn("📋 Список тренировок", "workouts", "list")
        nav_btn("🔎 Фильтры", "workouts", "filters")
        nav_btn("➕ Добавить тренировку", "workouts", "add")

        st.markdown('<div class="cr-group-title">Цели</div>', unsafe_allow_html=True)
        nav_btn("🎯 Мои цели", "goals", "overview")

        st.markdown('<div class="cr-group-title">План</div>', unsafe_allow_html=True)
        nav_btn("📅 Тренировочный план", "plan", "overview")

        st.markdown('<div class="cr-group-title">Общение</div>', unsafe_allow_html=True)
        nav_btn("💬 Чат с тренером", "coach", "chat")

        st.markdown('<div class="cr-group-title">Питание</div>', unsafe_allow_html=True)
        nav_btn("🍽️ История", "nutrition", "history")
        nav_btn("🔥 Калории", "nutrition", "calories")
        nav_btn("🧮 Фильтры", "nutrition", "filters")
        nav_btn("➕ Добавить приём пищи", "nutrition", "add")

        st.markdown('<div class="cr-group-title">Бейджи</div>', unsafe_allow_html=True)
        nav_btn("🥇 Бейджи и рекорды", "badges", "overview")

        st.markdown('<div class="cr-group-title">Профиль</div>', unsafe_allow_html=True)
        nav_btn("👤 Данные пользователя", "profile", "data")
        nav_btn("🏷️ Промо-код", "profile", "promo")
        nav_btn("🚪 Выйти", "profile", "logout")  # ← переименовали

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

    # Твой прежний «герой»-текст
    st.subheader("🏃 CapyRun — FIT Analyzer")
    st.caption("Загрузи один или несколько .fit → отчёт / прогресс / план + календарь (ICS) + Excel")
    st.divider()

    # Загрузка и отчёты (переносим из старого app.py)
    uploaded_files = st.file_uploader("Загрузите FIT-файл(ы)", type=["fit"], accept_multiple_files=True)

    # можно подхватить hr_rest/hr_max/zone_bounds_text, если они нужны твоим рендерам:
    hr_rest = st.session_state.get("hr_rest")
    hr_max = st.session_state.get("hr_max")
    zone_bounds_text = st.session_state.get("zone_bounds_text")

    if not uploaded_files:
        st.info("Загрузи один или несколько .fit файлов, чтобы увидеть отчёт/прогресс.")
        return

    valid_files = [f for f in uploaded_files if f is not None and getattr(f, "size", 1) > 0]
    if not valid_files:
        st.warning("Файл(ы) не загружены или пусты. Пожалуйста, выберите корректные .fit файлы.")
        return

    # Если один файл — детальный отчёт, если несколько — сводный (как раньше)
    if len(valid_files) == 1:
        try:
            render_single_workout(
                file=valid_files[0],
                supabase=supabase,
                user_id=uid,
                hr_rest=hr_rest,
                hr_max=hr_max,
                zone_bounds_text=zone_bounds_text,
            )
        except Exception as e:
            st.error("Ошибка при построении отчёта."); st.code(str(e))
    else:
        try:
            render_multi_workouts(
                files=valid_files,
                supabase=supabase,
                user_id=uid,
                hr_rest=hr_rest,
                hr_max=hr_max,
            )
        except ValueError as e:
            st.error(
                "Ошибка при обработке тренировок. Возможно, в истории тренировок нет данных или они повреждены."
            )
            st.code(str(e))

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
    st.info("Раздел в разработке.")

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

# ---------- ПРОФИЛЬ (заглушки, чтобы не падало) ----------
def render_profile_data(supabase, uid: str):
    st.title("👤 Профиль — Данные пользователя")
    st.info("Раздел в разработке.")

def render_profile_promo(supabase, uid: str):
    st.title("🏷️ Профиль — Промо-код")
    st.info("Раздел в разработке.")

def render_profile_logout(supabase, uid: str):
    st.title("🚪 Выйти")
    st.info("Здесь будет выход из аккаунта.")
    # если у тебя есть функция логаута в auth, вызови её тут:
    # auth_sign_out(supabase)

def render_badges_overview(supabase, uid: str):
    st.title("🥇 Бейджи и рекорды")
    st.info("Раздел в разработке.")

def render_goals_overview(supabase, uid: str):
    st.title("🎯 Цели")
    st.info("Раздел в разработке.")

def render_plan_overview(supabase, uid: str):
    st.title("📅 Тренировочный план")
    st.info("Раздел в разработке.")

def render_coach_chat(supabase, uid: str):
    st.title("💬 Чат с тренером")
    st.info("Раздел в разработке.")

def render_nutrition_history(supabase, uid: str):
    st.title("🍽️ Дневник питания — История")
    st.info("Раздел в разработке.")

def render_nutrition_calories(supabase, uid: str):
    st.title("🔥 Калории")
    st.info("Раздел в разработке.")

def render_nutrition_filters(supabase, uid: str):
    st.title("🧮 Фильтры питания")
    st.info("Раздел в разработке.")

def render_nutrition_add(supabase, uid: str):
    st.title("➕ Добавить приём пищи")
    st.info("Раздел в разработке.")