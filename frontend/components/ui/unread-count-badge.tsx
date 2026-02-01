import * as React from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Форматирование количества непрочитанных
 * 0  → null (бейдж не показываем)
 * 1–99 → "N"
 * 100+ → "99+"
 */
export function formatUnreadCount(count: number) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  if (n > 99) return "99+";
  return String(n);
}

type UnreadCountBadgeProps = {
  count: number;
  title?: string;
  className?: string;
};

export default function UnreadCountBadge({
  count,
  title,
  className,
}: UnreadCountBadgeProps) {
  const label = formatUnreadCount(count);
  if (!label) return null;

  return (
    <Badge
      variant="unread"
      className={className}
      title={title ?? `Новых сообщений: ${count}`}
    >
      {label}
    </Badge>
  );
}