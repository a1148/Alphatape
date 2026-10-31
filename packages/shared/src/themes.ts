import { THEME_IDS, type ThemeId, type ThemeTag } from "./types";

const KEYWORDS: Array<{ id: ThemeId; pattern: RegExp; rule: string }> = [
  { id: "ai", pattern: /artificial intelligence|\bmachine learning\b|\bgenerative\b|\bgpu\b|\bai platform\b/i, rule: "keyword:ai" },
  { id: "semiconductors", pattern: /semiconductor|foundry|lithography|wafer|\bchip\b/i, rule: "keyword:semiconductors" },
  { id: "cybersecurity", pattern: /cyber|firewall|endpoint security|\bsecurity platform\b/i, rule: "keyword:cybersecurity" },
  { id: "cloud", pattern: /\bcloud\b|\bsaas\b|data platform/i, rule: "keyword:cloud" },
  { id: "quantum", pattern: /quantum/i, rule: "keyword:quantum" },
  { id: "biotech", pattern: /biotech|biopharm|genomic|therapeut|pharmaceutical/i, rule: "keyword:biotech" },
  { id: "infrastructure", pattern: /infrastructure|electric utility|\bpower\b|\bgrid\b|construction equipment/i, rule: "keyword:infrastructure" },
];

export interface ThemeInput {
  name: string;
  industry: string;
  sector: string;
  description: string | null;
  profileThemes: string[];
  marketCap: number | null;
  changePercent: number | null;
  rsi14: number | null;
  macdHist: number | null;
  price: number | null;
  sma50: number | null;
  llmThemes?: string[];
  llmModel?: string | null;
}

export function classifyThemes(input: ThemeInput): ThemeTag[] {
  const tags: ThemeTag[] = [];
  const seen = new Set<string>();
  const add = (tag: ThemeTag) => {
    if (seen.has(tag.id)) return;
    seen.add(tag.id);
    tags.push(tag);
  };

  for (const id of input.profileThemes) {
    if ((THEME_IDS as readonly string[]).includes(id)) {
      add({ id, origin: "profile", rule: "universe-profile", modelEstimate: false });
    }
  }

  const blob = [input.name, input.industry, input.sector, input.description ?? ""].join(" ");
  for (const rule of KEYWORDS) {
    if (rule.pattern.test(blob)) {
      add({ id: rule.id, origin: "rule", rule: rule.rule, modelEstimate: false });
    }
  }

  if (input.marketCap != null && input.marketCap < 2_000_000_000) {
    add({ id: "small_cap", origin: "rule", rule: "marketCap < 2e9", modelEstimate: false });
  }

  const momentum =
    input.price != null &&
    input.sma50 != null &&
    input.price > input.sma50 &&
    input.macdHist != null &&
    input.macdHist > 0 &&
    input.rsi14 != null &&
    input.rsi14 >= 55 &&
    input.rsi14 <= 80 &&
    (input.changePercent ?? 0) > 0;
  if (momentum) {
    add({
      id: "momentum",
      origin: "rule",
      rule: "price>SMA50, MACD hist>0, RSI 55-80, positive day",
      modelEstimate: false,
    });
  }

  for (const id of input.llmThemes ?? []) {
    if (!(THEME_IDS as readonly string[]).includes(id)) continue;
    if (seen.has(id)) continue;
    add({
      id,
      origin: "llm",
      rule: `llm:${input.llmModel ?? "unknown"}`,
      modelEstimate: true,
    });
  }

  return tags;
}
