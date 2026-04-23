export const COUNTRY_CODES = [
  "RU","AM","AZ","BY","GE","KZ","KG","MD","TJ","TM","UA","UZ",
  "AT","BE","BG","CH","CY","CZ","DE","DK","EE","ES","FI","FR","GB","GR","HR","HU","IE","IS","IT","LT","LU","LV","MT","NL","NO","PL","PT","RO","SE","SI","SK","AL","BA","ME","MK","RS",
  "TR","IL","AE","SA","QA","KW","BH","OM","JO","LB","EG","MA","TN","DZ","ZA",
  "US","CA","MX","BR","AR","CL","CO","PE","UY","VE","EC","BO","PY","CR","PA","DO","GT","HN","NI","SV","CU","JM",
  "CN","JP","KR","IN","TH","VN","MY","SG","ID","PH","HK","TW","MO","MN","LK","PK","BD","NP","KH","LA",
  "AU","NZ",
];

const displayNames =
  typeof Intl !== "undefined"
    ? new Intl.DisplayNames(["ru"], { type: "region" })
    : null;

export type CountryOption = {
  code: string;
  name: string;
};

export function getCountryOptions(): CountryOption[] {
  return COUNTRY_CODES.map((code) => ({
    code,
    name: displayNames?.of(code) ?? code,
  })).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function findCountryCodeByLabel(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (COUNTRY_CODES.includes(upper)) return upper;

  const found = getCountryOptions().find(
    (item) => item.name.toLowerCase() === raw.toLowerCase()
  );

  return found?.code ?? null;
}

export function getCountryLabel(code: string | null | undefined): string {
  if (!code) return "";
  return displayNames?.of(code.toUpperCase()) ?? code.toUpperCase();
}
