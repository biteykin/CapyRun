// frontend/components/profile/profile-content.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

type ProfileData = {
  age?: number | null;
  gender?: string | null;
  weight?: number | null;
  height?: number | null;
  max_hr?: number | null;
  hr_zones?: any | null;
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
                const supabase = createServerClient(
                  process.env.SUPABASE_URL!,
                  process.env.SUPABASE_SERVICE_ROLE_KEY!,
                  {
                    cookies: {
                      getAll() {
                        // получим куки из окружения сервера
                        // import cookies внутри server action нельзя, поэтому можно оставить пустой массив
                        return [];
                      },
                      setAll() {},
                    },
                  }
                );
                await supabase.auth.signOut();
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