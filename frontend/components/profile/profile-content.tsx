import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import ProfileHrZones from "@/components/profile/profile-hr-zones";
import { HeartPulse, PersonStanding, Ruler, Weight } from "lucide-react";

type ProfileData = {
  userId: string;
  age?: number | null;
  workoutsCount?: number | null;
  gender?: string | null;
  weight?: number | null;
  height?: number | null;
  max_hr?: number | null;
  hr_zones?: unknown | null;
};

export default function ProfileContent({ profile }: { profile: ProfileData }) {
  return (
    <Tabs defaultValue="personal" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="personal">Личные данные</TabsTrigger>
        <TabsTrigger value="zones">Пульсовые зоны</TabsTrigger>
      </TabsList>

      <TabsContent value="personal">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Личная информация</CardTitle>
            <CardDescription>Базовые параметры профиля и тренировок</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <DataTile
                label="Возраст"
                value={profile.age ?? "—"}
                icon={<PersonStanding className="size-4" />}
              />
              <DataTile
                label="Пол"
                value={profile.gender ?? "—"}
                icon={<PersonStanding className="size-4" />}
              />
              <DataTile
                label="Вес"
                value={profile.weight != null ? `${profile.weight} кг` : "—"}
                icon={<Weight className="size-4" />}
              />
              <DataTile
                label="Рост"
                value={profile.height != null ? `${profile.height} см` : "—"}
                icon={<Ruler className="size-4" />}
              />
              <DataTile
                label="Макс. пульс"
                value={profile.max_hr != null ? `${profile.max_hr} bpm` : "—"}
                icon={<HeartPulse className="size-4" />}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="zones">
        <ProfileHrZones
          userId={profile.userId}
          age={profile.age ?? null}
          workoutsCount={profile.workoutsCount ?? null}
          maxHr={profile.max_hr ?? null}
          hrZones={profile.hr_zones ?? null}
        />
      </TabsContent>
    </Tabs>
  );
}

function DataTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-muted/15 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <Label className="text-xs text-muted-foreground">{label}</Label>
      </div>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}
