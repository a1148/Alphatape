import type { UniverseProfile } from "./universe";

export interface DividendCandidate {
  symbol: string;
  name: string;
  nameHe: string | null;
  exchange: UniverseProfile["exchange"];
  currency: UniverseProfile["currency"];
  country: UniverseProfile["country"];
  sector: string;
  industry: string;
  description: string;
  /** When true, the hot-list profile supplies the daily tape. The annual series still ends at endClose. */
  alsoHot: boolean;
  endClose: number;
  yieldPct: number;
  /** Decimal annual price growth used to build year-end closes. The screen recomputes CAGR from those closes. */
  priceCagr: number;
  divCagr: number;
  firstYear?: number;
  zeroDividendYears?: number[];
  /** Target payout. EPS is derived as latest DPS / payout so the ratio is computed, not stored as a claim. Null leaves payout N/A. */
  payout: number | null;
  beta: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  pe: number | null;
  mcapB: number;
}

function row(
  symbol: string,
  name: string,
  nameHe: string | null,
  exchange: DividendCandidate["exchange"],
  currency: DividendCandidate["currency"],
  country: DividendCandidate["country"],
  sector: string,
  industry: string,
  description: string,
  alsoHot: boolean,
  nums: [endClose: number, yieldPct: number, priceCagr: number, divCagr: number, payout: number | null, beta: number | null, debt: number | null, coverage: number | null, pe: number | null, mcapB: number],
  extra: { firstYear?: number; zeroDividendYears?: number[] } = {},
): DividendCandidate {
  return {
    symbol, name, nameHe, exchange, currency, country, sector, industry, description, alsoHot,
    endClose: nums[0], yieldPct: nums[1], priceCagr: nums[2], divCagr: nums[3], payout: nums[4],
    beta: nums[5], debtToEquity: nums[6], interestCoverage: nums[7], pe: nums[8], mcapB: nums[9],
    firstYear: extra.firstYear, zeroDividendYears: extra.zeroDividendYears,
  };
}

/**
 * Candidate universe for the long-term dividend screen.
 * Numeric growth, yield, payout, beta, and debt figures are synthetic demo inputs.
 * Pass/fail is computed from the annual series, not from this list's order.
 */
