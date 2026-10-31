import type { ThemeId } from "./types";

export interface UniverseProfile {
  symbol: string;
  name: string;
  nameHe: string | null;
  exchange: "NASDAQ" | "NYSE" | "TASE";
  currency: "USD" | "ILS";
  country: "US" | "IL";
  sector: string;
  industry: string;
  themes: ThemeId[];
  description: string;
  /** Synthetic demo anchor. Not a live or historical market price. */
  anchor: number;
  /** Synthetic demo market cap, billions of listing currency. */
  mcapB: number;
  pe: number | null;
  rev: number | null;
  eps: number | null;
  short: number | null;
  inst: number | null;
  insNet: number | null;
  insShares: number | null;
  insB: number | null;
  insS: number | null;
  sb: number | null;
  b: number | null;
  h: number | null;
  s: number | null;
  ss: number | null;
  target: number | null;
  revision: number | null;
  vol: number;
  drift: number;
  nearHigh: boolean;
  volSpike: boolean;
  contract: boolean;
}

const U = (
  symbol: string,
  name: string,
  nameHe: string | null,
  exchange: UniverseProfile["exchange"],
  currency: UniverseProfile["currency"],
  country: UniverseProfile["country"],
  sector: string,
  industry: string,
  themes: ThemeId[],
  description: string,
  nums: [
    anchor: number,
    mcapB: number,
    pe: number | null,
    rev: number | null,
    eps: number | null,
    short: number | null,
    inst: number | null,
    insNet: number | null,
    insShares: number | null,
    insB: number | null,
    insS: number | null,
    sb: number | null,
    b: number | null,
    h: number | null,
    s: number | null,
    ss: number | null,
    target: number | null,
    revision: number | null,
    vol: number,
    drift: number,
  ],
  flags: { nearHigh?: boolean; volSpike?: boolean; contract?: boolean } = {},
): UniverseProfile => ({
  symbol,
  name,
  nameHe,
  exchange,
  currency,
  country,
  sector,
  industry,
  themes,
  description,
  anchor: nums[0],
  mcapB: nums[1],
  pe: nums[2],
  rev: nums[3],
  eps: nums[4],
  short: nums[5],
  inst: nums[6],
  insNet: nums[7],
  insShares: nums[8],
  insB: nums[9],
  insS: nums[10],
  sb: nums[11],
  b: nums[12],
  h: nums[13],
  s: nums[14],
  ss: nums[15],
  target: nums[16],
  revision: nums[17],
  vol: nums[18],
  drift: nums[19],
  nearHigh: flags.nearHigh ?? false,
  volSpike: flags.volSpike ?? false,
  contract: flags.contract ?? false,
});

const NH = { nearHigh: true, volSpike: true, contract: true };

/**
 * Reference identities (legal name, listing, sector) are public facts.
 * Every numeric field is a synthetic demo anchor, not a market quote.
 */
