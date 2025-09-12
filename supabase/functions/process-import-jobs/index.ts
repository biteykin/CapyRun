// supabase/functions/process-import-jobs/index.ts
// PROD VERSION: клеймит queued-джобы, парсит FIT/GPX/TCX/ZIP, создаёт workout при необходимости,
// заполняет метрики и завершает job.

function ruSport(s: string): string {
  const m: Record<string, string> = {
    run: "бег",
    ride: "велосипед",
    walk: "ходьба",
    hike: "поход",
    swim: "плавание",
    row: "гребля",
    strength: "силовая тренировка",
    yoga: "йога",
    aerobics: "аэробика",
    crossfit: "кроссфит",
    pilates: "пилатес",
    other: "тренировка",
  };
  return m[s] || "тренировка";
}

function fmtDistance(distance_m?: number | null): string | null {
  if (!Number.isFinite(Number(distance_m)) || (distance_m as number) <= 0) return null;
  const m = Math.round(distance_m as number);
  if (m < 1000) return `${m} м`;
  const km = (m / 1000);
  const r1 = Math.round(km * 10) / 10;
  const isInt = Math.abs(r1 - Math.round(km)) < 0.05;
  return isInt ? `${Math.round(km)} км` : `${r1.toFixed(1)} км`;
}

function contextSuffix(sub_sport?: string | null, has_gps?: boolean | null): string | null {
  const s = (sub_sport || "").toLowerCase();
  if (s.includes("track")) return "на стадионе";
  if (s.includes("treadmill") || has_gps === false) return "в помещении";
  return null;
}

function ddmmyy(d?: string | null): string {
  if (!d) return "";
  try {
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = String(dt.getFullYear() % 100).padStart(2, "0");
    return `${dd}.${mm}.${yy}`;
  } catch { return ""; }
}

// --- Helpers ---

