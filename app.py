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

# --- Sidebar: ChatGPT-like navigation ---
with st.sidebar:
    # 1) форма логина показывается только когда пользователь НЕ залогинен
    user = auth_sidebar(supabase, show_when_authed=False)

    if user:
        # ===== ChatGPT-like sidebar CSS =====
        st.markdown("""
        <style>
          :root{
            --sb-bg:#0e0f13;
            --sb-border:rgba(255,255,255,.08);
            --fg:#e6e6e6;
            --fg-dim:#a7a7a7;
            --item-hover:rgba(255,255,255,.06);
            --item-active:rgba(255,255,255,.12);
          }
          section[data-testid="stSidebar"]{
            background:var(--sb-bg);
            border-right:1px solid var(--sb-border);
            font-size:14px; /* как в ChatGPT */
          }
          /* Брендовая строка сверху — как логотип/название в ChatGPT */
          .gpt-brand{
            display:flex; align-items:center; gap:10px;
            font-weight:700; color:#fff; margin:8px 6px 10px;
          }
          .gpt-brand .logo{
            width:28px; height:28px; border-radius:8px;
            display:flex; align-items:center; justify-content:center;
            background:radial-gradient(120px 60px at 20% 20%, #ffffff14 10%, #ffffff08 40%, #0000 70%);
          }

          /* Список ссылок (плоский) */
          .gpt-list{ display:flex; flex-direction:column; gap:4px; margin:6px 4px; }

          /* Элемент «как у ChatGPT»: лёгкий прямоугольник, ровные отступы, без рамок */
          .gpt-item{
            display:block; text-decoration:none; color:var(--fg);
            padding:10px 12px; border-radius:10px;
          }
          .gpt-item:hover{ background:var(--item-hover); }
          .gpt-item.active{ background:var(--item-active); color:#fff; }

          /* Низ: закреплённый профиль, как у ChatGPT */
          .gpt-footer{
            position:fixed; left:12px; right:12px; bottom:12px;
            display:flex; align-items:center; gap:10px;
            padding:10px; border-radius:12px;
            background:rgba(255,255,255,.03);
            border:1px solid var(--sb-border); color:var(--fg);
          }
          .gpt-ava{
            width:28px; height:28px; border-radius:50%;
            background:#202225; display:flex; align-items:center; justify-content:center;
            font-weight:700;
          }
          .gpt-name{ font-weight:600; }
          .gpt-logout button{
            padding:6px 10px !important; border-radius:10px !important;
            background:transparent !important; color:var(--fg) !important;
            border:1px solid var(--sb-border) !important;
          }
          .gpt-logout button:hover{ background:var(--item-hover) !important; color:#fff !important; }
        </style>
        """, unsafe_allow_html=True)

        # ===== данные маршрута и меню =====
        PAGE, SUB = get_route()
        L1 = [
            ("home",     "🏠", "Главная страница"),
            ("goals",    "🎯", "Цели"),
            ("plan",     "📅", "Тренировочный план"),
            ("coach",    "💬", "Общение с тренером"),
            ("workouts", "📋", "Мои тренировки"),
            ("nutrition","🍽️", "Дневник питания"),
            ("profile",  "👤", "Профиль"),
            ("badges",   "🥇", "Бейджи и рекорды"),
        ]
        L1_KEYS = {pid for pid,_,_ in L1}
        if PAGE not in L1_KEYS:
            PAGE, SUB = "home", None

        # ===== бренд и список
        st.markdown('<div class="gpt-brand"><div class="logo">🏃‍♂️</div><div>CapyRun</div></div>', unsafe_allow_html=True)
        st.markdown('<div class="gpt-list">', unsafe_allow_html=True)

        # Рендерим ссылки как <a href="?page=..."> — как у ChatGPT. Никаких новых вкладок.
        for pid, icon, label in L1:
            active_cls = "active" if PAGE == pid else ""
            href = f"?page={pid}"  # суброут сбрасываем
            st.markdown(f'<a class="gpt-item {active_cls}" href="{href}">{icon}  {label}</a>', unsafe_allow_html=True)

        st.markdown('</div>', unsafe_allow_html=True)

        # ===== закреплённый низ (имя + кнопка «Выйти») =====
        uname = user_display(user)
        initials = (uname[:2] if uname else "U").upper()
        st.markdown(
            f'''
            <div class="gpt-footer">
              <div class="gpt-ava">{initials}</div>
              <div class="gpt-name">{uname}</div>
              <div style="flex:1;"></div>
              <div class="gpt-logout">
                <!-- Кнопку рендерим рядом обычным st.button, чтобы был обработчик клика -->
              </div>
            </div>
            ''',
            unsafe_allow_html=True
        )
        # кнопка «Выйти» отдельно (к HTML ниже её не воткнуть кликабельно)
        if st.button("Выйти", key="logout_btn_sidebar"):
            try:
                supabase.auth.sign_out()
            except Exception:
                pass
            st.experimental_set_query_params()  # сброс маршрута
            st.rerun()

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
    render_subnav("home", [("quotes","Цитаты"), ("insights","Инсайты")], get_route()[1])
    st.subheader("🏃 CapyRun — FIT Analyzer")
    st.caption("Загрузи один или несколько .fit → отчёт / прогресс / план + календарь (ICS) + Excel")
    st.divider()
    uploaded_files = st.file_uploader("Загрузите FIT-файл(ы)", type=["fit"], accept_multiple_files=True)
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
    st.title("📋 Мои тренировки")
    render_subnav("workouts", [("list","Список"), ("filters","Фильтры"), ("add","Добавить")], get_route()[1])
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
                set_route("workouts", "detail", workout_id=r.get("id"))
                st.rerun()

