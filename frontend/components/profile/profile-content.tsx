import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import ProfileHrZones from "@/components/profile/profile-hr-zones";

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
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="personal">Личные данные</TabsTrigger>
        <TabsTrigger value="zones">Пульсовые зоны</TabsTrigger>
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Пульсовые зоны (график) */}
      <TabsContent value="zones">
        <ProfileHrZones maxHr={profile.max_hr ?? null} hrZones={profile.hr_zones ?? null} />
      </TabsContent>
    </Tabs>
  );
}