function capitalizeFirst(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Собираем короткое «человеческое» имя */
function makeWorkoutName(
  sport: string | null | undefined,
  distance_m: number | null | undefined,
  sub_sport: string | null | undefined,
  has_gps: boolean | null | undefined,
  local_date: string | null | undefined
): string {
  const base = ruSport(sport || "other");
  const dist = fmtDistance(distance_m ?? null);
  const where = contextSuffix(sub_sport ?? null, has_gps ?? null);
  const parts = [base, dist, where].filter(Boolean) as string[];
  if (parts.length) return capitalizeFirst(parts.join(" "));
  // если ничего не знаем — дата
  const d = ddmmyy(local_date || null);
  return capitalizeFirst(d ? `${base} ${d}` : base);
}

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import FitParser from "https://esm.sh/fit-file-parser@1.9.0";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.3.5";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

type Job = {
  id: string;
  user_id: string;
  source_file_id: string | null;
  workout_id: string | null;
  attempt: number;
  max_attempts: number;
  status: string;
  scheduled_at: string;
};

const toInt = (n: any) => (Number.isFinite(Number(n)) ? Math.round(Number(n)) : null);
const toNum = (n: any, d = 2) => (Number.isFinite(Number(n)) ? Number(Number(n).toFixed(d)) : null);

function mapSport(s?: string): string {
  const v = (s || "").toLowerCase();
  if (["running","run"].includes(v)) return "run";
  if (["cycling","bike","biking","ride"].includes(v)) return "ride";
  if (["walking","walk"].includes(v)) return "walk";
  if (["hiking","hike"].includes(v)) return "hike";
  if (["swimming","swim"].includes(v)) return "swim";
  if (["rowing","row"].includes(v)) return "row";
  if (["strength_training","strength"].includes(v)) return "strength";
  if (["yoga"].includes(v)) return "yoga";
  if (["aerobics"].includes(v)) return "aerobics";
  if (["crossfit"].includes(v)) return "crossfit";
  if (["pilates"].includes(v)) return "pilates";
  return "other";
}

// 30-сек «нормализованная мощность» (NP) по временной шкале
function calcNP(power: number[], time: number[]): number | null {
  if (!power?.length || power.length !== time.length) return null;
  // скользящее среднее по 30с, затем среднее четвёртых степеней и корень четвёртой степени
  let i0 = 0;
  let sumP = 0; // интеграл мощности по времени в текущем окне
  let wSum = 0; // суммарная длительность окна
  const p30: number[] = [];
  for (let i = 0; i < power.length; i++) {
    const t = time[i];
    const p = power[i] ?? 0;
    const dt = i === 0 ? 0 : Math.max(0, time[i] - time[i - 1]);

    sumP += p * dt;
    wSum += dt;

    // выкидываем из окна всё старше 30с
    while (time[i] - time[i0] > 30 && i0 < i) {
      const dt0 = time[i0 + 1] - time[i0];
      sumP -= (power[i0] ?? 0) * dt0;
      wSum -= dt0;
      i0++;
    }
    if (wSum > 0) p30.push(sumP / wSum);
  }
  if (!p30.length) return null;
  const meanPow4 = p30.reduce((s, x) => s + Math.pow(x, 4), 0) / p30.length;
  return Math.round(Math.pow(meanPow4, 1 / 4));
}

// простой расчёт moving_time по порогу скорости
function calcMovingTime(speedMs: number[], time: number[], threshold = 0.5): number | null {
  if (!speedMs?.length || speedMs.length !== time.length) return null;
  let moving = 0;
  for (let i = 1; i < speedMs.length; i++) {
    const dt = Math.max(0, time[i] - time[i - 1]);
    if ((speedMs[i] ?? 0) > threshold) moving += dt;
  }
  return Math.round(moving);
}

// набор/сброс высоты с фильтрацией мелкого шума
function calcElevGainLoss(elev: number[], time: number[]): { up: number|null, down: number|null } {
  if (!elev?.length || elev.length !== time.length) return { up: null, down: null };
  let up = 0, down = 0;
  for (let i = 1; i < elev.length; i++) {
    const d = (elev[i] ?? 0) - (elev[i - 1] ?? 0);
    // игнорируем «дрожь» < 0.5м и аномальные скачки > 20м между соседними точками
    if (Math.abs(d) < 0.5 || Math.abs(d) > 20) continue;
    if (d > 0) up += d; else down += -d;
  }
  return { up: Math.round(up), down: Math.round(down) };
}

// Aerobic decoupling (PA:HR), % — сравнение первой и второй половины
function calcPaHrPct(speedMs: number[], hr: number[], time: number[]): number | null {
  if (!speedMs?.length || speedMs.length !== hr.length || hr.length !== time.length) return null;
  const t0 = time[0], tEnd = time[time.length - 1];
  if (tEnd - t0 < 600) return null; // <10 минут — не считаем
  const tMid = t0 + (tEnd - t0) / 2;

  let s1 = 0, h1 = 0, n1 = 0;
  let s2 = 0, h2 = 0, n2 = 0;

  for (let i = 0; i < time.length; i++) {
    const sp = speedMs[i] ?? 0;
    const hh = hr[i] ?? 0;
    if (!Number.isFinite(sp) || !Number.isFinite(hh) || hh <= 0) continue;
    if (time[i] <= tMid) { s1 += sp; h1 += hh; n1++; }
    else { s2 += sp; h2 += hh; n2++; }
  }
  if (n1 < 30 || n2 < 30) return null;
  const pa1 = (s1 / n1) / (h1 / n1);
  const pa2 = (s2 / n2) / (h2 / n2);
  if (!Number.isFinite(pa1) || !Number.isFinite(pa2) || pa1 <= 0) return null;
  return Number((((pa2 / pa1) - 1) * 100).toFixed(2));
}

function extFromPath(p: string): string {
  const dot = p.lastIndexOf(".");
  return dot >= 0 ? p.slice(dot + 1).toLowerCase() : "";
}

// --- Downsampling Helper ---
function downsamplePair(x: number[], y: (number|null)[], maxPoints = 1500) {
  if (!x?.length || x.length !== y.length) return { x: [], y: [] };
  if (x.length <= maxPoints) return { x, y };
  const step = Math.ceil(x.length / maxPoints);
  const xs: number[] = [], ys: (number|null)[] = [];
  for (let i = 0; i < x.length; i += step) {
    xs.push(x[i]);
    ys.push(y[i]);
  }
  return { x: xs, y: ys };
}

// --- Extended parseFIT ---
async function parseFIT(ab: ArrayBuffer) {
  const parser = new (FitParser as any)({
    force: true,
    speedUnit: "m/s",
    lengthUnit: "m",
    mode: "list",
    elapsedRecordField: true,
  });
  const data = await new Promise<any>((res, rej) =>
    parser.parse(ab, (err: any, out: any) => (err ? rej(err) : res(out)))
  );

  const session = Array.isArray(data.sessions) ? data.sessions[0] : data.session || null;
  const laps = Array.isArray(data.laps) ? data.laps : [];
  const records = Array.isArray(data.records) ? data.records : [];

  // таймсерии
  const ts: number[] = [];
  const sp: number[] = [];    // m/s
  const hr: number[] = [];
  const cad: number[] = [];
  const alt: number[] = [];   // m
  const pow: number[] = [];

  for (const r of records) {
    const t = r?.timestamp ? +new Date(r.timestamp) / 1000 : null;
    if (!t) continue;
    ts.push(t);
    const speed = Number.isFinite(Number(r.enhanced_speed)) ? Number(r.enhanced_speed)
                : Number.isFinite(Number(r.speed)) ? Number(r.speed) : null;
    sp.push(speed ?? 0);
    hr.push(Number.isFinite(Number(r.heart_rate)) ? Number(r.heart_rate) : 0);
    cad.push(Number.isFinite(Number(r.cadence)) ? Number(r.cadence) : 0);
    const elevation = Number.isFinite(Number(r.enhanced_altitude)) ? Number(r.enhanced_altitude)
                    : Number.isFinite(Number(r.altitude)) ? Number(r.altitude) : null;
    alt.push(elevation ?? 0);
    pow.push(Number.isFinite(Number(r.power)) ? Number(r.power) : 0);
  }

  // базовые
  const startIso = session?.start_time ? new Date(session.start_time).toISOString() : null;
  const duration = toInt(session?.total_timer_time) ?? toInt(session?.total_elapsed_time)
                ?? (ts.length >= 2 ? Math.max(0, Math.round(ts[ts.length - 1] - ts[0])) : null);
  const distance = toInt(session?.total_distance);
  const avgSpeedMs =
    Number.isFinite(Number(session?.avg_speed)) ? Number(session.avg_speed)
    : (distance && duration && duration > 0) ? distance / duration
    : (sp.length ? (sp.reduce((a,b)=>a+b,0) / sp.length) : null);

  // moving/elevation
  const moving = ts.length ? calcMovingTime(sp, ts, 0.5) : null;
  const elev = alt.length ? calcElevGainLoss(alt, ts) : { up: null, down: null };

  // каденс: для бега обычно шаг/мин; некоторые устройства отдают «шаги/2» (страйды)
  const sport = mapSport(session?.sport || data?.sport || data?.activity?.sport);
  const avgCadRaw = cad.length ? Math.round(cad.reduce((a,b)=>a+b,0) / cad.length) : null;
  const avgCadSpm = sport === "run" && avgCadRaw ? (avgCadRaw < 120 ? avgCadRaw * 2 : avgCadRaw) : null;
  const avgCadRpm = sport === "ride" && avgCadRaw ? avgCadRaw : null;

  // мощность
  const avgPower = toInt(session?.avg_power) ?? (pow.length ? Math.round(pow.reduce((a,b)=>a+b,0)/pow.length) : null);
  const maxPower = toInt(session?.max_power) ?? (pow.length ? Math.max(...pow) : null);
  const np = pow.length && ts.length ? calcNP(pow, ts) : null;

  // темп/скорость
  const avgSpeedKmh = avgSpeedMs ? toNum(avgSpeedMs * 3.6, 2) : null;
  const avgPaceSecPerKm = (sport === "run" || sport === "walk" || sport === "hike")
    ? (avgSpeedMs && avgSpeedMs > 0 ? Math.round(1000 / avgSpeedMs) : null)
    : null;

  // пульс/калории
  const avgHr = toInt(session?.avg_heart_rate) ?? (hr.length ? Math.round(hr.reduce((a,b)=>a+b,0)/hr.length) : null);
  const maxHr = toInt(session?.max_heart_rate) ?? (hr.length ? Math.max(...hr) : null);
  const calories = toInt(session?.total_calories) ?? null;

  // эффективность и decoupling (если есть пульс и скорость)
  const ef = (avgSpeedMs && avgHr && avgHr > 0) ? Number((avgSpeedMs / avgHr).toFixed(3)) : null;
  const paHrPct = (sp.length && hr.length) ? calcPaHrPct(sp, hr, ts) : null;

  // подспорт
  const subSport = (session?.sub_sport || data?.activity?.sub_sport || "").toString().toLowerCase() || null;

  // device_info (best-effort)
  let device_info: any = null;
  try {
    const di = Array.isArray((data as any)?.device_infos) ? (data as any).device_infos : (data as any)?.device_info;
    if (di && Array.isArray(di) && di.length) {
      const last = di[di.length - 1] || {};
      device_info = {
        manufacturer: last?.manufacturer ?? null,
        product: last?.product ?? null,
        serial_number: last?.serial_number ?? null,
        software_version: last?.software_version ?? null,
      };
    }
  } catch {}

  return {
    // базовые даты
    start_time: startIso,
    local_date: startIso ? startIso.slice(0, 10) : null,

    // объёмы и время
    duration_sec: duration ?? null,
    moving_time_sec: moving ?? null,
    distance_m: distance ?? null,

    // высота
    elev_gain_m: elev.up,
    elev_loss_m: elev.down,

    // скорость/темп
    avg_speed_kmh: avgSpeedKmh,
    avg_pace_s_per_km: avgPaceSecPerKm,

    // пульс
    avg_hr: avgHr,
    max_hr: maxHr,

    // каденс
    avg_cadence_spm: sport === "run" ? (avgCadSpm ?? null) : null,
    avg_cadence_rpm: sport === "ride" ? (avgCadRpm ?? null) : null,

    // мощность
    avg_power_w: avgPower,
    max_power_w: maxPower,
    np_power_w: np,

    // прочее
    calories_kcal: calories,
    ef,
    pa_hr_pct: paHrPct,

    // семантика
    sport,
    sub_sport: subSport,

    // устройство
    device_info,

    // сводка
    laps_count: laps?.length ?? null,
    fit_summary: {
      sessions: !!data.sessions,
      laps: laps?.length ?? 0,
      records: records?.length ?? 0,
      has_power: !!(pow?.length && maxPower),
      has_hr: !!(hr?.length && maxHr),
      has_alt: !!(alt?.length),
    },

    // series for preview
    series: {
      time_s: ts.length ? ts.map(t => Math.round(t - ts[0])) : [],
      speed_ms: sp,
      hr,
    },
  };
}

function parseGPXorTCX(xmlText: string) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const doc = parser.parse(xmlText);
  let pts: { lat: number; lon: number; time?: string }[] = [];
  let sport: string | undefined;

  // GPX
  if (doc.gpx) {
    sport = doc.gpx?.type;
    const trk = doc.gpx.trk;
    const segs = Array.isArray(trk?.trkseg) ? trk.trkseg : [trk?.trkseg].filter(Boolean);
    for (const seg of segs) {
      const arr = Array.isArray(seg?.trkpt) ? seg.trkpt : [seg?.trkpt].filter(Boolean);
      for (const p of arr) pts.push({ lat: Number(p.lat), lon: Number(p.lon), time: p?.time });
    }
  }

  // TCX
  if (!pts.length && doc.TrainingCenterDatabase) {
    const acts = doc.TrainingCenterDatabase.Activities?.Activity;
    sport = acts?.Sport;
    const laps = Array.isArray(acts?.Lap) ? acts.Lap : [acts?.Lap].filter(Boolean);
    for (const lap of laps) {
      const tracks = Array.isArray(lap?.Track) ? lap.Track : [lap?.Track].filter(Boolean);
      for (const trk of tracks) {
        const tp = Array.isArray(trk?.Trackpoint) ? trk.Trackpoint : [trk?.Trackpoint].filter(Boolean);
        for (const p of tp) {
          const pos = p?.Position;
          if (pos && pos.LatitudeDegrees !== undefined && pos.LongitudeDegrees !== undefined) {
            pts.push({
              lat: Number(pos.LatitudeDegrees),
              lon: Number(pos.LongitudeDegrees),
              time: p?.Time,
            });
          }
        }
      }
    }
  }

  if (!pts.length) return null;

  // простая дистанция и длительность
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  let dist = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if ([a.lat, a.lon, b.lat, b.lon].every(Number.isFinite)) {
      const dLat = toRad(b.lat - a.lat);
      const dLon = toRad(b.lon - a.lon);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      dist += 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }
  }
  const startIso = pts[0]?.time ? new Date(pts[0].time).toISOString() : null;
  const endIso = pts.at(-1)?.time ? new Date(pts.at(-1)!.time!) : null;
  const duration =
    startIso && endIso ? Math.max(0, Math.round((+new Date(endIso) - +new Date(startIso)) / 1000)) : null;
  const avgSpeedKmh =
    dist && duration && duration > 0 ? Number(((dist / duration) * 3.6).toFixed(2)) : null;

  return {
    start_time: startIso,
    local_date: startIso ? startIso.slice(0, 10) : null,
    duration_sec: duration,
    distance_m: Math.round(dist),
    avg_speed_kmh: avgSpeedKmh,
    sport: mapSport(sport),
  };
}

