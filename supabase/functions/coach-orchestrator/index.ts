// supabase/functions/coach-orchestrator/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    // 1) Простая защита: разрешаем только cron/серверные вызовы.
    // Supabase Scheduled Triggers шлёт этот header.
    const isCron = req.headers.get("x-supabase-cron") === "true";
    if (!isCron) {
      return new Response(JSON.stringify({ error: "Forbidden (not a cron trigger)" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    // 2) Инициализируем supabase client с service_role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 3) Параметры (можно менять)
    const limit = 50;        // сколько задач за один запуск
    const onlyUserId = null; // обычно null
    const doForecast = false;

    // 4) Запускаем оркестратор
    const { data, error } = await supabase.rpc("run_coach_cycle", {
      p_limit: limit,
      p_only_user_id: onlyUserId,
      p_do_forecast: doForecast,
    });

    if (error) {
      return new Response(JSON.stringify({ ok: false, where: "rpc run_coach_cycle", error }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, result: data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});