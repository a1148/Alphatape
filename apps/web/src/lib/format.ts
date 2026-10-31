export function na(value: string | null | undefined) {
  return value == null || value === "" ? "N/A" : value;
}

export function formatNumber(value: number | null | undefined, locale: "he" | "en", digits = 2) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPrice(value: number | null | undefined, currency: string, locale: "he" | "en") {
  if (value == null || !Number.isFinite(value)) return "N/A";
  const digits = Math.abs(value) >= 100 ? 2 : Math.abs(value) >= 1 ? 2 : 4;
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-US", {
    style: "currency",
    currency: currency === "ILS" ? "ILS" : "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.min(2, digits),
  }).format(value);
}

export function formatCompact(value: number | null | undefined, currency: string, locale: "he" | "en") {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-US", {
    style: "currency",
    currency: currency === "ILS" ? "ILS" : "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number | null | undefined, locale: "he" | "en", digits = 2) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  const body = formatNumber(Math.abs(value), locale, digits);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${body}%`;
}

export function formatWhen(iso: string | null | undefined, locale: "he" | "en") {
  if (!iso) return "N/A";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

export function toneClass(value: number | null | undefined) {
  if (value == null) return "text-muted";
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-muted";
}

export function scoreColor(score: number | null) {
  if (score == null) return "#8ea0b3";
  if (score >= 80) return "#1fd68a";
  if (score >= 65) return "#8fd16a";
  if (score >= 50) return "#ffb020";
  if (score >= 35) return "#ff8a5b";
  return "#ff5d73";
}

export function consensusTone(value: string | null) {
  if (value === "strong_buy") return "bg-up/15 text-up";
  if (value === "buy") return "bg-emerald-400/10 text-emerald-300";
  if (value === "hold") return "bg-accent/15 text-accent";
  if (value === "sell") return "bg-orange-400/15 text-orange-300";
  if (value === "strong_sell") return "bg-down/15 text-down";
  return "bg-white/5 text-muted";
}
