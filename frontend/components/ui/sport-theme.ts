// components/ui/sport-theme.ts
export type SportKey =
  | "run" | "ride" | "swim" | "walk" | "hike" | "row"
  | "strength" | "yoga" | "aerobics" | "crossfit" | "pilates" | "other";

export const SPORT_LABEL: Record<SportKey, string> = {
  run: "Бег",
  ride: "Вело",
  swim: "Плавание",
  walk: "Ходьба",
  hike: "Хайк",
  row: "Гребля",
  strength: "Силовая",
  yoga: "Йога",
  aerobics: "Аэробика",
  crossfit: "Кроссфит",
  pilates: "Пилатес",
  other: "Другая",
};

export const SPORT_COLOR: Record<SportKey, string> = {
  run: "#30bb5c",
  ride: "#a400d0",
  swim: "#2565f9",
  walk: "#f3950a",
  hike: "#87e2a8",
  row: "#2790c8",
  strength: "#ed3b44",
  yoga: "#a400d0",
  aerobics: "#F59E0B",
  crossfit: "#9333EA",
  pilates: "#22D3EE",
  other: "#B7B9AE",
};

export function sportKey(s?: string | null): SportKey {
  const k = (s || "other").toLowerCase();
  return (k in SPORT_LABEL ? k : "other") as SportKey;
}
export function humanSport(s?: string | null): string {
  return SPORT_LABEL[sportKey(s)];
}
export function sportColor(s?: string | null): string {
  return SPORT_COLOR[sportKey(s)];
}