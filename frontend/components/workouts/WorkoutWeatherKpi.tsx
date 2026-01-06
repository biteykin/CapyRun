"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
  temp_c?: number;
  wind_kph?: number;
  humidity?: number;
  pressure_hpa?: number;
  conditions?: string;

  feelslike_c?: number;
  gust_kph?: number;
  wind_degree?: number;
  wind_dir?: string;

  precip_mm?: number;
  cloud?: number;
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
  variant?: "default" | "compact";
  course_deg?: number | null;
  wind_from_deg?: number | null;
  /** Enable background animation */
  animated?: boolean;
};

function clampDeg(d: number) {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}
function deltaAngle(a: number, b: number) {
  const d = Math.abs(clampDeg(a) - clampDeg(b));
  return d > 180 ? 360 - d : d;
}
function windFeel(courseDeg: number, windFromDeg: number): WindFeel {
  const d = deltaAngle(courseDeg, windFromDeg);
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
  if (kind === "headwind") return ArrowUp;
  if (kind === "tailwind") return ArrowUpRight;
  if (kind === "crosswind") return ArrowRight;
  return null;
}

function pickKind(w: Weather): Kind {
  const c = (w.conditions || "").toString().toLowerCase();
  const t = isNum(w.temp_c) ? w.temp_c : null;
  const wind = isNum(w.wind_kph) ? w.wind_kph : null;

  if (c.includes("snow") || c.includes("снег") || c.includes("snowfall")) return "snow";
  if (c.includes("rain") || c.includes("дожд") || c.includes("shower") || c.includes("storm")) return "rain";
  if (c.includes("fog") || c.includes("mist") || c.includes("туман") || c.includes("haze")) return "fog";
  if (c.includes("wind") || c.includes("ветер")) return "wind";
  if (c.includes("cloud") || c.includes("облач")) return "cloudy";
  if (c.includes("sun") || c.includes("clear") || c.includes("ясно") || c.includes("солне")) return "sunny";

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

/** Lightweight animated background overlay */
function WeatherBackdrop({ kind, intensity = 1 }: { kind: Kind; intensity?: 1 | 2 }) {
  // intensity: 1 subtle, 2 stronger (e.g. heavy rain)
  return (
    <>
      {/* Base soft texture */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-soft-light">
        <div className="h-full w-full bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.55),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.35),transparent_55%)]" />
      </div>

      {/* Kind-specific */}
      {kind === "rain" ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-30",
            intensity === 2 && "opacity-40"
          )}
        >
          <div className="absolute inset-0 cr-rain" />
        </div>
      ) : null}

      {kind === "snow" || kind === "cold" ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0",
            intensity === 2 ? "opacity-45" : "opacity-35"
          )}
        >
          <div className="absolute inset-0 cr-snow" />
        </div>
      ) : null}

      {kind === "fog" ? (
        <div className="pointer-events-none absolute inset-0 opacity-35">
          <div className="absolute inset-0 cr-fog" />
        </div>
      ) : null}

      {kind === "wind" ? (
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute inset-0 cr-wind" />
        </div>
      ) : null}

      {kind === "sunny" || kind === "hot" ? (
        <div className="pointer-events-none absolute inset-0 opacity-35">
          <div className="absolute inset-0 cr-sun" />
        </div>
      ) : null}

      {kind === "partly" || kind === "cloudy" ? (
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <div className="absolute inset-0 cr-clouds" />
        </div>
      ) : null}
    </>
  );
}

export default function WorkoutWeatherKpi(props: WorkoutWeatherKpiProps) {
  const { weather, variant = "default", animated = true } = props;

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
  if (isStr(weather.conditions)) details.push({ k: "Условия", v: weather.conditions! });

  const compact = variant === "compact";

  // stronger rain/snow if we have precip_mm or low temp + precip, etc.
  const intensity: 1 | 2 =
    (kind === "rain" && isNum(weather.precip_mm) && weather.precip_mm >= 3) ||
    (kind === "snow" && isNum(weather.wind_kph) && weather.wind_kph >= 20)
      ? 2
      : 1;

  return (
    <>
      <HoverCard openDelay={120}>
        <HoverCardTrigger asChild>
          <Card
            className={cn(
              "group relative overflow-hidden border transition-all",
              "hover:-translate-y-[1px] hover:shadow-md",
              ui.wrap
            )}
          >
            {/* animated background */}
            {animated ? <WeatherBackdrop kind={kind} intensity={intensity} /> : null}

            {/* soft shine on hover */}
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="absolute -left-1/3 top-0 h-full w-1/2 rotate-12 bg-white/35 blur-xl" />
            </div>

            <CardContent className={cn(compact ? "p-2.5" : "p-3")}>
              <div className={cn("text-xs text-muted-foreground", compact && "text-[11px]")}>
                Погода
              </div>

              <div className={cn("mt-1 flex items-center gap-2", compact && "gap-2")}>
                <div className={cn("grid h-7 w-7 place-items-center rounded-full", ui.chip)}>
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
    </>
  );
}