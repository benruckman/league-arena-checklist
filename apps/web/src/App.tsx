import { useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import type { ChecklistState } from "@league-arena/shared";
import { ChampionTile } from "./components/ChampionTile";
import { SyncPanel, type SyncActivity } from "./components/SyncPanel";
import { SyncToast } from "./components/SyncToast";
import { loadChampions, type Champion } from "./lib/ddragon";
import {
  applyTheme,
  exportState,
  importState,
  loadState,
  saveState,
} from "./lib/storage";

type Filter = "all" | "missing" | "done";

export function App() {
  const [state, setState] = useState<ChecklistState>(() => loadState());
  const [champions, setChampions] = useState<Champion[]>([]);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncActivity, setSyncActivity] = useState<SyncActivity>({
    status: "idle",
    message: "",
    progress: null,
  });
  const [stopSignal, setStopSignal] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    applyTheme(state.theme);
    saveState(state);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadChampions();
        if (cancelled) return;
        setChampions(data.champions);
        setVersion(data.version);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load champions";
          setError(message);
          posthog.capture("champions_load_error", { error_message: message });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completedCount = useMemo(
    () => champions.filter((c) => state.completed[c.id]).length,
    [champions, state.completed],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return champions.filter((c) => {
      const done = Boolean(state.completed[c.id]);
      if (filter === "missing" && done) return false;
      if (filter === "done" && !done) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    });
  }, [champions, state.completed, query, filter]);

  const missing = filtered.filter((c) => !state.completed[c.id]);
  const done = filtered.filter((c) => state.completed[c.id]);

  function toggle(id: string) {
    setState((prev) => {
      const next = { ...prev.completed };
      if (next[id]) {
        delete next[id];
        posthog.capture("champion_win_unmarked", { champion_id: id });
      } else {
        next[id] = true;
        posthog.capture("champion_win_marked", { champion_id: id });
      }
      return { ...prev, completed: next };
    });
  }

  function toggleTheme() {
    setState((prev) => {
      const newTheme = prev.theme === "dark" ? "light" : "dark";
      posthog.capture("theme_toggled", { theme: newTheme });
      return { ...prev, theme: newTheme };
    });
  }

  function mergeWins(
    championIds: string[],
    meta: { scanned: number; riotId: string },
  ) {
    setState((prev) => {
      const next = { ...prev.completed };
      for (const id of championIds) {
        next[id] = true;
      }
      return {
        ...prev,
        completed: next,
        lastSync: {
          riotId: meta.riotId,
          at: new Date().toISOString(),
          scanned: meta.scanned,
        },
      };
    });
  }

  function downloadExport() {
    posthog.capture("checklist_exported", { completed_count: completedCount });
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arena-checklist.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importState(String(reader.result));
        setState(imported);
        posthog.capture("checklist_imported", {
          completed_count: Object.keys(imported.completed).length,
        });
      } catch {
        alert("Could not import that file.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand-block">
          <p className="eyebrow">League of Legends · Arena · Beta</p>
          <h1 className="brand">Arena Wins</h1>
          <p className="tagline">
            Track first-place champions for champ select — especially anvil
            picks.
          </p>
        </div>
        <div className="top-actions">
          <button type="button" className="btn btn-ghost" onClick={toggleTheme}>
            {state.theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSyncOpen((v) => !v)}
          >
            {syncOpen ? "Hide sync" : "Sync"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={downloadExport}
          >
            Export
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fileRef.current?.click()}
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <div className={syncOpen ? undefined : "is-collapsed"} hidden={!syncOpen}>
        <SyncPanel
          onMergeWins={mergeWins}
          onActivityChange={setSyncActivity}
          stopSignal={stopSignal}
        />
      </div>

      <div className="toolbar">
        <div className="progress" aria-live="polite">
          <strong>
            {completedCount}/{champions.length || "—"}
          </strong>
          <span> champions with a win</span>
          {syncActivity.status === "running" && (
            <span className="syncing-inline">
              {" "}
              <span className="sync-spinner" aria-hidden="true" /> syncing
              {syncActivity.progress
                ? ` · ${syncActivity.progress.scanned} games`
                : ""}
            </span>
          )}
          {state.lastSync && syncActivity.status !== "running" && (
            <span className="last-sync">
              {" "}
              · last sync {state.lastSync.riotId}
            </span>
          )}
        </div>
        <div className="filters">
          <input
            type="search"
            placeholder="Search champions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search"
          />
          <div className="seg" role="group" aria-label="Filter">
            {(
              [
                ["all", "All"],
                ["missing", "Missing"],
                ["done", "Done"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "is-active" : ""}
                onClick={() => {
                  setFilter(value);
                  posthog.capture("champion_filter_changed", { filter: value });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="state-msg">Loading champions…</p>}
      {error && <p className="state-msg error">{error}</p>}

      {!loading && !error && filter !== "done" && (
        <section className="champ-section">
          <h2>Not completed ({missing.length})</h2>
          <div className="champ-grid">
            {missing.map((c) => (
              <ChampionTile
                key={c.id}
                champion={c}
                version={version}
                completed={false}
                onToggle={() => toggle(c.id)}
              />
            ))}
          </div>
          {missing.length === 0 && (
            <p className="empty">Nothing left in this list.</p>
          )}
        </section>
      )}

      {!loading && !error && filter !== "missing" && (
        <section className="champ-section">
          <h2>Completed ({done.length})</h2>
          <div className="champ-grid">
            {done.map((c) => (
              <ChampionTile
                key={c.id}
                champion={c}
                version={version}
                completed
                onToggle={() => toggle(c.id)}
              />
            ))}
          </div>
          {done.length === 0 && (
            <p className="empty">
              No wins marked yet — tap a champion or sync.
            </p>
          )}
        </section>
      )}

      <footer className="foot">
        <p>
          Progress is stored in this browser. Arena data via Riot API when you
          sync.
        </p>
        <p className="foot-links">
          <a
            href="https://github.com/benruckman/league-arena-checklist"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          {" · "}
          contributions &amp; bug reports welcome
        </p>
        <p className="foot-disclaimer">
          Arena Wins is currently in beta. It is a third-party fan project and
          is not endorsed by or affiliated with Riot Games. League of Legends
          and Riot Games are trademarks or registered trademarks of Riot Games,
          Inc.
        </p>
      </footer>

      <SyncToast
        activity={syncActivity}
        onStop={() => setStopSignal((n) => n + 1)}
        onOpenPanel={() => setSyncOpen(true)}
      />
    </div>
  );
}
