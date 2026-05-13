export type SexForHrZones = "male" | "female" | string | null | undefined;

export type HrZone = {
  name: string;
  min: number;
  max: number;
};

export type HrZonesPayload = Record<"Z1" | "Z2" | "Z3" | "Z4" | "Z5", HrZone>;

export const DEFAULT_HR_MAX = 190;

export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;

  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();

  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    age -= 1;
  }

  return age > 0 && age < 120 ? age : null;
}

export function estimateHrMax(age: number | null | undefined, sex?: SexForHrZones): number {
  if (age == null || !Number.isFinite(age) || age <= 0) {
    return DEFAULT_HR_MAX;
  }

  const normalizedSex = String(sex ?? "").toLowerCase();

  if (normalizedSex === "female") {
    return Math.round(206 - 0.88 * age);
  }

  return Math.round(208 - 0.7 * age);
}

export function buildDefaultHrZones(hrMax: number): HrZonesPayload {
  return {
    Z1: { name: "Восстановление", min: Math.round(hrMax * 0.5), max: Math.round(hrMax * 0.6) },
    Z2: { name: "Аэробная база", min: Math.round(hrMax * 0.6), max: Math.round(hrMax * 0.7) },
    Z3: { name: "Темповая", min: Math.round(hrMax * 0.7), max: Math.round(hrMax * 0.8) },
    Z4: { name: "Пороговая", min: Math.round(hrMax * 0.8), max: Math.round(hrMax * 0.9) },
    Z5: { name: "VO₂ / Спурт", min: Math.round(hrMax * 0.9), max: Math.round(hrMax * 1.0) },
  };
}

export function buildEstimatedHrProfile(params: {
  birthDate?: string | null;
  sex?: SexForHrZones;
  fallbackToDefault?: boolean;
}): { hrMax: number; hrZones: HrZonesPayload } | null {
  const age = ageFromBirthDate(params.birthDate);
  if (!age && !params.fallbackToDefault) return null;

  const hrMax = age ? estimateHrMax(age, params.sex) : DEFAULT_HR_MAX;

  return {
    hrMax,
    hrZones: buildDefaultHrZones(hrMax),
  };
}
