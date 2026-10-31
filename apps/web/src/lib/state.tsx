"use client";

import { applyTick, normalizeWeights, rescore, type StockRow, type Weights } from "@alphatape/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, wsUrl } from "./api";

export interface SessionUser { id: string; email: string; name: string; locale: string; weights?: unknown }
export interface ProviderInfo { id: string; name: string; configured: boolean; official: boolean; disabledReason: string | null; taseSupport: string; taseNotes: string }
export interface Meta { demoMode: boolean; providers: ProviderInfo[]; disclaimer: { he: string; en: string } }

interface AppCtx {
  rows: StockRow[] | null;
  error: string | null;
  loading: boolean;
  meta: Meta | null;
  user: SessionUser | null;
  refresh: () => Promise<void>;
  setSession: (user: SessionUser | null) => void;
  weights: Weights;
  setWeights: (weights: Weights) => Promise<void>;
  watched: Set<string>;
  toggleWatch: (symbol: string) => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppState({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<StockRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [weights, setWeightsState] = useState<Weights>(normalizeWeights());
  const [watched, setWatched] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [metaBody, stockBody, me] = await Promise.all([
        api<Meta>("/api/v1/meta"),
        api<{ rows: StockRow[] }>("/api/v1/stocks"),
        api<{ user: SessionUser | null }>("/api/v1/auth/me"),
      ]);
      setMeta(metaBody);
      setRows(stockBody.rows);
      setUser(me.user);
      if (stockBody.rows[0]) setWeightsState(normalizeWeights(stockBody.rows[0].score.weightsUsed));
      if (me.user) {
        const list = await api<{ lists: Array<{ symbols: string[] }> }>("/api/v1/watchlist");
        setWatched(new Set(list.lists.flatMap((item) => item.symbols)));
      } else setWatched(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const connect = () => {
      socket = new WebSocket(wsUrl());
      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data) as { type?: string; items?: Array<{ symbol: string; price: number; change: number | null; changePercent: number | null; volume: number | null; asOf: string; source: string }>; notification?: { title: string; body: string } };
        if (msg.type === "quotes" && msg.items) {
          const ticks = msg.items;
          setRows((current) => current?.map((row) => {
            const tick = ticks.find((item) => item.symbol === row.symbol);
            return tick ? applyTick(row, tick) : row;
          }) ?? current);
        }
        if (msg.type === "alert" && msg.notification) toast(msg.notification.title, { description: msg.notification.body });
      };
      socket.onclose = () => {
        if (!stopped) timer = setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, []);

  const setWeights = useCallback(async (next: Weights) => {
    const normalized = normalizeWeights(next);
    setWeightsState(normalized);
    setRows((current) => current?.map((row) => rescore(row, normalized)) ?? current);
    if (user) await api("/api/v1/settings", { method: "PUT", body: JSON.stringify(normalized) });
  }, [user]);

  const toggleWatch = useCallback(async (symbol: string) => {
    if (!user) return;
    if (watched.has(symbol)) {
      await api(`/api/v1/watchlist/${symbol}`, { method: "DELETE" });
      setWatched((current) => { const next = new Set(current); next.delete(symbol); return next; });
    } else {
      await api("/api/v1/watchlist", { method: "POST", body: JSON.stringify({ symbol }) });
      setWatched((current) => new Set(current).add(symbol));
    }
  }, [user, watched]);

  const value = useMemo<AppCtx>(() => ({
    rows, error, loading, meta, user, refresh, setSession: setUser, weights, setWeights, watched, toggleWatch,
  }), [rows, error, loading, meta, user, refresh, weights, setWeights, watched, toggleWatch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}
