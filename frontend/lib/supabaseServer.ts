// lib/supabaseServer.ts
// Шим для совместимости со старыми импортами из pages/**
// Здесь НЕТ next/headers, чтобы не ломать сборку.
// Если этот хелпер вызовут в рантайме — бросим понятную ошибку.

export function createSupabaseServerClient() {
  throw new Error(
    'createSupabaseServerClient(): используйте версию из "lib/supabaseServerApp" внутри app/** (App Router). ' +
    "Этот shim существует только чтобы не падала сборка pages/."
  );
}