export const DIVIDEND_CANDIDATES: DividendCandidate[] = [
  row("JNJ", "Johnson & Johnson", "ג'ונסון אנד ג'ונסון", "NYSE", "USD", "US", "Healthcare", "Pharmaceuticals", "Develops pharmaceuticals and medical devices and has a long dividend record.", false, [160, 2.4, 0.08, 0.06, 0.5, 0.45, 0.4, 18, 16, 380]),
  row("PG", "Procter & Gamble", "פרוקטר אנד גמבל", "NYSE", "USD", "US", "Consumer", "Household products", "Sells household and personal-care products.", false, [165, 2.3, 0.075, 0.05, 0.6, 0.4, 0.6, 16, 25, 390]),
  row("KO", "Coca-Cola", "קוקה-קולה", "NYSE", "USD", "US", "Consumer", "Beverages", "Sells non-alcoholic beverages worldwide.", false, [70, 2.8, 0.07, 0.05, 0.7, 0.55, 1.4, 10, 26, 300]),
  row("PEP", "PepsiCo", null, "NASDAQ", "USD", "US", "Consumer", "Beverages", "Sells beverages and packaged foods.", false, [170, 2.7, 0.08, 0.07, 0.65, 0.5, 1.6, 9, 24, 230]),
  row("MCD", "McDonald's", null, "NYSE", "USD", "US", "Consumer", "Restaurants", "Operates and franchises restaurants.", false, [290, 2.2, 0.09, 0.07, 0.6, 0.6, 1.5, 8, 25, 210]),
  row("WMT", "Walmart", null, "NYSE", "USD", "US", "Consumer", "Retail", "Operates discount stores and warehouses.", false, [95, 1.3, 0.11, 0.04, 0.35, 0.5, 0.6, 12, 32, 760]),
  row("COST", "Costco", null, "NASDAQ", "USD", "US", "Consumer", "Retail", "Operates membership warehouses.", false, [900, 0.6, 0.14, 0.12, 0.3, 0.7, 0.35, 22, 52, 400]),
  row("HD", "Home Depot", null, "NYSE", "USD", "US", "Consumer", "Home improvement", "Sells home-improvement products.", false, [380, 2.3, 0.1, 0.1, 0.55, 0.95, 1.3, 11, 25, 380]),
  row("ABT", "Abbott Laboratories", null, "NYSE", "USD", "US", "Healthcare", "Medical devices", "Sells diagnostics, devices, and nutrition products.", false, [115, 1.9, 0.09, 0.08, 0.45, 0.65, 0.4, 15, 22, 200]),
  row("NEE", "NextEra Energy", null, "NYSE", "USD", "US", "Utilities", "Electric utilities", "Owns electric utilities and renewable generation.", false, [75, 2.9, 0.08, 0.1, 0.65, 0.5, 1.3, 4, 22, 150]),
  row("AAPL", "Apple", "אפל", "NASDAQ", "USD", "US", "Technology", "Consumer electronics", "Sells devices, software, and services and pays a dividend.", false, [230, 0.5, 0.16, 0.06, 0.15, 1.1, 1.2, 30, 32, 3500]),
  row("MSFT", "Microsoft", "מיקרוסופט", "NASDAQ", "USD", "US", "Technology", "Software", "Builds software, cloud infrastructure, and AI products and pays a dividend.", true, [420, 0.8, 0.15, 0.1, 0.25, 0.9, 0.3, 28, 34, 3100]),
  row("TXN", "Texas Instruments", null, "NASDAQ", "USD", "US", "Technology", "Semiconductors", "Designs analog semiconductors and returns cash through dividends.", false, [190, 2.6, 0.09, 0.08, 0.7, 1.0, 0.5, 20, 32, 170]),
  row("ADP", "Automatic Data Processing", null, "NASDAQ", "USD", "US", "Industrials", "Business services", "Provides payroll and human-capital services.", false, [280, 2.1, 0.1, 0.09, 0.6, 0.8, 0.5, 14, 28, 115]),
  row("CAT", "Caterpillar", null, "NYSE", "USD", "US", "Industrials", "Machinery", "Manufactures construction and mining equipment.", false, [360, 1.8, 0.1, 0.07, 0.4, 1.45, 1.8, 6, 16, 180]),
  row("LUMI.TA", "Bank Leumi", "בנק לאומי", "TASE", "ILS", "IL", "Financials", "Banks", "Israeli commercial bank. Dividend figures on this screen are per the Tel Aviv listing and are not FX-converted.", false, [4800, 3.4, 0.07, 0.05, 0.4, 1.05, 0.9, 7, 8, 62]),
  row("ICL.TA", "ICL Group", "כימיקלים לישראל", "TASE", "ILS", "IL", "Materials", "Specialty chemicals", "Produces fertilizers and specialty minerals and has paid dividends.", false, [2200, 4.2, 0.06, 0.03, 0.55, 1.15, 0.8, 6, 12, 24]),
  row("T", "AT&T", null, "NYSE", "USD", "US", "Communication", "Telecom", "Provides wireless and broadband service. Included as a candidate, not as a name that automatically passes.", false, [22, 6.4, 0.01, 0.0, 0.7, 0.7, 1.5, 4, 9, 160]),
  row("VZ", "Verizon", null, "NYSE", "USD", "US", "Communication", "Telecom", "Provides wireless and broadband service.", false, [42, 6.6, 0.02, 0.02, 0.6, 0.4, 1.6, 5, 10, 180]),
  row("INTC", "Intel", null, "NASDAQ", "USD", "US", "Technology", "Semiconductors", "Designs and manufactures CPUs. Included so a weak price path can fail the screen.", false, [24, 1.6, -0.05, -0.02, 0.4, 1.1, 0.5, 8, 0, 105]),
  row("POLI.TA", "Bank Hapoalim", "בנק הפועלים", "TASE", "ILS", "IL", "Financials", "Banks", "Israeli commercial bank. The demo history for this name is shorter than ten years on purpose.", false, [4100, 3.2, 0.08, 0.05, 0.35, 1.1, 0.9, 7, 7, 55], { firstYear: 2020 }),
  row("XOM", "Exxon Mobil", null, "NYSE", "USD", "US", "Energy", "Oil and gas", "Produces oil and gas. The demo series includes a year with no dividend so the streak resets.", false, [110, 3.3, 0.09, 0.04, 0.5, 0.95, 0.2, 18, 14, 470], { zeroDividendYears: [2020] }),
];

export function dividendProfile(candidate: DividendCandidate): UniverseProfile {
  return {
    symbol: candidate.symbol,
    name: candidate.name,
    nameHe: candidate.nameHe,
    exchange: candidate.exchange,
    currency: candidate.currency,
    country: candidate.country,
    sector: candidate.sector,
    industry: candidate.industry,
    themes: [],
    description: candidate.description,
    anchor: candidate.endClose,
    mcapB: candidate.mcapB,
    pe: candidate.pe,
    rev: null,
    eps: null,
    short: null,
    inst: null,
    insNet: null,
    insShares: null,
    insB: null,
    insS: null,
    sb: null,
    b: null,
    h: null,
    s: null,
    ss: null,
    target: null,
    revision: null,
    vol: 0.012,
    drift: 0.00015,
    nearHigh: false,
    volSpike: false,
    contract: false,
  };
}
