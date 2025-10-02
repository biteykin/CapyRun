// frontend/components/profile/profile-header.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail } from "lucide-react";

type Props = {
  avatarUrl?: string | null;
  displayName: string;
  email: string | null;
};

export default function ProfileHeader({ avatarUrl, displayName, email }: Props) {
  // как просил: не меняю путь
  const fallbackAvatar = "/avatars/default-1.svg";
  const src = avatarUrl || fallbackAvatar;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <Avatar className="h-24 w-24">
            <AvatarImage src={src} alt="Profile" />
            <AvatarFallback className="text-2xl">
              {(displayName?.[0] ?? "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-bold">
              {displayName || "Резвая Капибара"}
            </h1>

            <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
              {email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-4" />
                  {email}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}