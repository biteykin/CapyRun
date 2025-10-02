// frontend/components/profile/profile-content.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

// ВАЖНО: для server action нужны эти импорты
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type ProfileData = {
  age?: number | null;
  gender?: string | null;
  weight?: number | null;
  height?: number | null;
  max_hr?: number | null;
  hr_zones?: unknown | null;
};

export default function ProfileContent({ profile }: { profile: ProfileData }) {
  return (
    <Tabs defaultValue="personal" className="space-y-6">
      <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
        <TabsTrigger value="personal">Личные данные</TabsTrigger>
        <TabsTrigger value="account">Выход</TabsTrigger>
      </TabsList>

      {/* Личные данные */}
      <TabsContent value="personal">
        <Card>
          <CardHeader>
            <CardTitle>Личная информация</CardTitle>
            <CardDescription>Ваши персональные данные</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <Label className="text-sm text-muted-foreground">Возраст</Label>
                <p className="text-base font-medium">{profile.age ?? "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Пол</Label>
                <p className="text-base font-medium">{profile.gender ?? "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Вес (кг)</Label>
                <p className="text-base font-medium">{profile.weight ?? "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Рост (см)</Label>
                <p className="text-base font-medium">{profile.height ?? "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Макс. пульс</Label>
                <p className="text-base font-medium">{profile.max_hr ?? "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Пульсовые зоны</Label>
                <p className="text-base font-medium">
                  {profile.hr_zones ? JSON.stringify(profile.hr_zones) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Выход */}
      <TabsContent value="account">
        <Card>
          <CardHeader>
            <CardTitle>Выход</CardTitle>
            <CardDescription>Завершите сессию и вернитесь на главную</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async () => {
                "use server";
                // Создаём SSR-клиент с публичным ключом — для logout этого достаточно.
                const jar = await cookies();
                const supabase = createServerClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                  {
                    cookies: {
                      getAll() {
                        return jar.getAll();
                      },
                      setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                          jar.set(name, value, options)
                        );
                      },
                    },
                  }
                );

                await supabase.auth.signOut();
                redirect("/"); // уводим на публичный лендинг
              }}
            >
              <Button type="submit">Выйти из аккаунта</Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}