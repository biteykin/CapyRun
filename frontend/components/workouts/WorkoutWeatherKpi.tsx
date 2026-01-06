"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  Wind,
  CloudFog,
  ThermometerSun,
  ThermometerSnowflake,
  ArrowUpRight,
  ArrowUp,
  ArrowRight,
} from "lucide-react";

type Weather = {
  // existing
  temp_c?: number;
  wind_kph?: number;
  humidity?: number;
  pressure_hpa?: number;
  conditions?: string;

  // optional extensions (if your ingestion provides them later)
  feelslike_c?: number;
  gust_kph?: number;
  wind_degree?: number; // 0..360, meteorological: direction FROM which wind blows
  wind_dir?: string; // "NW", etc.
  precip_mm?: number;
  cloud?: number; // %
  uv?: number;

  [k: string]: unknown;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

type Kind =
  | "sunny"
  | "partly"
  | "cloudy"
  | "rain"
  | "snow"
  | "fog"
  | "wind"
  | "hot"
  | "cold";

type WindFeel = "headwind" | "tailwind" | "crosswind" | null;

export type WorkoutWeatherKpiProps = {
  weather: Weather;
  /** Make it extra small for KPI strip */
  variant?: "default" | "compact";
  /**
   * Course/bearing of workout movement in degrees (0..360), where 0 = North, 90 = East.
   * If you don't have it yet, omit.
   */
  course_deg?: number | null;
  /**
   * Wind direction in degrees (0..360), meteorological "from".
   * If your weather has wind_degree, you can omit and it will be picked.
   */
  wind_from_deg?: number | null;
};

function clampDeg(d: number) {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function deltaAngle(a: number, b: number) {
  // minimal absolute delta between headings in degrees (0..180)
  const d = Math.abs(clampDeg(a) - clampDeg(b));
  return d > 180 ? 360 - d : d;
}

function windFeel(courseDeg: number, windFromDeg: number): WindFeel {
  // Wind "from" direction means wind vector is coming FROM that heading and going TO opposite.
  // For runner impact, compare course with wind FROM (headwind if you run into where wind comes from).
  const d = deltaAngle(courseDeg, windFromDeg);

  // thresholds feel-good: <=45 head/tail, 45..135 cross, >=135 tail
  if (d <= 45) return "headwind";
  if (d >= 135) return "tailwind";
  return "crosswind";
}

function windFeelLabel(kind: WindFeel) {
  if (kind === "headwind") return "встречный ветер";
  if (kind === "tailwind") return "попутный ветер";
  if (kind === "crosswind") return "боковой ветер";
  return null;
}

function windFeelIcon(kind: WindFeel) {
  // simple icons: headwind = ArrowUp (into wind), tailwind = ArrowUpRight-ish, crosswind = ArrowRight
  if (kind === "headwind") return ArrowUp;
  if (kind === "tailwind") return ArrowUpRight;
  if (kind === "crosswind") return ArrowRight;
  return null;
}

function pickKind(w: Weather): Kind {
  const c = (w.conditions || "").toString().toLowerCase();
  const t = isNum(w.temp_c) ? w.temp_c : null;
  const wind = isNum(w.wind_kph) ? w.wind_kph : null;

  // 1) by string conditions
  if (c.includes("snow") || c.includes("снег") || c.includes("snowfall")) return "snow";
  if (c.includes("rain") || c.includes("дожд") || c.includes("shower") || c.includes("storm")) return "rain";
  if (c.includes("fog") || c.includes("mist") || c.includes("туман") || c.includes("haze")) return "fog";
  if (c.includes("wind") || c.includes("ветер")) return "wind";
  if (c.includes("cloud") || c.includes("облач")) return "cloudy";
  if (c.includes("sun") || c.includes("clear") || c.includes("ясно") || c.includes("солне")) return "sunny";

  // 2) heuristics by numbers
  if (t !== null && t <= -2) return "cold";
  if (t !== null && t >= 27) return "hot";
  if (wind !== null && wind >= 28) return "wind";
  if (t !== null && t <= 0) return "snow";

  return "partly";
}

function kindUI(kind: Kind) {
  switch (kind) {
    case "sunny":
      return {
        Icon: Sun,
        wrap: "border-yellow-200/60 bg-gradient-to-br from-yellow-50 to-orange-50 text-yellow-900",
        icon: "text-yellow-700",
        chip: "bg-yellow-100/70",
      };
    case "hot":
      return {
        Icon: ThermometerSun,
        wrap: "border-orange-200/60 bg-gradient-to-br from-orange-50 to-rose-50 text-rose-900",
        icon: "text-rose-700",
        chip: "bg-rose-100/70",
      };
    case "cold":
      return {
        Icon: ThermometerSnowflake,
        wrap: "border-cyan-200/60 bg-gradient-to-br from-cyan-50 to-slate-50 text-cyan-900",
        icon: "text-cyan-700",
        chip: "bg-cyan-100/70",
      };
    case "partly":
      return {
        Icon: CloudSun,
        wrap: "border-amber-200/60 bg-gradient-to-br from-amber-50 to-slate-50 text-amber-950",
        icon: "text-amber-700",
        chip: "bg-amber-100/70",
      };
    case "cloudy":
      return {
        Icon: Cloud,
        wrap: "border-slate-200/70 bg-gradient-to-br from-slate-50 to-slate-100/40 text-slate-900",
        icon: "text-slate-600",
        chip: "bg-slate-100/70",
      };
    case "rain":
      return {
        Icon: CloudRain,
        wrap: "border-blue-200/60 bg-gradient-to-br from-sky-50 to-blue-50 text-blue-950",
        icon: "text-blue-700",
        chip: "bg-blue-100/70",
      };
    case "snow":
      return {
        Icon: CloudSnow,
        wrap: "border-sky-200/60 bg-gradient-to-br from-sky-50 to-slate-50 text-sky-950",
        icon: "text-sky-700",
        chip: "bg-sky-100/70",
      };
    case "fog":
      return {
        Icon: CloudFog,
        wrap: "border-zinc-200/60 bg-gradient-to-br from-zinc-50 to-slate-50 text-zinc-950",
        icon: "text-zinc-700",
        chip: "bg-zinc-100/70",
      };
    case "wind":
      return {
        Icon: Wind,
        wrap: "border-emerald-200/60 bg-gradient-to-br from-slate-50 to-emerald-50 text-emerald-950",
        icon: "text-emerald-700",
        chip: "bg-emerald-100/70",
      };
  }
}

function fmtTemp(t?: number) {
  return isNum(t) ? `${Math.round(t)}°C` : "—";
}
function fmtWind(w?: number) {
  return isNum(w) ? `${Math.round(w)} км/ч` : null;
}
function fmtHum(h?: number) {
  return isNum(h) ? `${Math.round(h)}%` : null;
}
function fmtPress(p?: number) {
  return isNum(p) ? `${Math.round(p)} гПа` : null;
}
function fmtMm(v?: number) {
  return isNum(v) ? `${v.toFixed(v >= 10 ? 0 : 1).replace(".", ",")} мм` : null;
}
function fmtUv(v?: number) {
  return isNum(v) ? String(Math.round(v)) : null;
}
function fmtPct(v?: number) {
  return isNum(v) ? `${Math.round(v)}%` : null;
}

function conditionsLabel(kind: Kind, w: Weather) {
  const t = isNum(w.temp_c) ? w.temp_c : null;
  const wind = isNum(w.wind_kph) ? w.wind_kph : null;
  const hum = isNum(w.humidity) ? w.humidity : null;

  if (kind === "hot") return "жарко — держи воду";
  if (kind === "cold") return "холодно — береги дыхание";
  if (kind === "rain") return "мокро — осторожнее на поворотах";
  if (kind === "snow") return "скользко — шаг короче";
  if (kind === "wind") return "ветер — темп будет гулять";
  if (kind === "fog") return "туман — внимательнее к трафику";

  const mild =
    t !== null && t >= 8 && t <= 18 &&
    (wind === null || wind <= 16) &&
    (hum === null || hum <= 80);

  if (mild) return "идеально для темпа";
  return isStr(w.conditions) ? w.conditions!.toString() : "условия";
}

export default function WorkoutWeatherKpi(props: WorkoutWeatherKpiProps) {
  const { weather, variant = "default" } = props;

  const hasAny =
    isNum(weather.temp_c) ||
    isNum(weather.wind_kph) ||
    isNum(weather.humidity) ||
    isStr(weather.conditions) ||
    isNum(weather.feelslike_c);

  if (!hasAny) return null;

  const kind = pickKind(weather);
  const ui = kindUI(kind);
  const Icon = ui.Icon;

  const temp = fmtTemp(weather.temp_c);
  const feels = isNum(weather.feelslike_c) ? fmtTemp(weather.feelslike_c) : null;

  const wind = fmtWind(weather.wind_kph);
  const hum = fmtHum(weather.humidity);
  const press = fmtPress(weather.pressure_hpa);

  // wind direction + course => head/tail/cross
  const course = isNum(props.course_deg) ? clampDeg(props.course_deg) : null;
  const windFrom =
    isNum(props.wind_from_deg)
      ? clampDeg(props.wind_from_deg)
      : isNum(weather.wind_degree)
        ? clampDeg(weather.wind_degree)
        : null;

  const wf = course !== null && windFrom !== null ? windFeel(course, windFrom) : null;
  const wfLabel = windFeelLabel(wf);
  const WfIcon = windFeelIcon(wf);

  const subtitleParts = [
    wind ? `ветер ${wind}` : null,
    wfLabel ? wfLabel : null,
    hum ? `влажн. ${hum}` : null,
  ].filter(Boolean);

  const subtitle = subtitleParts.join(" · ");
  const label = conditionsLabel(kind, weather);

  const details: Array<{ k: string; v: string }> = [];
  if (isNum(weather.temp_c)) details.push({ k: "Температура", v: `${weather.temp_c} °C` });
  if (isNum(weather.feelslike_c)) details.push({ k: "Ощущается", v: `${weather.feelslike_c} °C` });
  if (isNum(weather.wind_kph)) details.push({ k: "Ветер", v: `${weather.wind_kph} км/ч` });
  if (isNum(weather.gust_kph)) details.push({ k: "Порывы", v: `${weather.gust_kph} км/ч` });
  if (wfLabel) details.push({ k: "Относительно движения", v: wfLabel });
  if (isNum(weather.humidity)) details.push({ k: "Влажность", v: `${weather.humidity}%` });
  if (press) details.push({ k: "Давление", v: press });
  const precip = fmtMm(weather.precip_mm);
  if (precip) details.push({ k: "Осадки", v: precip });
  const cloud = fmtPct(weather.cloud);
  if (cloud) details.push({ k: "Облачность", v: cloud });
  const uv = fmtUv(weather.uv);
  if (uv) details.push({ k: "UV", v: uv });
  if (isStr(weather.conditions)) details.push({ k: "Условия", v: weather.conditions! });

  const compact = variant === "compact";

  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>
        <Card
          className={cn(
            "group relative overflow-hidden border transition-all",
            "hover:-translate-y-[1px] hover:shadow-md",
            ui.wrap
          )}
        >
          {/* soft shine on hover */}
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="absolute -left-1/3 top-0 h-full w-1/2 rotate-12 bg-white/35 blur-xl" />
          </div>

          <CardContent className={cn(compact ? "p-2.5" : "p-3")}>
            <div className={cn("text-xs text-muted-foreground", compact && "text-[11px]")}>
              Погода
            </div>

            <div className={cn("mt-1 flex items-center gap-2", compact && "gap-2")}>
              <div className={cn("grid place-items-center rounded-full", ui.chip, compact ? "h-7 w-7" : "h-7 w-7")}>
                <Icon className={cn("h-4 w-4", ui.icon)} />
              </div>

              <div className="min-w-0">
                <div className={cn("flex items-baseline gap-2", compact && "gap-1.5")}>
                  <div className={cn("font-semibold leading-none", compact ? "text-sm" : "text-base")}>
                    {temp}
                  </div>

                  {feels && feels !== temp ? (
                    <div className={cn("text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
                      ощущ. {feels}
                    </div>
                  ) : null}
                </div>

                <div className={cn("mt-1 line-clamp-1 text-muted-foreground", compact ? "text-[11px]" : "text-[11px]")}>
                  {subtitle || label}
                </div>

                {/* tiny wind feel icon row (only if we can compute it) */}
                {WfIcon && wind ? (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <WfIcon className="h-3.5 w-3.5" />
                    <span>{wfLabel}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </HoverCardTrigger>

      <HoverCardContent className="w-72">
        <div className="text-sm font-medium">Погода во время тренировки</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>

        <div className="mt-3 space-y-1 text-sm">
          {details.length > 0 ? (
            details.map((d) => (
              <div key={d.k} className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">{d.k}</span>
                <span className="font-medium">{d.v}</span>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground">Нет подробных данных</div>
          )}
        </div>

        {(course !== null || windFrom !== null) && (
          <div className="mt-3 text-xs text-muted-foreground">
            {course !== null ? `Курс: ${Math.round(course)}°` : null}
            {course !== null && windFrom !== null ? " · " : null}
            {windFrom !== null ? `Ветер (откуда): ${Math.round(windFrom)}°` : null}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}