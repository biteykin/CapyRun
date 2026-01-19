// supabase/functions/coach-orchestrator/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

Deno.serve(async (req) => {
  try {
    const isCron = req.headers.get("x-supabase-cron") === "true";
    if (!isCron) {
      return new Response(JSON.stringify({ error: "Forbidden (not a cron trigger)" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

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

    const { data, error } = await supabase.rpc("run_coach_cycle", {
      p_limit: 50,
      p_only_user_id: null,
      p_do_forecast: false,
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