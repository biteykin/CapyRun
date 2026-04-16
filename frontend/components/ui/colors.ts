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
  primary: [{ hex: "#EDECEA", name: "bg-primary" }], // ← чуть теплее, ближе к телу Kick75

  danger: [
    { hex: "#FF9999", name: "bg-danger-lighter" }, // светлый Nintendo-красный
    { hex: "#E60012", name: "bg-danger-light" },   // чистый Nintendo-красный
    { hex: "#CC000F", name: "bg-danger" },          // насыщенный красный
    { hex: "#880008", name: "bg-danger-dark" },     // тёмный красный
  ],

  warning: [
    { hex: "#FFF8CC", name: "bg-warning-highlight" }, // светлый LEGO-жёлтый
    { hex: "#FFD600", name: "bg-warning" },           // LEGO-жёлтый (Mario coin)
    { hex: "#C9A800", name: "bg-warning-dark" },      // тёмный жёлтый
  ],

  success: [
    { hex: "#C5EDD0", name: "bg-success-highlight" }, // светлый Mario-зелёный
    { hex: "#00C85A", name: "bg-success-light" },     // яркий Mario-зелёный
    { hex: "#00A84F", name: "bg-success" },           // Mario Pipe Green
    { hex: "#007A38", name: "bg-success-dark" },      // тёмный Mario-зелёный
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
    { name: "btn-primary-main",   hex: "#FFD600" }, // LEGO-жёлтый
    { name: "btn-primary-shadow", hex: "#E6C200" }, // тень жёлтой кнопки
    { name: "btn-primary-border", hex: "#C9A800" }, // обводка жёлтой кнопки
    { name: "btn-primary-text",   hex: "#0E0E0E" },
    { name: "btn-primary-hover",  hex: "#FFE033" }, // hover чуть светлее
    { name: "btn-secondary-main",   hex: "#EDECEA" },
    { name: "btn-secondary-shadow", hex: "#F39174" },
    { name: "btn-secondary-border", hex: "#E60012" }, // Nintendo-красный
    { name: "btn-secondary-text",   hex: "#0E0E0E" },
    { name: "btn-secondary-hover",  hex: "#E8E9E4" },
    { name: "btn-danger-main",   hex: "#EDECEA" },
    { name: "btn-danger-shadow", hex: "#FF9999" },   // светлый красный
    { name: "btn-danger-border", hex: "#E60012" },   // Nintendo-красный
    { name: "btn-danger-text",   hex: "#E60012" },   // Nintendo-красный
    { name: "btn-danger-hover",  hex: "#FFD0D0" },   // светло-розовый hover
  ],

  // Дополнительные одиночные цвета
  extra: [
    { hex: "#1B2EC9", name: "bg-blue" },   // Mario-синий ← был #1519FE
    { hex: "#E60012", name: "bg-red" },    // Nintendo-красный ← был #EF3707
    { hex: "#FFD600", name: "bg-yellow" }, // LEGO-жёлтый ← был #F6B021
    { hex: "#000000", name: "bg-key" },
  ],

  data: [
    { hex: "#1B2EC9", name: "data-color-1" },  // Mario-синий ← #1519FE
    { hex: "#4E0095", name: "data-color-2" },  // тёмный фиолетовый (без изм.)
    { hex: "#2D6B9F", name: "data-color-3" },  // стально-синий ← #356F6B (teal→blue)
    { hex: "#C00060", name: "data-color-4" },  // малиновый (без изм.)
    { hex: "#E52030", name: "data-color-5" },  // Nintendo-красный вариант ← #EB3646
    { hex: "#67340D", name: "data-color-6" },  // тёмно-коричневый (без изм.)
    { hex: "#1A9E3A", name: "data-color-7" },  // Mario-зелёный вариант ← #448B0B
    { hex: "#FB578D", name: "data-color-8" },  // розовый (без изм.)
    { hex: "#283158", name: "data-color-9" },  // тёмно-синий (без изм.)
    { hex: "#42B8FF", name: "data-color-10" }, // небесно-голубой ← #39C1B7 (teal→sky)
    { hex: "#2244CC", name: "data-color-11" }, // Mario-синий тёмный ← #0C5BF9
    { hex: "#A53806", name: "data-color-12" }, // тёмно-оранжевый (без изм.)
    { hex: "#DCA800", name: "data-color-13" }, // золотисто-жёлтый ← #DC970B
    { hex: "#934FFF", name: "data-color-14" }, // яркий фиолет (без изм.)
    { hex: "#5BCFFF", name: "data-color-15" }, // светло-голубой ← #2DCEBC (teal→sky)
  ],

  analytics: [
    { hex: "#1B2EC9", name: "analytics-blue" },        // Mario-синий ← #2949F6
    { hex: "#C5CEFA", name: "analytics-blue-light" },  // светлый Mario-синий ← #D4DBFD
    { hex: "#59229F", name: "analytics-purple" },       // (без изм.)
    { hex: "#D1C1E4", name: "analytics-purple-light" }, // (без изм.)
    { hex: "#1A9E3A", name: "analytics-green" },        // Mario-зелёный ← #4E8424
    { hex: "#C5EDD0", name: "analytics-green-light" },  // светлый Mario-зелёный ← #D9EEDA
    { hex: "#E60012", name: "analytics-red" },          // Nintendo-красный ← #CA4623
    { hex: "#FFCCCC", name: "analytics-red-light" },    // светлый красный ← #F2D5D4
    { hex: "#FFD600", name: "analytics-yellow" },       // LEGO-жёлтый ← #F09137
    { hex: "#FFF5B0", name: "analytics-yellow-light" }, // светлый жёлтый ← #F6E1C7
    { hex: "#3AAAEF", name: "analytics-teal" },         // небесно-голубой ← #2CB7B0 (teal→sky)
    { hex: "#C5E8FF", name: "analytics-teal-light" },   // светло-голубой ← #CFEFED
    { hex: "#283158", name: "analytics-navy" },          // (без изм.)
    { hex: "#D7DCE8", name: "analytics-navy-light" },    // (без изм.)
  ],
};

/** Легаси-выгрузка только hex (если где-то ещё используется) */
export const COLORS_HEX: Record<string, string[]> = {
  light: ["#FFFFFF"], // bg-transparent

  /* Buttons (tokens) */
  buttons: [
    "#FFD600", // btn-primary-main
    "#E6C200", // btn-primary-shadow
    "#C9A800", // btn-primary-border
    "#0E0E0E", // btn-primary-text
    "#FFE033", // btn-primary-hover
    "#EDECEA", // btn-secondary-main
    "#F39174", // btn-secondary-shadow
    "#E60012", // btn-secondary-border
    "#0E0E0E", // btn-secondary-text
    "#E8E9E4", // btn-secondary-hover
    "#EDECEA", // btn-danger-main
    "#FF9999", // btn-danger-second
    "#E60012", // btn-danger-border
    "#E60012", // btn-danger-text
    "#FFD0D0", // btn-danger-hover
  ],

  analytics: [
    "#1B2EC9", // analytics-blue
    "#C5CEFA", // analytics-blue-light
    "#59229F", // analytics-purple
    "#D1C1E4", // analytics-purple-light
    "#1A9E3A", // analytics-green
    "#C5EDD0", // analytics-green-light
    "#E60012", // analytics-red
    "#FFCCCC", // analytics-red-light
    "#FFD600", // analytics-yellow
    "#FFF5B0", // analytics-yellow-light
    "#3AAAEF", // analytics-teal
    "#C5E8FF", // analytics-teal-light
    "#283158", // analytics-navy
    "#D7DCE8", // analytics-navy-light
  ],
};
