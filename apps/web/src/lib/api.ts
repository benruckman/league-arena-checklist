import type { ArenaQueueMode, ArenaWinsResponse } from "@league-arena/shared";
import posthog from "posthog-js";

export const REGIONS = [
  { value: "na1", label: "NA" },
  { value: "euw1", label: "EUW" },
  { value: "eun1", label: "EUNE" },
  { value: "kr", label: "KR" },
  { value: "br1", label: "BR" },
  { value: "la1", label: "LAN" },
  { value: "la2", label: "LAS" },
  { value: "jp1", label: "JP" },
  { value: "oc1", label: "OCE" },
  { value: "tr1", label: "TR" },
  { value: "ru", label: "RU" },
  { value: "ph2", label: "PH" },
  { value: "sg2", label: "SG" },
  { value: "th2", label: "TH" },
  { value: "tw2", label: "TW" },
  { value: "vn2", label: "VN" },
  { value: "me1", label: "ME" },
] as const;

export function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const trimmed = input.trim();
  const hash = trimmed.lastIndexOf("#");
  if (hash <= 0 || hash === trimmed.length - 1) return null;
  return {
    gameName: trimmed.slice(0, hash).trim(),
    tagLine: trimmed.slice(hash + 1).trim(),
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchArenaWinsPage(params: {
  gameName: string;
  tagLine: string;
  region: string;
  start: number;
  count?: number;
  queues?: ArenaQueueMode;
  seasonOnly?: boolean;
}): Promise<ArenaWinsResponse> {
  const qs = new URLSearchParams({
    gameName: params.gameName,
    tagLine: params.tagLine,
    region: params.region,
    start: String(params.start),
    // Small pages: queues=all ⇒ up to 3×count Riot match fetches per request
    count: String(params.count ?? 5),
    queues: params.queues ?? "all",
    seasonOnly: params.seasonOnly === false ? "false" : "true",
  });

  const maxAttempts = 4;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = performance.now();
    try {
      const res = await fetch(`/api/arena-wins?${qs}`);
      const durationMs = Math.round(performance.now() - started);
      const body = (await res.json()) as ArenaWinsResponse & { error?: string };

      posthog.capture("api_arena_wins_client", {
        region: params.region,
        start: params.start,
        status: res.status,
        duration_ms: durationMs,
        attempt,
        truncated: Boolean(body.truncated),
        done: Boolean(body.done),
        scanned: body.scanned ?? 0,
      });

      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
        lastError = new Error(body.error ?? `Sync failed (${res.status})`);
        const backoff = Math.min(8_000, 500 * 2 ** (attempt - 1));
        await sleep(backoff);
        continue;
      }

      if (!res.ok) {
        throw new Error(body.error ?? `Sync failed (${res.status})`);
      }
      return body;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Network / JSON parse — retry a few times
      if (attempt < maxAttempts) {
        await sleep(Math.min(8_000, 500 * 2 ** (attempt - 1)));
        continue;
      }
    }
  }

  throw lastError ?? new Error("Sync failed");
}
