# app.py — CapyRun (оркестратор)
import streamlit as st
from typing import Any
import pandas as pd
# вместо: from db_workouts import list_workouts, save_workout, get_workout_by_id
try:
    from db_workouts import list_workouts, save_workout, get_workout_by_id
except Exception as e:
    import os, sys, traceback, streamlit as st
    st.error("Не удалось импортировать db_workouts — показываю подробности ниже.")
    st.caption(f"cwd: {os.getcwd()}")
    try:
        st.caption("files: " + ", ".join(sorted(os.listdir(os.getcwd()))))
    except Exception:
        pass
    st.code("".join(traceback.format_exception(type(e), e, e.__traceback__)))
    st.stop()
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

def _get_query_params():
    # Поддержка старых/новых API Streamlit
    try:
        return dict(st.query_params)
    except Exception:
        return st.experimental_get_query_params()

def _set_query_params(**kwargs):
    try:
        st.query_params.update(kwargs)
    except Exception:
        st.experimental_set_query_params(**kwargs)

def render_workout_detail_view(supabase, user_id: str, workout_id: str):
    row = get_workout_by_id(supabase, workout_id=workout_id, user_id=user_id)
    if not row:
        st.error("Тренировка не найдена или нет прав доступа.")
        if st.button("← Назад к списку"):
            _set_query_params()  # очистить параметры
            st.rerun()
        return

    st.markdown("## 📄 Детали тренировки")

    # Верхняя панель: название/дата/спорт
    c1, c2, c3, c4 = st.columns([3, 2, 2, 2])
    with c1:
        st.markdown(f"**{row.get('filename','(без имени)')}**")
        st.caption(f"id: `{row.get('id')}`")
    with c2:
        ts = row.get("uploaded_at") or row.get("created_at") or row.get("inserted_at")
        try:
            st.write(ts or "—")
        except Exception:
            st.write("—")
    with c3:
        st.write(row.get("sport") or "—")
    with c4:
        st.write(_fmt_km(row.get("distance_m")))

    st.divider()

    # Блок ключевых метрик (берём из колонок и/или fit_summary)
    summ = row.get("fit_summary") or {}
    avg_hr = summ.get("avg_hr") or row.get("avg_hr")
    max_hr = summ.get("max_hr") or row.get("max_hr")
    avg_speed = summ.get("avg_speed_m_s") or summ.get("avg_speed")
    elev_gain = summ.get("elevation_gain") or summ.get("total_ascent")
    elev_loss = summ.get("elevation_loss") or summ.get("total_descent")
    calories = summ.get("calories") or row.get("calories")
    moving_time = row.get("moving_time_sec") or summ.get("moving_time_sec")
    duration = row.get("duration_sec") or summ.get("duration_sec")

    g1, g2, g3, g4, g5, g6 = st.columns(6)
    with g1:
        st.metric("Длительность", _fmt_hhmmss(duration))
    with g2:
        st.metric("Дистанция", _fmt_km(row.get("distance_m")))
    with g3:
        st.metric("Темп", _fmt_pace_min_per_km(avg_speed))
    with g4:
        st.metric("Пульс ср.", f"{int(avg_hr)}" if avg_hr else "—")
    with g5:
        st.metric("Пульс макс.", f"{int(max_hr)}" if max_hr else "—")
    with g6:
        st.metric("Калории", f"{int(calories)}" if calories else "—")

    h1, h2 = st.columns(2)
    with h1:
        st.metric("Набор высоты", f"{int(elev_gain)} м" if elev_gain else "—")
    with h2:
        st.metric("Потеря высоты", f"{int(elev_loss)} м" if elev_loss else "—")

    laps = summ.get("laps")
    if isinstance(laps, list) and laps:
        st.markdown("### Laps / интервалы")
        import pandas as pd
        df_laps = pd.DataFrame(laps)
        st.dataframe(df_laps, use_container_width=True, hide_index=True)

    with st.expander("Полный JSON (fit_summary)"):
        st.json(summ if isinstance(summ, dict) else {"fit_summary": summ})

    st.divider()
    if st.button("← Назад к списку"):
        _set_query_params()  # очищаем параметр workout_id
        st.rerun()

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

# ——— роутинг по query params ———
qp = _get_query_params()
selected_id = None
if isinstance(qp.get("workout_id"), list):
    selected_id = qp.get("workout_id")[0]
else:
    selected_id = qp.get("workout_id")

if selected_id:
    # Режим «детали»
    render_workout_detail_view(supabase, user_id=uid, workout_id=selected_id)
else:
    # Режим «список»
    st.markdown("### 🏃 Мои тренировки")
    try:
        _rows = list_workouts(supabase, user_id=uid, limit=50)
        if not _rows:
            st.info("Пока нет сохранённых тренировок.")
        else:
            # компактный список с кнопками «Открыть»
            import pandas as pd
            df = pd.DataFrame(_rows)
            if "distance_m" in df.columns:
                df["distance_km"] = (df["distance_m"].fillna(0) / 1000).round(2)
            # рисуем строки вручную, чтобы сделать кнопки «Открыть»
            for r in _rows:
                c1, c2, c3, c4, c5 = st.columns([4, 2, 2, 2, 2])
                with c1:
                    st.write(f"**{r.get('filename','(без имени)')}**")
                    st.caption(f"id: `{r.get('id')}`")
                with c2:
                    st.write(r.get("sport") or "—")
                with c3:
                    st.write(_fmt_hhmmss(r.get("duration_sec")))
                with c4:
                    st.write(_fmt_km(r.get("distance_m")))
                with c5:
                    if st.button("Открыть", key=f"open_{r.get('id')}"):
                        _set_query_params(workout_id=r.get("id"))
                        st.rerun()
            st.divider()
    except Exception as e:
        import traceback
        st.error("Не удалось загрузить список тренировок (возможно, RLS/политики или нет токена).")
        st.code("".join(traceback.format_exception_only(type(e), e)))

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

# --- Кнопка "Сохранить в БД" для загруженных файлов ---
st.markdown("#### 💾 Сохранить загруженные тренировки в БД")
if st.button("Сохранить в БД"):
    saved, failed = 0, []
    cache = st.session_state.get("_uploads_cache") or []
    for item in cache:
        try:
            # Оптимизация: убираем .select() из save_workout, если возникает ошибка
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