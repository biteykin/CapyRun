"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { supabase } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";

/** Colors */
const HR_PINK = "#FB578D";
const PACE_YELLOW = "#F6B021";

/** Types */
type GpsStreams = { time_s: number[]; lat: number[]; lon: number[] };
type PreviewStreams = {
  time_s: number[];
  hr: Array<number | null>;
  pace_s_per_km: Array<number | null>;
};

type LeafletModules = {
  L: any;
  MapContainer: any;
  TileLayer: any;
  Polyline: any;
  Marker: any;
  CircleMarker: any;
  useMapEvents: any;
};

function isNum(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function fmtMmSsFromSeconds(sec?: number | null) {
  if (!isNum(sec) || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function downsampleTriplets(t: number[], lat: number[], lon: number[], maxPoints: number) {
  const n = Math.min(t.length, lat.length, lon.length);
  if (n <= maxPoints) return { t: t.slice(0, n), lat: lat.slice(0, n), lon: lon.slice(0, n) };

  const step = Math.ceil(n / maxPoints);
  const tt: number[] = [];
  const la: number[] = [];
  const lo: number[] = [];

  for (let i = 0; i < n; i += step) {
    const a = Number(lat[i]);
    const b = Number(lon[i]);
    const c = Number(t[i]);
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c)) {
      tt.push(c);
      la.push(a);
      lo.push(b);
    }
  }
  return { t: tt, lat: la, lon: lo };
}

function nearestPointIndex(points: Array<[number, number]>, lat: number, lon: number) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const [a, b] = points[i];
    const d = (a - lat) * (a - lat) + (b - lon) * (b - lon);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Приятная шкала: холодный → тёплый */
function colorRamp(t: number) {
  // hsl: 210 (синий) → 15 (оранжевый/красный)
  const h = lerp(210, 15, clamp01(t));
  return `hsl(${h} 95% 55%)`;
}

function MapWowStyles() {
  return (
    <style jsx global>{`
      .capyrun-map-wrap .leaflet-container {
        border-radius: 16px;
        overflow: hidden;
        background: hsl(var(--muted));
      }
      .capyrun-map-wrap .leaflet-control-attribution {
        opacity: 0.75;
      }
      .capyrun-pulse-dot {
        border: 0;
        background: transparent;
      }
      .capyrun-pulse-core {
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        background: ${PACE_YELLOW};
        box-shadow: 0 0 0 0 rgba(246, 176, 33, 0.45);
        animation: capyrun-pulse 1.25s ease-out infinite;
        border: 2px solid rgba(255, 255, 255, 0.9);
      }
      @keyframes capyrun-pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(246, 176, 33, 0.4);
          transform: scale(1);
        }
        70% {
          box-shadow: 0 0 0 14px rgba(246, 176, 33, 0);
          transform: scale(1.02);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(246, 176, 33, 0);
          transform: scale(1);
        }
      }
    `}</style>
  );
}

/** bounds without L.latLngBounds: Leaflet accepts [[minLat,minLon],[maxLat,maxLon]] */
function boundsArray(points: Array<[number, number]>) {
  if (!points.length) return null as null | [[number, number], [number, number]];
  let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
  for (const [a, b] of points) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    minLat = Math.min(minLat, a);
    minLon = Math.min(minLon, b);
    maxLat = Math.max(maxLat, a);
    maxLon = Math.max(maxLon, b);
  }
  if (!Number.isFinite(minLat)) return null;
  return [[minLat, minLon], [maxLat, maxLon]];
}

function padBounds(
  b: [[number, number], [number, number]],
  pad = 0.12
): [[number, number], [number, number]] {
  const [[minLat, minLon], [maxLat, maxLon]] = b;
  const dLat = (maxLat - minLat) * pad;
  const dLon = (maxLon - minLon) * pad;
  return [[minLat - dLat, minLon - dLon], [maxLat + dLat, maxLon + dLon]];
}

