// scripts/fetch-weather-batch.mjs
// Usage:
//   node scripts/fetch-weather-batch.mjs
//
// Env vars (можно из .env.local):
//   SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...   (или SERVICE_ROLE_KEY=... если так у тебя)
//   SUPABASE_ANON_KEY=...           (если хочешь дергать функцию по anon; но лучше service role не светить)
//
// Notes:
// - Список workout_id мы читаем из Postgres через supabase-js с service role.
// - Вызов Edge Function делаем через HTTPS с anon key (publishable) или service role — как тебе удобнее.
//   Тут используем ANON (publishable), чтобы логика была ближе к реальному клиенту.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error("Missing SUPABASE_URL");
  process.exit(1);
}
if (!SERVICE) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY)");
  process.exit(1);
}
if (!ANON) {
  console.error("Missing SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  process.exit(1);
}

// 1) сервисный клиент — только чтобы читать список
const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 2) настройка батча
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const SLEEP_MS = Number(process.env.SLEEP_MS || 150);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callFunction(workout_id) {
  const url = `${SUPABASE_URL}/functions/v1/workout-weather-fetch`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
    body: JSON.stringify({ workout_id }),
  });

  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { ok: false, error: "non_json_response", raw: text };
  }

  return { status: resp.status, json };
}

async function main() {
  // Берём те, у кого координаты валидны и source != open-meteo
  // Используем твою функцию is_valid_geo_point(lat,lng)
  const { data, error } = await admin.rpc("workout_weather_list_to_fetch_open_meteo", {});
  // Если rpc нет — fallback на прямой select ниже (см. комментарий)
  if (error) {
    console.log("[info] RPC workout_weather_list_to_fetch_open_meteo not found, using direct query fallback…");

    const { data: rows, error: e2 } = await admin
      .from("workout_weather")
      .select("workout_id, lat, lng, source")
      .neq("source", "open-meteo")
      .or("source.is.null,source.neq.open-meteo"); // мягко

    if (e2) throw e2;

    // фильтруем валидные координаты на стороне js тем же правилом (>=0.1)
    const ids = (rows || [])
      .filter((r) => r.lat != null && r.lng != null && Math.abs(r.lat) >= 0.1 && Math.abs(r.lng) >= 0.1)
      .map((r) => r.workout_id);

    await runBatch(ids);
    return;
  }

  const ids = (data || []).map((r) => r.workout_id);
  await runBatch(ids);
}

async function runBatch(ids) {
  console.log(`To fetch: ${ids.length}`);

  let ok = 0;
  let skipped = 0;
  let fail = 0;

  const queue = [...ids];
  const workers = Array.from({ length: CONCURRENCY }, async (_, wi) => {
    while (queue.length) {
      const workout_id = queue.shift();
      if (!workout_id) return;

      try {
        const { status, json } = await callFunction(workout_id);

        if (json?.ok === true) {
          ok++;
          console.log(`[${wi}] OK   ${workout_id}  (${ok}/${ids.length})`);
        } else if (json?.error === "no_valid_coords") {
          skipped++;
          console.log(`[${wi}] SKIP ${workout_id}  no_valid_coords`);
        } else {
          fail++;
          console.log(`[${wi}] FAIL ${workout_id}  status=${status}  error=${json?.error ?? "unknown"}`);
        }
      } catch (e) {
        fail++;
        console.log(`[${wi}] FAIL ${workout_id}  exception=${String(e)}`);
      }

      await sleep(SLEEP_MS);
    }
  });

  await Promise.all(workers);

  console.log("\nSummary:");
  console.log(`  ok:      ${ok}`);
  console.log(`  skipped: ${skipped}`);
  console.log(`  fail:    ${fail}`);
}

main().catch((e) => {
  console.error("Batch failed:", e);
  process.exit(1);
});