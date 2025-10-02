// frontend/components/profile/profile-header.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail } from "lucide-react";

type Props = {
  avatarUrl?: string | null;
  displayName: string;
  email: string | null;
};

export default function ProfileHeader({ avatarUrl, displayName, email }: Props) {
  // дефолтная картинка, если у пользователя нет аватара или он не грузится
  const fallbackAvatar = "/avatars/default-01.svg";
  const [imgErr, setImgErr] = useState(false);
  const src = imgErr ? fallbackAvatar : (avatarUrl || fallbackAvatar);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={src} alt="Profile" onError={() => setImgErr(true)} />
              <AvatarFallback className="text-2xl">
                {displayName[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
              {email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-4" />
                  {email}
                </span>
              )}
            </div>
          </div>
          {/* Кнопка редактирования можно добавить позже */}
        </div>
      </CardContent>
    </Card>
  );
}