export default function WorkoutMap(props: {
  workoutId: string;
  externalTimeSec?: number | null; // синхра из графиков
}) {
  const { workoutId, externalTimeSec } = props;

  // ✅ dynamic-loaded leaflet/react-leaflet modules
  const [m, setM] = useState<LeafletModules | null>(null);
  const [icons, setIcons] = useState<{ DefaultIcon: any; PulseDotIcon: any } | null>(null);

  const [gps, setGps] = useState<GpsStreams | null>(null);
  const [preview, setPreview] = useState<PreviewStreams | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);

  const [activeIdx, setActiveIdx] = useState(0);
  const [followMarker, setFollowMarker] = useState(true);

  const [metricMode, setMetricMode] = useState<"pace" | "hr">("pace");

  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<1 | 5 | 10 | 20>(10);

  const mapRef = useRef<LeafletMap | null>(null);
  const playTimerRef = useRef<number | null>(null);

  // ✅ Load Leaflet + React-Leaflet ONLY on client runtime
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        // if some edge case calls this during SSR, guard it
        if (typeof window === "undefined") return;

        const [{ default: L }, rl] = await Promise.all([
          import("leaflet"),
          import("react-leaflet"),
        ]);

        if (canceled) return;

        setM({
          L,
          MapContainer: rl.MapContainer,
          TileLayer: rl.TileLayer,
          Polyline: rl.Polyline,
          Marker: rl.Marker,
          CircleMarker: rl.CircleMarker,
          useMapEvents: rl.useMapEvents,
        });

        // icons created AFTER L exists
        const DefaultIcon = L.icon({
          iconRetinaUrl: (marker2x as any)?.src ?? (marker2x as any),
          iconUrl: (marker as any)?.src ?? (marker as any),
          shadowUrl: (shadow as any)?.src ?? (shadow as any),
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });

        const PulseDotIcon = L.divIcon({
          className: "capyrun-pulse-dot",
          html: `<div class="capyrun-pulse-core"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        setIcons({ DefaultIcon, PulseDotIcon });
      } catch (e: any) {
        // if leaflet fails to load for some reason, show readable error
        setGpsErr((prev) => prev ?? `Leaflet init failed: ${String(e?.message ?? e)}`);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  // load GPS
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setGpsErr(null);
        setGps(null);

        const { data, error } = await supabase
          .from("workout_gps_streams")
          .select("s, points_count, updated_at, created_at")
          .eq("workout_id", workoutId)
          .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const s = (data as any)?.s ?? null;
        const time_s: number[] = Array.isArray(s?.time_s) ? s.time_s : [];
        const lat: number[] = Array.isArray(s?.lat) ? s.lat : [];
        const lon: number[] = Array.isArray(s?.lon) ? s.lon : [];

        const ds = downsampleTriplets(time_s, lat, lon, 2500);

        if (!canceled && ds.t.length) {
          setGps({ time_s: ds.t, lat: ds.lat, lon: ds.lon });
          setActiveIdx(0);
        }
      } catch (e: any) {
        if (!canceled) setGpsErr(String(e?.message ?? e));
      }
    })();
    return () => {
      canceled = true;
    };
  }, [workoutId]);

  // load preview
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setPreview(null);
        const { data, error } = await supabase
          .from("workout_streams_preview")
          .select("s")
          .eq("workout_id", workoutId)
          .maybeSingle();
        if (error) return;
        if (!data) return;

        const s = (data as any)?.s ?? null;
        const time_s: number[] = Array.isArray(s?.time_s) ? s.time_s : [];
        const hr: Array<number | null> = Array.isArray(s?.hr) ? s.hr : [];
        const pace: Array<number | null> = Array.isArray(s?.pace_s_per_km) ? s.pace_s_per_km : [];

        const n = Math.min(time_s.length, hr.length, pace.length);
        if (!n) return;

        if (!canceled) {
          setPreview({
            time_s: time_s.slice(0, n).map((x) => Number(x)),
            hr: hr.slice(0, n).map((x) => (isNum(x) ? x : null)),
            pace_s_per_km: pace.slice(0, n).map((x) => (isNum(x) ? x : null)),
          });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      canceled = true;
    };
  }, [workoutId]);

  const mapPoints = useMemo(() => {
    if (!gps) return [] as Array<[number, number]>;
    const n = Math.min(gps.lat.length, gps.lon.length);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const a = gps.lat[i];
      const b = gps.lon[i];
      if (Number.isFinite(a) && Number.isFinite(b)) pts.push([a, b]);
    }
    return pts;
  }, [gps]);

  const mapBounds = useMemo(() => boundsArray(mapPoints), [mapPoints]);

  const activePoint = useMemo(() => {
    if (!gps || !mapPoints.length) return null;
    const idx = Math.max(0, Math.min(activeIdx, mapPoints.length - 1));
    const [a, b] = mapPoints[idx];
    const t = gps.time_s[idx] ?? null;
    return { idx, lat: a, lon: b, time_s: isNum(t) ? t : null };
  }, [gps, mapPoints, activeIdx]);

  // pan to marker if follow
  useEffect(() => {
    if (!followMarker) return;
    if (!mapRef.current) return;
    if (!activePoint) return;
    mapRef.current.panTo([activePoint.lat, activePoint.lon] as any, {
      animate: true,
      duration: 0.35,
    } as any);
  }, [activePoint, followMarker]);

  // external sync from charts: time -> idx
  useEffect(() => {
    if (!gps || !gps.time_s.length) return;
    if (!isNum(externalTimeSec)) return;

    const t = externalTimeSec!;
    const ts = gps.time_s;

    let lo = 0, hi = ts.length - 1;
    while (hi - lo > 16) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] < t) lo = mid;
      else hi = mid;
    }
    let best = lo;
    let bestD = Infinity;
    for (let i = lo; i <= hi; i++) {
      const d = Math.abs(ts[i] - t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setActiveIdx(best);
  }, [externalTimeSec, gps]);

  // value at each gps point (pace/hr) — aligned by time
  const metricAtPoint = useMemo(() => {
    if (!gps || !preview) return null;

    const srcT = preview.time_s;
    const srcV = metricMode === "pace" ? preview.pace_s_per_km : preview.hr;

    const out: Array<number | null> = new Array(gps.time_s.length).fill(null);

    // fast pointer walk (both are sorted)
    let j = 0;
    for (let i = 0; i < gps.time_s.length; i++) {
      const t = gps.time_s[i] ?? 0;
      while (j + 1 < srcT.length && srcT[j + 1] <= t) j++;
      const j2 = Math.min(srcT.length - 1, j + 1);
      const d1 = Math.abs(srcT[j] - t);
      const d2 = Math.abs(srcT[j2] - t);
      const pick = d2 < d1 ? j2 : j;
      const v = srcV[pick];
      out[i] = isNum(v) ? v : null;
    }

    return out;
  }, [gps, preview, metricMode]);

  // build colored segments (gradient)
  const coloredSegments = useMemo(() => {
    if (!mapPoints.length) return [];

    if (!metricAtPoint || metricAtPoint.length < 2) {
      return [{ positions: mapPoints, color: PACE_YELLOW, weight: 5, opacity: 0.9 }];
    }

    let min = Infinity, max = -Infinity;
    for (const v of metricAtPoint) {
      if (!isNum(v)) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 1e-6) {
      return [{ positions: mapPoints, color: PACE_YELLOW, weight: 5, opacity: 0.9 }];
    }

    const norm = (v: number) => {
      const t = (v - min) / (max - min);
      return metricMode === "pace" ? 1 - t : t;
    };

    const segs: Array<{ positions: Array<[number, number]>; color: string; weight: number; opacity: number }> = [];
    const chunk = 20;

    for (let i = 1; i < mapPoints.length; i++) {
      const v = metricAtPoint[i];
      const vv = isNum(v) ? v : null;
      const t = vv == null ? null : norm(vv);
      const color = t == null ? "rgba(255,255,255,0.35)" : colorRamp(t);

      const prev = segs[segs.length - 1];
      if (!prev || prev.color !== color || prev.positions.length >= chunk + 1) {
        segs.push({ positions: [mapPoints[i - 1], mapPoints[i]], color, weight: 5, opacity: 0.92 });
      } else {
        prev.positions.push(mapPoints[i]);
      }
    }
    return segs;
  }, [mapPoints, metricAtPoint, metricMode]);

  // HUD stats at active time
  const overlayStats = useMemo(() => {
    if (!activePoint || !preview?.time_s?.length) {
      return { hr: null as number | null, pace: null as number | null };
    }
    const t = activePoint.time_s;
    if (!isNum(t)) return { hr: null, pace: null };

    const ts = preview.time_s;
    let lo = 0, hi = ts.length - 1;
    while (hi - lo > 16) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] < t) lo = mid;
      else hi = mid;
    }
    let best = lo;
    let bestD = Infinity;
    for (let i = lo; i <= hi; i++) {
      const d = Math.abs(ts[i] - t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const hr = preview.hr?.[best] ?? null;
    const pace = preview.pace_s_per_km?.[best] ?? null;
    return { hr: isNum(hr) ? hr : null, pace: isNum(pace) ? pace : null };
  }, [activePoint, preview]);

  // Play engine (по времени)
  useEffect(() => {
    if (!playing) {
      if (playTimerRef.current != null) window.clearInterval(playTimerRef.current);
      playTimerRef.current = null;
      return;
    }
    if (!gps || gps.time_s.length < 2) return;

    if (activeIdx >= gps.time_s.length - 1) setActiveIdx(0);

    const tickMs = 50;
    playTimerRef.current = window.setInterval(() => {
      setActiveIdx((i) => {
        if (!gps) return i;
        const n = gps.time_s.length;
        if (i >= n - 1) return n - 1;

        const t0 = gps.time_s[i];
        const target = t0 + (tickMs / 1000) * playSpeed;

        let j = i;
        while (j + 1 < n && gps.time_s[j + 1] < target) j++;
        return Math.min(j + 1, n - 1);
      });
    }, tickMs);

    return () => {
      if (playTimerRef.current != null) window.clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    };
  }, [playing, gps, playSpeed, activeIdx]);

  // ---------- UI guards ----------
  if (!mapPoints.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {gpsErr ? `GPS: ${gpsErr}` : "Нет GPS-данных для этой тренировки."}
      </div>
    );
  }

  // Leaflet modules not yet loaded
  if (!m || !icons) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="secondary" className="rounded-full">
            📍 {mapPoints.length.toLocaleString("ru-RU")} точек
          </Badge>
        </div>
        <div className="h-[440px] w-full rounded-2xl border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
          Загружаем Leaflet…
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Polyline, Marker, CircleMarker, useMapEvents } = m;

  function MapClickPicker({ onPick }: { onPick: (lat: number, lon: number) => void }) {
    useMapEvents({
      click: (e: any) => onPick(e.latlng.lat, e.latlng.lng),
    });
    return null;
  }

  return (
    <div className="space-y-3">
      <MapWowStyles />

      {/* Top controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            📍 {mapPoints.length.toLocaleString("ru-RU")} точек
          </Badge>

          <Badge variant="outline" className="rounded-full">
            🎨
            <button
              className="ml-2 underline underline-offset-2"
              onClick={() => setMetricMode((mm) => (mm === "pace" ? "hr" : "pace"))}
            >
              {metricMode === "pace" ? "градиент: темп" : "градиент: пульс"}
            </button>
          </Badge>

          <Badge variant="outline" className="rounded-full">
            🔥 follow:{" "}
            <button className="ml-1 underline underline-offset-2" onClick={() => setFollowMarker((v) => !v)}>
              {followMarker ? "on" : "off"}
            </button>
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mapBounds && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => mapRef.current?.fitBounds(padBounds(mapBounds, 0.12) as any)}
            >
              Уместить
            </Button>
          )}

          <Button size="sm" variant={playing ? "secondary" : "default"} onClick={() => setPlaying((v) => !v)}>
            {playing ? "⏸ Пауза" : "▶ Play"}
          </Button>

          <div className="flex items-center gap-1">
            {[1, 5, 10, 20].map((x) => (
              <button
                key={x}
                onClick={() => setPlaySpeed(x as any)}
                className={[
                  "rounded-full border px-2 py-1 text-xs",
                  playSpeed === x ? "bg-foreground text-background" : "bg-card text-foreground",
                ].join(" ")}
              >
                x{x}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* HUD */}
      <div className="rounded-xl border bg-card/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Время:{" "}
            <span className="font-semibold text-foreground">
              {activePoint?.time_s != null ? fmtMmSsFromSeconds(activePoint.time_s) : "—"}
            </span>
            <span className="mx-2 text-muted-foreground">•</span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: HR_PINK }} />
                <span className="text-muted-foreground">ЧСС</span>
                <span className="font-semibold text-foreground">
                  {overlayStats.hr != null ? `${Math.round(overlayStats.hr)} bpm` : "—"}
                </span>
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PACE_YELLOW }} />
                <span className="text-muted-foreground">Темп</span>
                <span className="font-semibold text-foreground">
                  {overlayStats.pace != null ? `${fmtMmSsFromSeconds(Math.round(overlayStats.pace))} /км` : "—"}
                </span>
              </span>
            </span>
          </div>

          <div className="text-xs text-muted-foreground">
            lat/lon:{" "}
            <span className="font-mono">{activePoint ? `${activePoint.lat.toFixed(5)}, ${activePoint.lon.toFixed(5)}` : "—"}</span>
          </div>
        </div>

        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={Math.max(0, mapPoints.length - 1)}
            value={Math.max(0, Math.min(activeIdx, mapPoints.length - 1))}
            onChange={(e) => setActiveIdx(Number(e.target.value))}
            className="w-full accent-[hsl(var(--foreground))]"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Старт</span>
            <span>Финиш</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="capyrun-map-wrap">
        <div className="h-[440px] w-full rounded-2xl border">
          <MapContainer
            center={mapPoints[0] as any}
            zoom={14}
            scrollWheelZoom
            whenCreated={(mm: any) => {
              mapRef.current = mm;
              if (mapBounds) mm.fitBounds(padBounds(mapBounds, 0.12) as any);
            }}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            <MapClickPicker
              onPick={(lat, lon) => {
                const idx = nearestPointIndex(mapPoints, lat, lon);
                setActiveIdx(idx);
              }}
            />

            {/* shadow under route */}
            <Polyline
              positions={mapPoints as any}
              pathOptions={{
                color: "#000000",
                opacity: 0.22,
                weight: 10,
                lineCap: "round",
                lineJoin: "round",
              }}
            />

            {/* gradient segments */}
            {coloredSegments.map((s: any, i: number) => (
              <Polyline
                key={i}
                positions={s.positions as any}
                pathOptions={{
                  color: s.color,
                  opacity: s.opacity,
                  weight: s.weight,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            ))}

            {/* start / finish */}
            <CircleMarker center={mapPoints[0] as any} radius={6} pathOptions={{ color: "white", weight: 2, fillColor: HR_PINK, fillOpacity: 1 }} />
            <CircleMarker
              center={mapPoints[mapPoints.length - 1] as any}
              radius={6}
              pathOptions={{ color: "white", weight: 2, fillColor: HR_PINK, fillOpacity: 1 }}
            />

            {/* active marker (pulse) */}
            {activePoint && <Marker position={[activePoint.lat, activePoint.lon] as any} icon={icons.PulseDotIcon} />}

            {/* safety: force default marker assets */}
            <Marker position={mapPoints[0] as any} icon={icons.DefaultIcon} opacity={0} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}