def render_workouts_filters(supabase, uid: str):
    st.title("🔎 Фильтры тренировок")
    render_subnav("workouts", [("list","Список"), ("filters","Фильтры"), ("add","Добавить")], get_route()[1])
    st.info("Раздел в разработке.")

def render_workouts_add(supabase, uid: str, hr_rest: int, hr_max: int, zone_bounds_text: str):
    st.title("➕ Добавить тренировку")
    render_subnav("workouts", [("list","Список"), ("filters","Фильтры"), ("add","Добавить")], get_route()[1])
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
    render_subnav("workouts", [("list","Список"), ("filters","Фильтры"), ("add","Добавить")], get_route()[1])
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
    render_subnav("profile", [("data","Данные пользователя"), ("promo","Промо-код"), ("logout","Выйти")], get_route()[1])
    st.info("Раздел в разработке.")

def render_profile_promo(supabase, uid: str):
    st.title("🏷️ Профиль — Промо-код")
    render_subnav("profile", [("data","Данные пользователя"), ("promo","Промо-код"), ("logout","Выйти")], get_route()[1])
    st.info("Раздел в разработке.")

def render_profile_logout(supabase, uid: str):
    st.title("🚪 Выйти")
    render_subnav("profile", [("data","Данные пользователя"), ("promo","Промо-код"), ("logout","Выйти")], get_route()[1])
    st.info("Здесь будет выход из аккаунта.")
    # если у тебя есть функция логаута в auth, вызови её тут:
    # auth_sign_out(supabase)

def render_badges_overview(supabase, uid: str):
    st.title("🥇 Бейджи и рекорды")
    render_subnav("badges", [("overview","Обзор")], get_route()[1])
    st.info("Раздел в разработке.")

def render_goals_overview(supabase, uid: str):
    st.title("🎯 Цели")
    render_subnav("goals", [("overview","Обзор"), ("new","Новая цель")], get_route()[1])
    st.info("Раздел в разработке.")

def render_plan_overview(supabase, uid: str):
    st.title("📅 Тренировочный план")
    render_subnav("plan", [("overview","Обзор"), ("import","Импорт"), ("export","Экспорт")], get_route()[1])
    st.info("Раздел в разработке.")

def render_coach_chat(supabase, uid: str):
    st.title("💬 Чат с тренером")
    render_subnav("coach", [("chat","Чат"), ("history","История диалогов")], get_route()[1])
    st.info("Раздел в разработке.")

def render_nutrition_history(supabase, uid: str):
    st.title("🍽️ Дневник питания — История")
    render_subnav("nutrition", [("history","История"), ("calories","Калории"), ("add","Добавить приём пищи")], get_route()[1])
    st.info("Раздел в разработке.")

def render_nutrition_calories(supabase, uid: str):
    st.title("🔥 Калории")
    render_subnav("nutrition", [("history","История"), ("calories","Калории"), ("add","Добавить приём пищи")], get_route()[1])
    st.info("Раздел в разработке.")

def render_nutrition_filters(supabase, uid: str):
    st.title("🧮 Фильтры питания")
    render_subnav("nutrition", [("history","История"), ("calories","Калории"), ("add","Добавить приём пищи")], get_route()[1])
    st.info("Раздел в разработке.")

def render_nutrition_add(supabase, uid: str):
    st.title("➕ Добавить приём пищи")
    render_subnav("nutrition", [("history","История"), ("calories","Калории"), ("add","Добавить приём пищи")], get_route()[1])
    st.info("Раздел в разработке.")