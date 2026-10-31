"use client";

import { DEFAULT_WEIGHTS, WEIGHT_KEYS } from "@alphatape/shared/scoring";
import { useI18n } from "@/lib/i18n";

export default function MethodologyPage() {
  const { t, locale } = useI18n();
  return (
    <article className="panel max-w-3xl space-y-4 p-5 text-sm leading-relaxed">
      <h1 className="text-xl font-semibold">{t("methodTitle")}</h1>
      <p>{t("methodBody")}</p>
      <p>{locale === "he"
        ? "כל רכיב מקבל ציון 0–100 או נשאר ריק. הציון הסופי הוא סכום (משקל × ציון) חלקי סכום המשקלות של הרכיבים שיש להם ציון. מקורות: קונצנזוס אנליסטים, מספר אנליסטים, אפסייד ליעד הממוצע, מגמת עדכון יעדים, צמיחת הכנסות, צמיחת EPS, מומנטום (RSI, MACD, ממוצעים נעים), פעילות בעלי עניין, החזקה מוסדית, שורט, וסיכון תנודתיות. ביטחון = 50% כיסוי משקל + 30% כיסוי שדות + 20% מספר אנליסטים."
        : "Each component scores 0–100 or stays empty. The final score is sum(weight × score) / sum(weights of available components). Inputs: analyst consensus, analyst count, upside to the mean target, target-revision trend, revenue growth, EPS growth, momentum (RSI, MACD, moving averages), insider activity, institutional ownership, short interest, and a volatility risk component. Confidence = 50% weight coverage + 30% field coverage + 20% analyst count."}</p>
      <table className="w-full text-xs">
        <tbody>
          {WEIGHT_KEYS.map((key) => (
            <tr key={key} className="border-t border-line"><td className="py-1">{key}</td><td className="num">{DEFAULT_WEIGHTS[key]}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">{t("disclaimer")}</p>
    </article>
  );
}
