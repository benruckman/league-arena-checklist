import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import type { ArenaQueueMode, ArenaWinsResponse } from "@league-arena/shared";
import { fetchArenaWinsPage, parseRiotId, REGIONS } from "../lib/api";

export type SyncProgress = {
  scanned: number;
  found: number;
  challengeValue?: number;
  riotId: string;
};

export type SyncActivity = {
  status: "idle" | "running" | "done" | "error";
  message: string;
  progress: SyncProgress | null;
};

type Props = {
  onMergeWins: (championIds: string[], meta: SyncProgress) => void;
  onActivityChange?: (activity: SyncActivity) => void;
  stopSignal?: number;
};

export function SyncPanel({ onMergeWins, onActivityChange, stopSignal = 0 }: Props) {
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("na1");
  const [triosOnly, setTriosOnly] = useState(false);
  const [allTime, setAllTime] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const stopRef = useRef(false);
  const lastStopSignal = useRef(stopSignal);

  useEffect(() => {
    onActivityChange?.({ status, message, progress });
  }, [status, message, progress, onActivityChange]);

  useEffect(() => {
    if (stopSignal !== lastStopSignal.current) {
      lastStopSignal.current = stopSignal;
      if (status === "running") {
        stopRef.current = true;
      }
    }
  }, [stopSignal, status]);

  async function runSync() {
    const parsed = parseRiotId(riotId);
    if (!parsed) {
      setStatus("error");
      setMessage("Enter a Riot ID like GameName#TAG");
      return;
    }

    const queues: ArenaQueueMode = triosOnly ? "trios" : "all";
    const seasonOnly = !allTime;
    stopRef.current = false;
    posthog.capture("sync_started", { region, queues, season_only: seasonOnly });
    setStatus("running");
    setMessage(
      seasonOnly
        ? "Looking up account (current Arena season)…"
        : "Looking up account (all-time history)…",
    );
    setProgress(null);

    const allFound = new Set<string>();
    let start = 0;
    /** Matches from fully finished pages (not the in-progress truncated page). */
    let completedScanned = 0;
    let challengeValue: number | undefined;
    let resolvedRiotId = `${parsed.gameName}#${parsed.tagLine}`;
    let seasonStart: string | undefined;

    try {
      while (!stopRef.current) {
        const page: ArenaWinsResponse = await fetchArenaWinsPage({
          gameName: parsed.gameName,
          tagLine: parsed.tagLine,
          region,
          start,
          count: 5,
          queues,
          seasonOnly,
        });

        resolvedRiotId = page.riotId;
        seasonStart = page.seasonStart;
        if (page.challengeValue != null) challengeValue = page.challengeValue;
        for (const id of page.champions) allFound.add(id);

        const totalScanned = page.truncated
          ? completedScanned + page.scanned
          : completedScanned + page.scanned;
        if (!page.truncated) {
          completedScanned += page.scanned;
        }

        const meta: SyncProgress = {
          scanned: totalScanned,
          found: allFound.size,
          challengeValue,
          riotId: resolvedRiotId,
        };
        setProgress(meta);
        onMergeWins([...allFound], meta);

        const scopeNote = seasonOnly
          ? ` since ${seasonStart?.slice(0, 10) ?? "season start"}`
          : " (all-time)";
        setMessage(
          page.done
            ? `Done — ${allFound.size} unique 1sts from ${totalScanned} Arena games${scopeNote}` +
                (!seasonOnly &&
                challengeValue != null &&
                challengeValue > allFound.size
                  ? ` (lifetime challenge says ${challengeValue})`
                  : "")
            : `Scanning… ${totalScanned} games, ${allFound.size} unique 1sts${scopeNote}`,
        );

        if (page.done || page.nextStart == null) break;
        // Truncated pages keep the same start so the server can finish via cache.
        start = page.nextStart;
      }

      if (stopRef.current) {
        posthog.capture("sync_stopped_early", {
          wins_found: allFound.size,
          games_scanned: completedScanned,
          region,
        });
        setStatus("done");
        setMessage(
          `Stopped early — ${allFound.size} unique 1sts from ${completedScanned} games so far`,
        );
      } else {
        posthog.capture("sync_completed", {
          wins_found: allFound.size,
          games_scanned: completedScanned,
          region,
          season_only: seasonOnly,
          challenge_value: challengeValue,
        });
        setStatus("done");
      }
    } catch (err) {
      const error_message = err instanceof Error ? err.message : "Sync failed";
      posthog.capture("sync_error", { error_message, region, start });
      posthog.captureException(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
      setMessage(error_message);
    }
  }

  function stopSync() {
    stopRef.current = true;
  }

  return (
    <section className="sync-panel" aria-label="Riot sync">
      <div className="sync-row">
        <label className="field">
          <span>Riot ID</span>
          <input
            type="text"
            placeholder="GameName#TAG"
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
            disabled={status === "running"}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="field field-region">
          <span>Region</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={status === "running"}
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {status === "running" ? (
          <button type="button" className="btn btn-ghost" onClick={stopSync}>
            Stop
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={runSync}>
            Sync wins
          </button>
        )}
      </div>

      <div className="sync-options">
        <label className="sync-option">
          <input
            type="checkbox"
            checked={triosOnly}
            onChange={(e) => setTriosOnly(e.target.checked)}
            disabled={status === "running"}
          />
          <span>3v3 only (exclude 2v2 / 2x8)</span>
        </label>
        <label className="sync-option">
          <input
            type="checkbox"
            checked={allTime}
            onChange={(e) => setAllTime(e.target.checked)}
            disabled={status === "running"}
          />
          <span>All-time history (ignore season cutoff)</span>
        </label>
      </div>

      {status === "running" && (
        <div className="sync-inline-loader" aria-hidden="true">
          <div className="sync-bar">
            <span className="sync-bar-fill" />
          </div>
        </div>
      )}

      {(message || progress) && (
        <p className={`sync-msg status-${status}`} role="status">
          {status === "running" && <span className="sync-spinner" aria-hidden="true" />}
          {message}
          {progress?.challengeValue != null && (
            <> · Challenge count: {progress.challengeValue}</>
          )}
        </p>
      )}
      <p className="sync-hint">
        Defaults to the current Arena season (since 2026-04-28), all formats — same
        window as Season Journey. Manual marks are kept.
      </p>
    </section>
  );
}
