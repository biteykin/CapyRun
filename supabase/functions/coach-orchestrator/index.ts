// supabase/functions/coach-orchestrator/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getMode(req: Request) {
  const url = new URL(req.url);
  const isCron = req.headers.get("x-supabase-cron") === "true";
  const manual = url.searchParams.get("manual") === "1";
  return { isCron, manual };
}

function checkOrchToken(req: Request) {
  // секрет должен быть создан как X_ORCH_TOKEN в Edge Functions → Secrets
  const expected = Deno.env.get("X_ORCH_TOKEN") ?? Deno.env.get("x-orch-token");
  if (!expected) return { ok: false as const, why: "Missing X_ORCH_TOKEN secret on function" };

  const got = req.headers.get("x-orch-token");
  if (!got) return { ok: false as const, why: "Missing x-orch-token header" };

  if (got !== expected) return { ok: false as const, why: "Bad x-orch-token" };
  return { ok: true as const };
}

async function readQueueCounts(supabase: any) {
  // summary по очереди
  const { data, error } = await supabase
    .from("coach_cycle_queue")
    .select("status", { count: "exact", head: false });

  if (error) return { ok: false, error };

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const s = row?.status ?? "unknown";
    counts[s] = (counts[s] ?? 0) + 1;
  }

  const pending_total = counts["pending"] ?? 0;

  // pending_ready отдельным запросом
  const { data: ready, error: e2 } = await supabase
    .from("coach_cycle_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("run_after", new Date().toISOString());

  if (e2) return { ok: false, error: e2 };

  const pending_ready = (ready as any)?.count ?? 0;

  return { ok: true, counts, pending_total, pending_ready };
}

Deno.serve(async (req) => {
  try {
    const { isCron } = getMode(req);

    // Разрешаем:
    // - cron вызовы (x-supabase-cron: true)
    // - ручной вызов с токеном (x-orch-token)
    const tokenCheck = checkOrchToken(req);
    if (!isCron && !tokenCheck.ok) {
      return json({ error: "Forbidden", details: tokenCheck.why }, 403);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Параметры оркестратора
    const limit = 50;
    const onlyUserId = null;
    const doForecast = false;

    const queueBefore = await readQueueCounts(supabase);

    // 1) Оркестратор
    const { data: cycle, error: cycleErr } = await supabase.rpc("run_coach_cycle", {
      p_limit: limit,
      p_only_user_id: onlyUserId,
      p_do_forecast: doForecast,
    });

    if (cycleErr) {
      return json({ ok: false, where: "rpc run_coach_cycle", error: cycleErr }, 500);
    }

    // 2) Авто-чистка очереди
    const { data: queueCleanup, error: queueCleanupErr } = await supabase.rpc("cleanup_coach_cycle_queue", {
      p_keep_done_days: 7,
      p_keep_failed_days: 30,
      p_limit: 5000,
    });

    // 3) Авто-чистка снапшотов
    const { data: snapCleanup, error: snapCleanupErr } = await supabase.rpc(
      "cleanup_coach_context_snapshots",
      {
        p_keep_active_days: 30,
        p_keep_superseded_days: 7,
        p_keep_failed_days: 30,
        p_limit: 5000,
      },
    );

    // 4) Авто-чистка goal_state_cache
    const { data: gscCleanup, error: gscCleanupErr } = await supabase.rpc("cleanup_goal_state_cache", {
      p_keep_days: 60,
      p_limit: 5000,
    });

    const queueAfter = await readQueueCounts(supabase);

    // Не валим весь ран из-за уборок — возвращаем warnings
    const warnings: Record<string, unknown> = {};
    if (queueCleanupErr) warnings["cleanup_queue"] = queueCleanupErr;
    if (snapCleanupErr) warnings["cleanup_snapshots"] = snapCleanupErr;
    if (gscCleanupErr) warnings["cleanup_goal_state_cache"] = gscCleanupErr;

    return json({
      ok: true,
      mode: isCron ? "cron" : "manual",
      params: { limit, onlyUserId, doForecast },
      queue_before: queueBefore,
      processed: cycle,
      cleanup: {
        queue: queueCleanupErr ? null : queueCleanup,
        snapshots: snapCleanupErr ? null : snapCleanup,
        goal_state_cache: gscCleanupErr ? null : gscCleanup,
      },
      cleanup_warnings: Object.keys(warnings).length ? warnings : null,
      queue_after: queueAfter,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});