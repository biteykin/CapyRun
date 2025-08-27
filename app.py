# app.py — CapyRun (оркестратор)
import streamlit as st
from typing import Any
import pandas as pd

# наши модули
from auth import get_supabase, auth_sidebar, account_block
from profile import load_or_init_profile, profile_sidebar
from landing import render_landing
from views_single import render_single_workout
from views_multi import render_multi_workouts
from db_workouts import list_workouts, save_workout

st.set_page_config(
    page_title="CapyRun — FIT Analyzer",
    page_icon="🏃",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("🏃 CapyRun — FIT Analyzer")
st.caption("Загрузи один или несколько .fit → отчёт / прогресс / план + календарь (ICS) + Excel")

def _user_id(u: Any):
    return u.get("id") if isinstance(u, dict) else getattr(u, "id", None)

supabase = get_supabase()

# --- Сайдбар: только auth + профиль (НИКАКИХ render_landing() внутри!) ---
with st.sidebar:
    user = auth_sidebar(supabase, show_when_authed=False)
    if user:
        profile_row = load_or_init_profile(supabase, _user_id(user))
        hr_rest, hr_max, zone_bounds_text = profile_sidebar(supabase, user, profile_row)
        st.divider()
        account_block(supabase, user)

# --- Если не залогинен — рисуем лендинг В ОСНОВНОЙ ОБЛАСТИ и выходим ---
if not user:
    render_landing()
    st.stop()

# --- Основной контент (после авторизации) ---
uid = _user_id(user)
if not uid:
    st.error("Не удалось определить user_id. Перелогинься, пожалуйста.")
    st.stop()

def _workouts_df(rows):
    if not rows:
        return None
    df = pd.DataFrame(rows)
    if "distance_m" in df.columns:
        df["distance_km"] = (df["distance_m"].fillna(0) / 1000).round(2)
    return df

# 1) Список последних тренировок пользователя
st.markdown("### 🏃 Мои тренировки")
_rows = list_workouts(supabase, user_id=uid, limit=20)
df = _workouts_df(_rows)
if df is None or df.empty:
    st.info("Пока нет сохранённых тренировок.")
else:
    st.dataframe(
        df[["uploaded_at", "filename", "sport", "duration_sec", "distance_km"]],
        use_container_width=True,
        hide_index=True
    )

st.divider()

# 2) Загрузка файлов и просмотр отчётов
uploaded_files = st.file_uploader("Загрузите FIT-файл(ы)", type=["fit"], accept_multiple_files=True)

# Кэшируем байты сразу при загрузке, чтобы не зависеть от закрытия файловых объектов
if uploaded_files:
    valid_files = [f for f in uploaded_files if f is not None and getattr(f, "size", 1) > 0]
    # сохраняем в сессию: имя + байты + размер
    st.session_state["_uploads_cache"] = [
        {
            "name": f.name,
            "bytes": f.getvalue(),   # снимаем копию, пока файл точно жив
            "size": len(f.getvalue())
        }
        for f in valid_files
    ]
else:
    valid_files = []
    st.session_state.pop("_uploads_cache", None)


if not uploaded_files:
    st.info("Загрузи один или несколько .fit файлов, чтобы увидеть отчёт/прогресс.")
else:
    # Defensive: отфильтруем None и пустые файлы
    valid_files = [f for f in uploaded_files if f is not None and getattr(f, "size", 1) > 0]

    if not valid_files:
        st.warning("Файл(ы) не загружены или пусты. Пожалуйста, выберите корректные .fit файлы.")
    elif len(valid_files) == 1:
        # Отчёт по одному файлу
        render_single_workout(
            file=valid_files[0],
            supabase=supabase,
            user_id=uid,
            hr_rest=hr_rest,
            hr_max=hr_max,
            zone_bounds_text=zone_bounds_text,
        )
    else:
        # Сводный отчёт по нескольким файлам
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
                "Ошибка при обработке тренировок. "
                "Возможно, в вашей истории тренировок нет данных или они повреждены. "
                f"Техническая информация: {e}"
            )

# -# --- Кнопка "Сохранить в БД" для загруженных файлов ---
st.markdown("#### 💾 Сохранить загруженные тренировки в БД")
if st.button("Сохранить в БД"):
    saved, failed = 0, []
    cache = st.session_state.get("_uploads_cache") or []
    for item in cache:
        try:
            ok, err, row = save_workout(
                supabase,
                user_id=uid,
                filename=item["name"],
                size_bytes=item["size"],
                parsed=None,  # сюда позже подставим реальные метрики
            )
            if ok:
                saved += 1
            else:
                failed.append(f"{item['name']}: {err}")
        except Exception as ex:
            failed.append(f"{item['name']}: {ex}")

    if saved:
        st.success(f"Сохранено тренировок: {saved}")
    if failed:
        st.error("Не удалось сохранить:\n- " + "\n- ".join(failed))

    st.rerun()  # сразу перерисуем экран, чтобы список наверху обновился