async function parseBufferByExt(ext: string, ab: ArrayBuffer) {
  if (ext === "fit") return await parseFIT(ab);
  if (ext === "gpx" || ext === "tcx") {
    const text = new TextDecoder().decode(new Uint8Array(ab));
    return parseGPXorTCX(text);
  }
  if (ext === "zip") {
    const u8 = new Uint8Array(ab);
    const files = unzipSync(u8);
    const names = Object.keys(files);
    const pick =
      names.find((n) => n.toLowerCase().endsWith(".fit")) ??
      names.find((n) => n.toLowerCase().endsWith(".gpx")) ??
      names.find((n) => n.toLowerCase().endsWith(".tcx"));
    if (!pick) return null;
    const inner = files[pick];
    const innerExt = extFromPath(pick);
    return await parseBufferByExt(innerExt, inner.buffer);
  }
  return null;
}

async function markRetry(job: Job, message: string) {
  const attempt = job.attempt ?? 0;
  const max = job.max_attempts ?? 5;
  if (attempt >= max) {
    await admin.from("import_jobs").update({
      status: "failed", finished_at: new Date().toISOString(), error_message: message
    }).eq("id", job.id);
    return;
  }
  const delaySec = Math.min(60 * 2 ** Math.max(0, attempt - 1), 1800);
  const nextAt = new Date(Date.now() + delaySec * 1000).toISOString();
  await admin.from("import_jobs").update({
    status: "retry_wait", error_message: message, scheduled_at: nextAt
  }).eq("id", job.id);
}

