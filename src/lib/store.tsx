import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { AppData, Mode } from "./types";
import { createSeed } from "./seed";
import { clearData, loadData, saveData } from "./storage";

interface Ctx {
  data: AppData;
  ready: boolean;
  mode: Mode;
  today: Date;
  update: (fn: (d: AppData) => AppData) => void;
  setMode: (m: Mode) => void;
  resetDemo: () => void;
  clearLocal: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => createSeed());
  const [ready, setReady] = useState(false);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    const res = loadData(window.localStorage);
    setData(res.data);
    setReady(true);
    if (res.recovered) toast.warning("Stored demo data was unreadable, so a fresh demo dataset was loaded.");
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((prev) => {
      const next = fn(prev);
      saveData(window.localStorage, next);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      data,
      ready,
      mode: data.mode,
      today,
      update,
      setMode: (m) => update((d) => ({ ...d, mode: m })),
      resetDemo: () => {
        const fresh = createSeed();
        saveData(window.localStorage, fresh);
        setData(fresh);
      },
      clearLocal: () => {
        clearData(window.localStorage);
        const fresh = createSeed();
        saveData(window.localStorage, fresh);
        setData(fresh);
      },
    }),
    [data, ready, today, update],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

/** Convenience: records and settings for the active mode. */
export function useModeData() {
  const { data, mode, today } = useApp();
  return useMemo(
    () => ({
      mode,
      today,
      transactions: data.transactions.filter((t) => t.mode === mode),
      payments: data.payments.filter((p) => p.mode === mode),
      accounts: data.accounts.filter((a) => a.mode === mode),
      goals: data.goals.filter((g) => g.mode === mode),
      finance: data.settings.finance[mode],
      settings: data.settings,
      data,
    }),
    [data, mode, today],
  );
}
