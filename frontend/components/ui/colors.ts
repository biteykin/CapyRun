export type ColorEntry = { hex: string; name: string };

// Утилита: "#RRGGBB" -> "R, G, B"
export function rgbString(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return "";
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `${r}, ${g}, ${b}`;
}

/** Именованные палитры (группы → массив {hex, name}) */
export const COLORS_NAMED: Record<string, ColorEntry[]> = {
  primary: [{ hex: "#F0F1EC", name: "bg-primary" }],

  danger: [
    { hex: "#FD9287", name: "bg-danger-lighter" }, // 253,146,135
    { hex: "#D43519", name: "bg-danger-light" },
    { hex: "#D0220B", name: "bg-danger" },
    { hex: "#851907", name: "bg-danger-dark" },
  ],

  warning: [
    { hex: "#F0E7D4", name: "bg-warning-highlight" },
    { hex: "#F3950A", name: "bg-warning" },
    { hex: "#D7811C", name: "bg-warning-dark" },
  ],

  success: [
    { hex: "#D9E5D1", name: "bg-success-highlight" },
    { hex: "#4E8E27", name: "bg-success-light" },
    { hex: "#2D7601", name: "bg-success" },
    { hex: "#1D4700", name: "bg-success-dark" },
  ],

  "primary-alt": [
    { hex: "#DEE2D9", name: "bg-primary-alt-highlight" },
    { hex: "#0E0E0E", name: "bg-primary-alt" },
  ],

  text: [
    { hex: "#595958", name: "text-1" },
    { hex: "#0E0E0E", name: "text-2" },
  ],

  border: [
    { hex: "#C4C6C0", name: "bg-border" },
    { hex: "#D8DAD5", name: "bg-border-light" },
    { hex: "#AAACA8", name: "bg-border-bold" },
  ],

  light: [
    { name: "bg-transparent", hex: "#FFFFFF" },
  ],

  buttons: [
    { name: "btn-primary-main",   hex: "#E58B21" },
    { name: "btn-primary-shadow", hex: "#D69036" },
    { name: "btn-primary-border", hex: "#A16413" },
    { name: "btn-primary-text",   hex: "#0E0E0E" },
    { name: "btn-primary-hover",  hex: "#ED9933" },
    { name: "btn-secondary-main",   hex: "#F0F1EC" },
    { name: "btn-secondary-shadow", hex: "#F39174" },
    { name: "btn-secondary-border", hex: "#E15425" },
    { name: "btn-secondary-text",   hex: "#0E0E0E" },
    { name: "btn-secondary-hover",  hex: "#EAEBE6" },
    { name: "btn-danger-main",   hex: "#F0F1EC" },
    { name: "btn-danger-shadow", hex: "#F39174" },
    { name: "btn-danger-border", hex: "#E15425" },
    { name: "btn-danger-text",   hex: "#EF3707" },
    { name: "btn-danger-hover",  hex: "#F6C2B5" },
  ],

  // Дополнительные одиночные цвета
  extra: [
    { hex: "#1519FE", name: "bg-blue" },   // 21,41,254
    { hex: "#EF3707", name: "bg-red" },    // 239,55,7
    { hex: "#F6B021", name: "bg-yellow" }, // 246,176,33
    { hex: "#000000", name: "bg-key" },    // 0,0,0
  ],

  // Если у тебя уже есть группа data в проекте — оставляем её как раньше
  // (пример; можно убрать/заменить своей текущей версией)
  data: [
    { hex: "#1519FE", name: "data-color-1" },
    { hex: "#4E0095", name: "data-color-2" },
    { hex: "#356F6B", name: "data-color-3" },
    { hex: "#C00060", name: "data-color-4" },
    { hex: "#EB3646", name: "data-color-5" },
    { hex: "#67340D", name: "data-color-6" },
    { hex: "#448B0B", name: "data-color-7" },
    { hex: "#FB578D", name: "data-color-8" },
    { hex: "#283158", name: "data-color-9" },
    { hex: "#39C1B7", name: "data-color-10" },
    { hex: "#0C5BF9", name: "data-color-11" },
    { hex: "#A53806", name: "data-color-12" },
    { hex: "#DC970B", name: "data-color-13" },
    { hex: "#934FFF", name: "data-color-14" },
    { hex: "#2DCEBC", name: "data-color-15" },
  ],
};

/** Легаси-выгрузка только hex (если где-то ещё используется) */
export const COLORS_HEX: Record<string, string[]> = {
  light: ["#FFFFFF"], // bg-transparent

  /* Buttons (tokens) */
  buttons: [
    "#E58B21", // btn-primary-main
    "#D69036", // btn-primary-shadow
    "#A16413", // btn-primary-border
    "#0E0E0E", // btn-primary-text
    "#ED9933", // btn-primary-hover
    "#F0F1EC", // btn-secondary-main
    "#F39174", // btn-secondary-shadow
    "#E15425", // btn-secondary-border
    "#0E0E0E", // btn-secondary-text
    "#EAEBE6", // btn-secondary-hover
    "#F0F1EC", // btn-danger-main
    "#F39174", // btn-danger-second
    "#E15425", // btn-danger-border
    "#EF3707", // btn-danger-text
    "#F6C2B5", // btn-danger-hover
  ],
};