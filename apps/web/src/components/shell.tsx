"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, GitCompare, Landmark, LayoutGrid, LineChart, List, LogOut, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/state";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", key: "navScanner" as const, icon: LineChart },
  { href: "/dividends", key: "navDividend" as const, icon: Landmark },
  { href: "/heatmap", key: "navHeatmap" as const, icon: LayoutGrid },
  { href: "/movers", key: "navMovers" as const, icon: List },
  { href: "/compare", key: "navCompare" as const, icon: GitCompare },
  { href: "/watchlist", key: "navWatchlist" as const, icon: Star },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  const { meta, user, setSession } = useApp();
  const path = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-full">
      <header className="hairline sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="flex items-center gap-3 px-3 py-2 md:px-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded bg-accent font-mono text-sm font-bold text-black">AT</span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-wide">{t("appName")}</span>
              <span className="block text-[11px] text-muted">{t("tagline")}</span>
            </span>
          </Link>
          <nav className="ms-4 hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={cn("rounded px-2.5 py-1.5 text-xs text-muted hover:bg-white/5 hover:text-ink", path === link.href && "bg-white/10 text-ink")}>{t(link.key)}</Link>
            ))}
            <Link href="/alerts" className={cn("rounded px-2.5 py-1.5 text-xs text-muted hover:bg-white/5", path === "/alerts" && "bg-white/10 text-ink")}>{t("navAlerts")}</Link>
            <Link href="/methodology" className="rounded px-2.5 py-1.5 text-xs text-muted hover:bg-white/5">{t("navMethod")}</Link>
            <Link href="/settings" className="rounded px-2.5 py-1.5 text-xs text-muted hover:bg-white/5">{t("navSettings")}</Link>
          </nav>
          <form className="ms-auto hidden w-64 md:block" action="/" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); router.push(`/?q=${encodeURIComponent(String(data.get("q") ?? ""))}`); }}>
            <Input name="q" placeholder={t("search")} aria-label={t("search")} />
          </form>
          <div className="ms-auto flex items-center gap-1 md:ms-2">
            <Button variant="ghost" size="sm" onClick={() => setLocale(locale === "he" ? "en" : "he")}>{locale === "he" ? "EN" : "עב"}</Button>
            <Link href="/alerts" className="rounded p-2 text-muted hover:bg-white/5 lg:hidden" aria-label={t("navAlerts")}><Bell className="size-4" /></Link>
            {user ? (
              <Button variant="ghost" size="sm" onClick={async () => { await api("/api/v1/auth/logout", { method: "POST" }); setSession(null); router.refresh(); }}>
                <LogOut className="size-3.5" /> {user.name}
              </Button>
            ) : (
              <Link href="/login"><Button size="sm" variant="outline">{t("login")}</Button></Link>
            )}
          </div>
        </div>
      </header>
      {meta?.demoMode ? (
        <div className="border-b border-accent/40 bg-accent/15 px-4 py-2 text-center text-xs text-accent">{t("demoBanner")}</div>
      ) : meta ? (
        <div className="border-b border-info/30 bg-info/10 px-4 py-2 text-center text-xs text-info">{t("partialBanner")}</div>
      ) : null}
      <main className="mx-auto w-full max-w-[1440px] px-3 py-4 pb-24 md:px-5 md:pb-8">{children}</main>
      <footer className="border-t border-line px-4 py-4 text-center text-[11px] leading-relaxed text-muted">{t("disclaimer")}</footer>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-bg/95 backdrop-blur md:hidden">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-[10px] text-muted", path === link.href && "text-accent")}>
            <link.icon className="size-4" />
            {t(link.key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
