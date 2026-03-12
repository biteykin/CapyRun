export function formatPaceMinKmFromSec(secPerKm: number | null | undefined) {
    if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return null;
    const total = Math.round(secPerKm);
    const mm = Math.floor(total / 60);
    const ss = total % 60;
    return `${mm}:${String(ss).padStart(2, "0")}/км`;
  }
  
  export function formatKm(distanceM: number | null | undefined) {
    if (distanceM == null || !Number.isFinite(distanceM)) return null;
    return Number(distanceM / 1000).toFixed(2);
  }
  
  export function toDateSafe(value: string | null | undefined) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  
  export function isRunningSport(sport: string | null | undefined) {
    const s = String(sport ?? "").toLowerCase();
    return ["run", "trail_run", "walk", "hike"].includes(s) || s === "running";
  }