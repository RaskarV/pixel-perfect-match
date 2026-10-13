import type { AppData } from "./types";
import { createSeed, STORAGE_VERSION } from "./seed";

export const STORAGE_KEY = "smartspend:data";

function isValidData(x: unknown): x is AppData {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const arrays = ["transactions", "payments", "incomes", "receivables", "accounts", "cards", "goals", "scenarios", "dismissedInsights", "readNotifications"];
  return o["version"] === STORAGE_VERSION && arrays.every((k) => Array.isArray(o[k])) && !!o["settings"] && typeof o["settings"] === "object" && (o["mode"] === "personal" || o["mode"] === "business");
}

/** Loads persisted data; falls back to a fresh seed if missing or malformed. */
export function loadData(storage: Storage, today = new Date()): { data: AppData; recovered: boolean; fresh: boolean } {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    const data = createSeed(today);
    saveData(storage, data);
    return { data, recovered: false, fresh: true };
  }
  try {
    const parsed = JSON.parse(raw);
    if (isValidData(parsed)) return { data: parsed, recovered: false, fresh: false };
  } catch {
    /* fall through */
  }
  const data = createSeed(today);
  saveData(storage, data);
  return { data, recovered: true, fresh: true };
}

export function saveData(storage: Storage, data: AppData) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota or private mode — ignore */
  }
}

export function clearData(storage: Storage) {
  storage.removeItem(STORAGE_KEY);
}
