export const DEFAULT_AVATAR = "/avatars/default-1.svg";

function buildSeries(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return `/avatars/${prefix}/${prefix}-${n}.svg`;
  });
}

export const MALE_AVATARS = buildSeries("male", 7);
export const FEMALE_AVATARS = buildSeries("female", 8);

export const ALL_PRESET_AVATARS = [
  DEFAULT_AVATAR,
  ...MALE_AVATARS,
  ...FEMALE_AVATARS,
];