Deno.serve(async () => {
  try {
    const nowIso = new Date().toISOString();

    // 1) Кандидаты
    const { data: can, error: selErr } = await admin
      .from("import_jobs")
      .select("id, user_id, source_file_id, workout_id, attempt, max_attempts, status, scheduled_at")
      .in("status", ["queued", "retry_wait", "failed"])
      .lte("scheduled_at", nowIso)
      .order("priority", { ascending: false })
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(3);
    if (selErr) throw selErr;

    // 2) Клейм
    const picked: Job[] = [];
    for (const j of (can || []) as Job[]) {
      const { data: upd, error: uerr } = await admin
        .from("import_jobs")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          attempt: (j.attempt ?? 0) + 1,
          locked_by: "edge-fn",
          locked_at: new Date().toISOString(),
        })
        .eq("id", j.id)
        .in("status", ["queued", "retry_wait", "failed"])
        .select("id, user_id, source_file_id, workout_id, attempt, max_attempts, status, scheduled_at")
        .maybeSingle();
      if (!uerr && upd) picked.push(upd as unknown as Job);
    }

    let processed = 0, failed: string[] = [], succeeded: string[] = [];

    for (const job of picked) {
      try {
        // 3) Строка файла
        const { data: wf, error: wfErr } = await admin
          .from("workout_files")
          .select("id, user_id, storage_bucket, storage_path, filename, size_bytes, extension, workout_id, status")
          .eq("id", job.source_file_id)
          .maybeSingle();
        if (wfErr || !wf) throw wfErr || new Error("file row not found");

        await admin.from("workout_files").update({ status: "processing" }).eq("id", wf.id);

        // 4) Скачивание
        const dl = await admin.storage.from(wf.storage_bucket).download(wf.storage_path);
        if (dl.error) throw dl.error;
        const ab = await dl.data.arrayBuffer();

        // 5) Парсинг
        const ext = (wf.extension || extFromPath(wf.storage_path) || "fit").toLowerCase();
        const upd = await parseBufferByExt(ext, ab);
        if (!upd) throw new Error("Unsupported or unparsable file");

        // 6) ensure workout
        let wid = wf.workout_id || job.workout_id;
        if (!wid) {
          const { data: wrec, error: wcre } = await admin
            .from("workouts")
            .insert([{
              user_id: wf.user_id,
              source: ext,
              sport: "other",                       // NOT NULL гарантия
              uploaded_at: new Date().toISOString(),
              storage_path: wf.storage_path,
              filename: wf.filename,
              size_bytes: wf.size_bytes,
            }])
            .select("id")
            .single();
          if (wcre || !wrec?.id) throw wcre || new Error("failed to create workout");
          wid = wrec.id;
          await admin.from("workout_files").update({ workout_id: wid }).eq("id", wf.id);
        }

        // 7) Обновление метрик (без поля status)
        const generatedName = makeWorkoutName(
          (upd as any).sport,
          (upd as any).distance_m,
          (upd as any).sub_sport,
          (upd as any).has_gps,
          (upd as any).local_date
        );

        const { error: werr } = await admin
          .from("workouts")
          .update({
            // даты
            start_time: (upd as any).start_time ?? null,
            local_date: (upd as any).local_date ?? null,

            // объёмы/время
            duration_sec: (upd as any).duration_sec ?? null,
            moving_time_sec: (upd as any).moving_time_sec ?? null,
            distance_m: (upd as any).distance_m ?? null,

            // высота
            elev_gain_m: (upd as any).elev_gain_m ?? null,
            elev_loss_m: (upd as any).elev_loss_m ?? null,

            // скорость/темп
            avg_speed_kmh: (upd as any).avg_speed_kmh ?? null,
            avg_pace_s_per_km: (upd as any).avg_pace_s_per_km ?? null,

            // пульс
            avg_hr: (upd as any).avg_hr ?? null,
            max_hr: (upd as any).max_hr ?? null,

            // каденс
            avg_cadence_spm: (upd as any).avg_cadence_spm ?? null,
            avg_cadence_rpm: (upd as any).avg_cadence_rpm ?? null,

            // мощность
            avg_power_w: (upd as any).avg_power_w ?? null,
            max_power_w: (upd as any).max_power_w ?? null,
            np_power_w: (upd as any).np_power_w ?? null,

            // энергия/метрики выносливости
            calories_kcal: (upd as any).calories_kcal ?? null,
            ef: (upd as any).ef ?? null,
            pa_hr_pct: (upd as any).pa_hr_pct ?? null,

            // семантика
            sport: (upd as any).sport ?? "other",
            sub_sport: (upd as any).sub_sport ?? null,

            // агрегаты
            laps_count: (upd as any).laps_count ?? null,

            // устройство
            device_info: (upd as any).device_info ?? null,

            // сводка
            fit_summary: (upd as any).fit_summary ?? null,

            // имя
            name: generatedName,
          })
          .eq("id", wid);
        if (werr) throw werr;

        // === превью-стримы для графиков (pace & hr)
        try {
          const ser = (upd as any)?.series;
          const time_s: number[] = Array.isArray(ser?.time_s) ? ser.time_s : [];
          const speed_ms: number[] = Array.isArray(ser?.speed_ms) ? ser.speed_ms : [];
          const hr: number[] = Array.isArray(ser?.hr) ? ser.hr : [];

          if (time_s.length && speed_ms.length === time_s.length) {
            // pace: сек/км (0/NaN → null)
            const pace: (number|null)[] = speed_ms.map(v => (v && v > 0 ? Math.round(1000 / v) : null));

            // даунсэмпл (до 1500 точек)
            const dsPace = downsamplePair(time_s, pace, 1500);
            const dsHr   = downsamplePair(time_s, hr.map(v => Number.isFinite(v) ? v : null), 1500);

            const points = Math.max(dsPace.x.length, dsHr.x.length);

            // upsert превью
            await admin.from("workout_streams_preview")
              .upsert({
                workout_id: wid,
                user_id: wf.user_id,
                points_count: points,
                s: {
                  time_s: dsPace.x,             // общая ось времени (сек от старта)
                  pace_s_per_km: dsPace.y,      // темп (сек/км)
                  hr: dsHr.y,                   // пульс (bpm)
                } as any,
              }, { onConflict: "workout_id" });
          }
        } catch (e) {
          console.warn("[worker] preview upsert warning:", (e as any)?.message || e);
        }

        // 8) Финализация
        await admin.from("workout_files")
          .update({ status: "ready", processed_at: new Date().toISOString() })
          .eq("id", wf.id);

        await admin.from("import_jobs")
          .update({
            status: "succeeded",
            finished_at: new Date().toISOString(),
            error_message: null,
            output: { workout_id: wid, file_id: wf.id, parsed_ext: ext } as any,
          })
          .eq("id", job.id);

        processed++;
        succeeded.push(job.id);
      } catch (e: any) {
        const msg = (e?.message || String(e)).slice(0, 500);
        failed.push(job.id);
        await markRetry(job, msg);
      }
    }

    return new Response(JSON.stringify({ processed, claimed: picked.map(j=>j.id), succeeded, failed }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "internal" }), {
      status: 500, headers: { "content-type": "application/json" }
    });
  }
});