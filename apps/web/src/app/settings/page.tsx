"use client";

import { WEIGHT_KEYS, type WeightKey } from "@alphatape/shared/scoring";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/state";

export default function SettingsPage() {
  const { weights, setWeights, meta } = useApp();
  const { t } = useI18n();
  const total = WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0) || 1;
  return (
    <div className="panel max-w-xl space-y-4 p-5">
      <h1 className="text-xl font-semibold">{t("navSettings")}</h1>
      <p className="text-xs text-muted">{t("settingsHint")}</p>
      {WEIGHT_KEYS.map((key) => (
        <label key={key} className="block text-xs">
          <span className="flex justify-between"><span>{key}</span><span className="num">{Math.round((weights[key] / total) * 100)}%</span></span>
          <input type="range" min={0} max={40} value={Math.round(weights[key] * 100)} onChange={(event) => void setWeights({ ...weights, [key]: Number(event.target.value) / 100 } as Record<WeightKey, number>)} className="w-full" />
        </label>
      ))}
      <Button variant="outline" onClick={() => void setWeights({ consensus: 0.18, coverage: 0.07, upside: 0.16, revisions: 0.07, revenueGrowth: 0.12, epsGrowth: 0.1, technicals: 0.12, insider: 0.06, institutional: 0.05, shortInterest: 0.04, risk: 0.03 })}>{t("clear")}</Button>
      <div className="text-xs text-muted">{t("providers")}: {(meta?.providers ?? []).map((provider) => `${provider.name} ${provider.configured ? t("on") : t("off")}`).join(" · ")}</div>
    </div>
  );
}