export const UNIVERSE: UniverseProfile[] = [
  U("NVDA", "NVIDIA", "אנבידיה", "NASDAQ", "USD", "US", "Technology", "Semiconductors", ["ai", "semiconductors"], "Designs GPUs and accelerated-computing platforms.", [120, 2900, 48, 78, 92, 1.1, 68, 4200000, 18000, 6, 2, 32, 10, 3, 1, 0, 156, 0.7, 0.028, 0.0012], NH),
  U("AMD", "Advanced Micro Devices", null, "NASDAQ", "USD", "US", "Technology", "Semiconductors", ["ai", "semiconductors"], "Designs CPUs, GPUs, and adaptive computing chips.", [140, 230, 42, 28, 34, 2.4, 72, 900000, 4000, 3, 2, 18, 14, 8, 2, 0, 175, 0.3, 0.03, 0.0006]),
  U("AVGO", "Broadcom", null, "NASDAQ", "USD", "US", "Technology", "Semiconductors", ["ai", "semiconductors"], "Designs networking silicon and infrastructure software.", [180, 820, 36, 32, 28, 1.4, 76, 1500000, 3000, 2, 3, 22, 8, 4, 0, 0, 220, 0.4, 0.022, 0.0005], NH),
  U("TSM", "Taiwan Semiconductor", null, "NYSE", "USD", "US", "Technology", "Semiconductors", ["semiconductors", "ai"], "Operates semiconductor foundries.", [165, 900, 24, 26, 22, 0.8, 74, 0, 0, 1, 1, 14, 10, 3, 0, 0, 198, 0.35, 0.02, 0.0004]),
  U("ASML", "ASML Holding", null, "NASDAQ", "USD", "US", "Technology", "Semiconductor Equipment", ["semiconductors"], "Builds lithography systems for chipmakers.", [820, 320, 38, 18, 16, 0.6, 80, -200000, -100, 1, 2, 12, 16, 6, 1, 0, 960, 0.2, 0.022, 0.0003]),
  U("AMAT", "Applied Materials", null, "NASDAQ", "USD", "US", "Technology", "Semiconductor Equipment", ["semiconductors"], "Supplies semiconductor manufacturing equipment.", [190, 155, 22, 12, 10, 1.5, 79, 300000, 800, 2, 2, 10, 14, 7, 1, 0, 220, 0.15, 0.02, 0.0002]),
  U("LRCX", "Lam Research", null, "NASDAQ", "USD", "US", "Technology", "Semiconductor Equipment", ["semiconductors"], "Supplies wafer-fabrication equipment.", [95, 120, 26, 14, 18, 2.1, 81, 200000, 600, 2, 1, 11, 9, 5, 1, 0, 118, 0.25, 0.024, 0.0004]),
  U("KLAC", "KLA", null, "NASDAQ", "USD", "US", "Technology", "Semiconductor Equipment", ["semiconductors"], "Supplies process-control and inspection systems.", [710, 95, 28, 11, 9, 1.8, 84, -100000, -50, 1, 2, 8, 10, 4, 0, 0, 800, 0.1, 0.02, 0.0002]),
  U("MU", "Micron Technology", null, "NASDAQ", "USD", "US", "Technology", "Semiconductors", ["semiconductors", "ai"], "Manufactures memory and storage semiconductors.", [110, 122, 18, 45, 60, 2.6, 77, 600000, 2000, 3, 2, 16, 12, 6, 1, 0, 145, 0.45, 0.032, 0.0007]),
  U("ARM", "Arm Holdings", null, "NASDAQ", "USD", "US", "Technology", "Semiconductors", ["semiconductors", "ai"], "Licenses processor architectures.", [145, 150, 90, 22, 18, 1.6, 60, 0, 0, 1, 1, 14, 10, 8, 2, 0, 175, 0.2, 0.03, 0.0005]),
  U("SMCI", "Super Micro Computer", null, "NASDAQ", "USD", "US", "Technology", "Computer Hardware", ["ai", "infrastructure"], "Builds servers for accelerated computing.", [42, 25, 16, 40, 25, 9.5, 48, -1500000, -20000, 1, 4, 6, 8, 7, 3, 1, 58, 0.1, 0.05, 0.0002]),
  U("INTC", "Intel", null, "NASDAQ", "USD", "US", "Technology", "Semiconductors", ["semiconductors"], "Designs and manufactures CPUs and foundry services.", [24, 105, 0, -8, -30, 2.2, 65, -800000, -15000, 1, 5, 2, 6, 18, 8, 2, 22, -0.45, 0.028, -0.0006]),
  U("PLTR", "Palantir Technologies", null, "NASDAQ", "USD", "US", "Technology", "Software — AI platform", ["ai"], "Builds data and artificial intelligence software platforms.", [48, 110, 180, 36, 40, 4.2, 46, 2200000, 12000, 5, 2, 8, 10, 9, 3, 1, 70, 0.35, 0.038, 0.001], NH),
  U("SNOW", "Snowflake", null, "NYSE", "USD", "US", "Technology", "Cloud software", ["cloud", "ai"], "Provides a cloud data platform.", [155, 50, 0, 28, 15, 3.4, 62, 400000, 800, 2, 3, 12, 16, 10, 2, 0, 190, 0.15, 0.032, 0.0003]),
  U("CRWD", "CrowdStrike", null, "NASDAQ", "USD", "US", "Technology", "Cybersecurity", ["cybersecurity", "cloud"], "Provides a cloud endpoint-security platform.", [310, 75, 75, 30, 24, 2.8, 71, 900000, 1500, 3, 2, 24, 10, 4, 0, 0, 390, 0.5, 0.026, 0.0008], NH),
  U("PANW", "Palo Alto Networks", null, "NASDAQ", "USD", "US", "Technology", "Cybersecurity", ["cybersecurity", "cloud"], "Provides cybersecurity platforms. In 2025 it agreed to acquire CyberArk; verify listing status before trading.", [195, 130, 48, 18, 16, 1.9, 78, 500000, 900, 2, 2, 28, 12, 5, 1, 0, 240, 0.4, 0.022, 0.0005], NH),
  U("ZS", "Zscaler", null, "NASDAQ", "USD", "US", "Technology", "Cybersecurity", ["cybersecurity", "cloud"], "Provides cloud security services.", [185, 28, 80, 24, 20, 4.1, 69, 200000, 400, 2, 2, 16, 12, 6, 1, 0, 230, 0.25, 0.03, 0.0004]),
  U("FTNT", "Fortinet", null, "NASDAQ", "USD", "US", "Technology", "Cybersecurity", ["cybersecurity"], "Sells network security appliances and software.", [95, 72, 40, 12, 10, 2.2, 80, -100000, -500, 1, 2, 12, 14, 8, 2, 0, 112, 0.05, 0.02, 0.0002]),
  U("NET", "Cloudflare", null, "NYSE", "USD", "US", "Technology", "Cloud infrastructure", ["cloud", "cybersecurity"], "Provides a cloud network and security platform.", [88, 30, 0, 28, 18, 2.7, 66, 300000, 1000, 3, 2, 10, 14, 8, 2, 0, 120, 0.3, 0.032, 0.0005]),
  U("DDOG", "Datadog", null, "NASDAQ", "USD", "US", "Technology", "Cloud software", ["cloud", "ai"], "Provides a cloud observability platform.", [130, 44, 70, 24, 20, 2.5, 73, 250000, 600, 2, 2, 18, 12, 6, 1, 0, 165, 0.28, 0.028, 0.0004]),
  U("CRM", "Salesforce", null, "NYSE", "USD", "US", "Technology", "Cloud software", ["cloud", "ai"], "Provides cloud CRM and enterprise software.", [290, 280, 38, 10, 12, 1.6, 78, -400000, -800, 1, 3, 20, 18, 8, 1, 0, 340, 0.15, 0.018, 0.0002]),
  U("NOW", "ServiceNow", null, "NYSE", "USD", "US", "Technology", "Cloud software", ["cloud", "ai"], "Provides a cloud workflow platform.", [920, 190, 70, 22, 24, 1.3, 82, 700000, 400, 2, 1, 22, 10, 4, 0, 0, 1100, 0.35, 0.02, 0.0004]),
  U("MSFT", "Microsoft", "מיקרוסופט", "NASDAQ", "USD", "US", "Technology", "Software — cloud and AI platform", ["ai", "cloud"], "Builds software, cloud infrastructure, and AI products.", [420, 3100, 34, 15, 14, 0.7, 73, 0, 0, 2, 3, 30, 12, 3, 0, 0, 480, 0.25, 0.015, 0.0003]),
  U("GOOGL", "Alphabet", null, "NASDAQ", "USD", "US", "Communication", "Internet and AI platform", ["ai", "cloud"], "Operates search, cloud, and artificial intelligence products.", [175, 2100, 22, 14, 18, 0.9, 64, 0, 0, 1, 2, 28, 14, 4, 0, 0, 210, 0.3, 0.018, 0.0003]),
  U("AMZN", "Amazon", null, "NASDAQ", "USD", "US", "Consumer", "Cloud and internet retail", ["cloud", "ai"], "Operates e-commerce and Amazon Web Services cloud.", [195, 2050, 36, 11, 20, 0.8, 64, 0, 0, 1, 1, 32, 12, 3, 0, 0, 240, 0.35, 0.018, 0.0003]),
  U("META", "Meta Platforms", null, "NASDAQ", "USD", "US", "Communication", "Internet and AI platform", ["ai"], "Operates social platforms and invests in artificial intelligence.", [580, 1450, 26, 18, 22, 1.2, 70, -2000000, -2000, 1, 3, 30, 14, 4, 1, 0, 680, 0.2, 0.02, 0.0003]),
  U("ORCL", "Oracle", null, "NYSE", "USD", "US", "Technology", "Cloud software", ["cloud", "ai"], "Provides database and cloud infrastructure software.", [165, 460, 38, 12, 14, 1.1, 45, 800000, 3000, 2, 2, 14, 12, 8, 2, 0, 200, 0.22, 0.02, 0.0003]),
  U("AI", "C3.ai", null, "NYSE", "USD", "US", "Technology", "Software — AI platform", ["ai"], "Sells enterprise artificial intelligence application software.", [28, 3.4, 0, 18, -10, 12, 42, -300000, -8000, 1, 3, 3, 4, 6, 2, 1, 36, 0.05, 0.045, 0.0001]),
  U("PATH", "UiPath", null, "NYSE", "USD", "US", "Technology", "Software — AI platform", ["ai", "cloud"], "Provides automation software.", [14, 7.5, 0, 12, 8, 4.5, 58, 100000, 2000, 2, 2, 6, 8, 7, 2, 0, 18, 0.1, 0.03, 0.0002]),
  U("SOUN", "SoundHound AI", null, "NASDAQ", "USD", "US", "Technology", "Software — AI platform", ["ai"], "Builds voice artificial intelligence software.", [8.5, 1.1, 0, 55, null, null, null, 150000, 20000, 2, 1, 2, 3, 4, 1, 0, 12, 0.2, 0.06, 0.0004]),
  U("UPST", "Upstart", null, "NASDAQ", "USD", "US", "Financials", "AI lending software", ["ai"], "Provides an AI lending marketplace.", [52, 4.6, 30, 22, 40, 14, 55, -200000, -3000, 1, 3, 4, 5, 6, 3, 1, 62, -0.1, 0.05, 0.0001]),
  U("IONQ", "IonQ", null, "NYSE", "USD", "US", "Technology", "Quantum computing", ["quantum"], "Develops quantum computing systems.", [32, 7, 0, 80, null, 8, 40, 500000, 10000, 3, 1, 4, 5, 4, 1, 0, 48, 0.4, 0.055, 0.0008], NH),
  U("RGTI", "Rigetti Computing", null, "NASDAQ", "USD", "US", "Technology", "Quantum computing", ["quantum"], "Develops superconducting quantum computers.", [9, 1.4, null, 40, -20, 11, 28, 0, 0, 1, 1, 2, 2, 3, 1, 1, 14, 0.1, 0.07, 0.0002]),
  U("QBTS", "D-Wave Quantum", null, "NYSE", "USD", "US", "Technology", "Quantum computing", ["quantum"], "Develops quantum annealing systems.", [7.5, 0.9, 0, 30, null, 9, 22, null, null, null, null, 1, 2, 3, 1, 0, 11, 0.05, 0.065, 0.0001]),
  U("BBAI", "BigBear.ai", null, "NYSE", "USD", "US", "Technology", "Software — AI platform", ["ai"], "Provides decision-intelligence software.", [4.2, 0.7, 0, null, -15, 8, 30, -50000, -4000, 1, 2, 1, 2, 3, 1, 0, 6, 0, 0.06, 0]),
  U("MRNA", "Moderna", null, "NASDAQ", "USD", "US", "Healthcare", "Biotechnology", ["biotech"], "Develops mRNA therapeutics and vaccines.", [42, 16, 0, -25, -40, 6.5, 68, -300000, -2000, 1, 3, 4, 8, 10, 4, 1, 55, -0.2, 0.035, -0.0003]),
  U("REGN", "Regeneron", null, "NASDAQ", "USD", "US", "Healthcare", "Biotechnology", ["biotech"], "Discovers and develops biologic medicines.", [980, 105, 22, 8, 6, 1.8, 82, 200000, 100, 2, 1, 12, 10, 6, 1, 0, 1100, 0.1, 0.018, 0.0001]),
  U("VRTX", "Vertex Pharmaceuticals", null, "NASDAQ", "USD", "US", "Healthcare", "Biotechnology", ["biotech"], "Develops medicines for serious diseases.", [460, 118, 28, 12, 10, 1.4, 86, 100000, 80, 1, 1, 16, 10, 4, 0, 0, 540, 0.25, 0.018, 0.0002]),
  U("CRSP", "CRISPR Therapeutics", null, "NASDAQ", "USD", "US", "Healthcare", "Biotechnology", ["biotech"], "Develops genomic medicines.", [48, 1.8, 0, 20, -10, 10, 60, 0, 0, 1, 1, 6, 8, 7, 2, 0, 70, 0.2, 0.04, 0.0003]),
  U("VST", "Vistra", null, "NYSE", "USD", "US", "Utilities", "Independent power producers", ["infrastructure"], "Operates power generation, including nuclear assets used by data centers.", [140, 48, 18, 16, 20, 3.2, 88, 400000, 2000, 2, 1, 10, 8, 4, 1, 0, 185, 0.4, 0.026, 0.0007], NH),
  U("CEG", "Constellation Energy", null, "NASDAQ", "USD", "US", "Utilities", "Independent power producers", ["infrastructure"], "Operates nuclear generation and sells power.", [240, 75, 28, 10, 12, 2.4, 84, 200000, 500, 2, 1, 12, 8, 3, 0, 0, 290, 0.3, 0.022, 0.0004]),
  U("ETN", "Eaton", null, "NYSE", "USD", "US", "Industrials", "Electrical equipment", ["infrastructure"], "Supplies electrical equipment for power management.", [330, 130, 32, 10, 12, 1.3, 82, 100000, 200, 1, 2, 10, 12, 5, 0, 0, 370, 0.1, 0.016, 0.0002]),
  U("PWR", "Quanta Services", null, "NYSE", "USD", "US", "Industrials", "Infrastructure construction", ["infrastructure"], "Builds electric power and energy infrastructure.", [290, 43, 36, 16, 18, 1.7, 90, 250000, 400, 2, 1, 12, 8, 3, 0, 0, 340, 0.25, 0.02, 0.0004]),
  U("GEV", "GE Vernova", null, "NYSE", "USD", "US", "Industrials", "Electrical equipment", ["infrastructure"], "Supplies power-generation and grid equipment.", [320, 88, 40, 14, 18, 1.9, 79, 300000, 600, 2, 1, 10, 8, 4, 1, 0, 380, 0.2, 0.024, 0.0003]),
  U("ANET", "Arista Networks", null, "NYSE", "USD", "US", "Technology", "Networking hardware", ["cloud", "ai"], "Sells cloud networking equipment.", [95, 120, 40, 22, 20, 1.5, 74, 600000, 2000, 3, 2, 16, 10, 4, 0, 0, 125, 0.4, 0.024, 0.0006], NH),
  U("VRT", "Vertiv", null, "NYSE", "USD", "US", "Industrials", "Electrical equipment", ["infrastructure", "ai"], "Supplies power and cooling equipment for data centers.", [110, 42, 55, 24, 28, 2.8, 86, 400000, 1500, 2, 2, 10, 8, 4, 1, 0, 140, 0.3, 0.03, 0.0005]),
  U("TEVA", "Teva Pharmaceutical", "טבע", "NYSE", "USD", "IL", "Healthcare", "Pharmaceuticals", ["biotech"], "Develops and manufactures generic and specialty medicines. Dual-listed in Tel Aviv.", [18, 20, 8, 6, 12, 3.1, 55, 100000, 5000, 2, 2, 4, 8, 8, 2, 0, 22, 0.05, 0.02, 0.0001]),
  U("NICE", "NICE Ltd.", "נייס", "NASDAQ", "USD", "IL", "Technology", "Cloud software", ["cloud", "ai"], "Provides customer-engagement and analytics software. Israeli dual-listed company.", [160, 10, 22, 10, 12, 1.8, 70, 200000, 800, 2, 1, 6, 8, 4, 1, 0, 190, 0.15, 0.02, 0.0002]),
  U("CHKP", "Check Point Software", "צ'ק פוינט", "NASDAQ", "USD", "IL", "Technology", "Cybersecurity", ["cybersecurity"], "Provides cybersecurity products. Headquartered in Israel.", [195, 21, 20, 6, 8, 2.4, 72, -150000, -400, 1, 2, 6, 10, 8, 1, 0, 220, 0, 0.016, 0.0001]),
  U("MNDY", "monday.com", "מאנדיי", "NASDAQ", "USD", "IL", "Technology", "Cloud software", ["cloud"], "Provides a cloud work-management platform. Israeli company.", [280, 14, 80, 28, 30, 4.4, 64, 350000, 1000, 3, 1, 10, 8, 4, 1, 0, 370, 0.4, 0.032, 0.0008], NH),
  U("CYBR", "CyberArk", "סייברארק", "NASDAQ", "USD", "IL", "Technology", "Cybersecurity", ["cybersecurity"], "Provides identity security. Palo Alto Networks agreed to acquire the company in 2025; verify whether the ticker still trades.", [410, 18, 90, 26, 22, 3.2, 85, 100000, 200, 1, 2, 12, 6, 3, 0, 0, 450, 0.2, 0.022, 0.0003]),
  U("ESLT", "Elbit Systems", "אלביט מערכות", "NASDAQ", "USD", "IL", "Industrials", "Aerospace and defense", ["infrastructure"], "Develops defense electronics and systems. Dual-listed in Tel Aviv.", [210, 9.4, 32, 14, 12, 1.2, 40, 80000, 200, 1, 1, 3, 4, 2, 0, 0, 250, 0.2, 0.018, 0.0003]),
  U("WIX", "Wix.com", "וויקס", "NASDAQ", "USD", "IL", "Technology", "Cloud software", ["cloud"], "Provides a cloud website-building platform. Israeli company.", [175, 9.8, 40, 14, 18, 5.5, 68, 120000, 400, 2, 2, 8, 8, 6, 1, 0, 220, 0.15, 0.028, 0.0003]),
  U("NVMI", "Nova Ltd.", "נובה", "NASDAQ", "USD", "IL", "Technology", "Semiconductor Equipment", ["semiconductors"], "Supplies semiconductor metrology. Israeli company.", [220, 6.4, 30, 20, 18, 3.6, 74, 90000, 200, 2, 1, 5, 4, 2, 0, 0, 270, 0.3, 0.028, 0.0005]),
  U("CAMT", "Camtek", "קמטק", "NASDAQ", "USD", "IL", "Technology", "Semiconductor Equipment", ["semiconductors"], "Supplies inspection equipment for semiconductor manufacturing. Israeli company.", [90, 4.1, 28, 24, 22, 4.8, 62, 70000, 300, 2, 1, 4, 3, 2, 0, 0, 125, 0.45, 0.032, 0.0008], NH),
  U("INMD", "InMode", "אינמוד", "NASDAQ", "USD", "IL", "Healthcare", "Medical devices", ["biotech"], "Sells aesthetic medical devices. Israeli company.", [18, 1.5, 8, -12, -18, 7, 50, -200000, -6000, 1, 4, 2, 3, 5, 2, 1, 20, -0.3, 0.03, -0.0004]),
  U("FROG", "JFrog", "ג'ייפרוג", "NASDAQ", "USD", "IL", "Technology", "Cloud software", ["cloud", "cybersecurity"], "Provides a software-supply-chain platform. Israeli company.", [32, 3.6, 60, 20, 16, 4.2, 66, 80000, 500, 2, 1, 6, 6, 4, 1, 0, 42, 0.2, 0.03, 0.0003]),
  U("GLBE", "Global-E Online", "גלובל-אי", "NASDAQ", "USD", "IL", "Technology", "Cloud software", ["cloud"], "Provides cross-border e-commerce software. Israeli company.", [38, 6.2, 70, 24, 18, 5, 58, 60000, 400, 2, 1, 5, 6, 4, 1, 0, 50, 0.2, 0.03, 0.0004]),
  U("MBLY", "Mobileye", "מובילאיי", "NASDAQ", "USD", "IL", "Technology", "Auto technology and AI", ["ai"], "Develops advanced driver-assistance technology. Israeli company.", [16, 13, 40, 8, 6, 4.4, 72, -100000, -2000, 1, 2, 8, 10, 8, 2, 0, 22, 0.1, 0.028, 0.0001]),
  U("TEVA.TA", "Teva Pharmaceutical", "טבע", "TASE", "ILS", "IL", "Healthcare", "Pharmaceuticals", ["biotech"], "Tel Aviv listing of Teva. Demo prices are in ILS and are not FX-converted from the NYSE line.", [1800, 70, 8, 6, 12, 3, 50, 0, 0, 1, 1, 3, 5, 6, 2, 0, 2100, 0.05, 0.015, 0.0001]),
  U("NICE.TA", "NICE Ltd.", "נייס", "TASE", "ILS", "IL", "Technology", "Cloud software", ["cloud", "ai"], "Tel Aviv listing of NICE. Demo prices are in ILS.", [62000, 38, 22, 10, 12, 2, 60, 0, 0, 1, 1, 4, 5, 3, 1, 0, 70000, 0.1, 0.016, 0.0002]),
  U("ESLT.TA", "Elbit Systems", "אלביט מערכות", "TASE", "ILS", "IL", "Industrials", "Aerospace and defense", ["infrastructure"], "Tel Aviv listing of Elbit Systems. Demo prices are in ILS.", [82000, 36, 30, 14, 12, 1.5, 35, 0, 0, 1, 0, 2, 3, 2, 0, 0, 90000, 0.15, 0.014, 0.0002]),
  U("LUMI.TA", "Bank Leumi", "בנק לאומי", "TASE", "ILS", "IL", "Financials", "Banks", [], "Israeli commercial bank listed on the Tel Aviv Stock Exchange.", [4200, 62, 8, 5, 6, 0.4, 48, 0, 0, 0, 1, 2, 4, 5, 1, 0, 4600, 0, 0.012, 0.0001]),
  U("POLI.TA", "Bank Hapoalim", "בנק הפועלים", "TASE", "ILS", "IL", "Financials", "Banks", [], "Israeli commercial bank listed on the Tel Aviv Stock Exchange.", [4100, 55, 7, 4, 5, 0.5, 46, 0, 0, 0, 1, 2, 3, 5, 1, 0, 4400, -0.05, 0.012, 0]),
  U("ICL.TA", "ICL Group", "כימיקלים לישראל", "TASE", "ILS", "IL", "Materials", "Specialty chemicals", [], "Produces fertilizers and specialty minerals. Listed in Tel Aviv.", [1900, 24, 12, 2, 1, null, 40, null, null, null, null, null, null, null, null, null, null, null, 0.016, 0]),
];

export const UNIVERSE_BY_SYMBOL = new Map(UNIVERSE.map((row) => [row.symbol, row]));

/** Default hot-stock tape. The longer catalog above is only a reference pool. */
export const HOT_SYMBOLS = [
  "NVDA", "AMD", "AVGO", "TSM", "ASML", "MU", "PLTR", "CRWD", "PANW", "MSFT",
  "GOOGL", "AMZN", "META", "SNOW", "NET", "IONQ", "VST", "ANET", "SMCI", "NOW",
  "TEVA", "NICE", "CHKP", "MNDY", "CYBR", "ESLT", "WIX", "NVMI", "CAMT", "TEVA.TA",
] as const;

export const HOT_UNIVERSE = HOT_SYMBOLS.map((symbol) => {
  const profile = UNIVERSE_BY_SYMBOL.get(symbol);
  if (!profile) throw new Error(`Missing hot-universe profile ${symbol}`);
  return profile;
});
