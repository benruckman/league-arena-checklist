import type { ChecklistState, Theme } from "@league-arena/shared";

const STORAGE_KEY = "arena-checklist-v1";

const defaultState = (): ChecklistState => ({
  completed: {},
  theme: "dark",
});

export function loadState(): ChecklistState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<ChecklistState>;
    return {
      completed: parsed.completed ?? {},
      theme: parsed.theme === "light" ? "light" : "dark",
      lastSync: parsed.lastSync,
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: ChecklistState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state: ChecklistState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): ChecklistState {
  const parsed = JSON.parse(json) as Partial<ChecklistState>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid checklist file");
  }
  return {
    completed:
      parsed.completed && typeof parsed.completed === "object"
        ? (parsed.completed as Record<string, true>)
        : {},
    theme: parsed.theme === "light" ? "light" : "dark",
    lastSync: parsed.lastSync,
  };
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
