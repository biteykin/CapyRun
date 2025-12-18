import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import StravaSyncButton from "@/components/settings/strava-sync-button";
import StravaDisconnectButton from "@/components/settings/strava-disconnect-button";

export default async function SettingsPage({
  searchParams,
}: { searchParams?: Record<string, string | string[] | undefined> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: conn } = await supabase
    .from("external_accounts")
    .select("id, provider, status, created_at, updated_at, last_synced_at, error_message")
    .eq("user_id", user.id)
    .eq("provider", "strava")
    .maybeSingle();

  const isConnected = !!conn && conn.status === "connected";
  const autosync = searchParams?.autosync === "1";

  return (
    <main className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
          <CardDescription>Подключения и интеграции</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Strava</CardTitle>
              {!isConnected ? (
                <CardDescription>Подключите Strava, чтобы импортировать тренировки.</CardDescription>
              ) : (
                <CardDescription>Подключено ✅ Импорт и синхронизация тренировок.</CardDescription>
              )}
            </CardHeader>

            <CardContent className="flex items-center gap-2">
              {!isConnected ? (
                <Link href="/api/strava/connect" className={buttonVariants()}>
                  Подключить Strava
                </Link>
              ) : (
                <div className="space-y-2 w-full">
                  <div className="text-sm text-muted-foreground">
                    Последняя синхронизация:{" "}
                    {conn?.last_synced_at ? new Date(conn.last_synced_at).toLocaleString() : "—"}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <StravaSyncButton disabled={!isConnected} autoStart={autosync} />
                    <StravaDisconnectButton disabled={!isConnected} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </main>
  );
}