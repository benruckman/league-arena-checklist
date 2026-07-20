export type Theme = "dark" | "light";

export type ChecklistState = {
  completed: Record<string, true>;
  theme: Theme;
  lastSync?: {
    riotId: string;
    at: string;
    scanned: number;
  };
};

/** Which Arena rotations to scan. Default is all (matches Season Journey). */
export type ArenaQueueMode = "trios" | "duos" | "all";

export type ArenaWinsQuery = {
  gameName: string;
  tagLine: string;
  region: string;
  start?: number;
  count?: number;
  queues?: ArenaQueueMode;
  /** When true (default), only matches since ARENA_SEASON_START */
  seasonOnly?: boolean;
};

export type ArenaWinsResponse = {
  champions: string[];
  scanned: number;
  start: number;
  count: number;
  nextStart: number | null;
  done: boolean;
  challengeValue?: number;
  riotId: string;
  puuid: string;
  queues: ArenaQueueMode;
  seasonOnly: boolean;
  seasonStart?: string;
};

export type PlatformRegion =
  | "na1"
  | "euw1"
  | "eun1"
  | "kr"
  | "br1"
  | "la1"
  | "la2"
  | "jp1"
  | "oc1"
  | "tr1"
  | "ru"
  | "ph2"
  | "sg2"
  | "th2"
  | "tw2"
  | "vn2"
  | "me1";

export const PLATFORM_TO_ROUTING: Record<string, string> = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  me1: "europe",
  kr: "asia",
  jp1: "asia",
  oc1: "sea",
  ph2: "sea",
  sg2: "sea",
  th2: "sea",
  tw2: "sea",
  vn2: "sea",
};

/** Arena 3x6 trios */
export const ARENA_TRIOS_QUEUE_IDS = [1750] as const;

/** Arena duos / 2x8 (8 or 16 player lobbies) */
export const ARENA_DUOS_QUEUE_IDS = [1700, 1710] as const;

/** All known Arena match-v5 queues */
export const ARENA_QUEUE_IDS = [
  ...ARENA_DUOS_QUEUE_IDS,
  ...ARENA_TRIOS_QUEUE_IDS,
] as const;

/** Match Season Journey: count firsts from every Arena format */
export const DEFAULT_ARENA_QUEUE_MODE: ArenaQueueMode = "all";

/**
 * Arena Season 2 (Pandemonium) / Season Journey start — patch 26.09.
 * Match-v5 `startTime` is epoch seconds.
 */
export const ARENA_SEASON_START_ISO = "2026-04-28T00:00:00.000Z";
export const ARENA_SEASON_START_SECONDS = Math.floor(
  Date.parse(ARENA_SEASON_START_ISO) / 1000,
);

/** Default: only count wins from the current Arena season (Season Journey). */
export const DEFAULT_SEASON_ONLY = true;

export function resolveMatchStartTimeSeconds(
  seasonOnly: boolean = DEFAULT_SEASON_ONLY,
): number | undefined {
  return seasonOnly ? ARENA_SEASON_START_SECONDS : undefined;
}

export function parseSeasonOnly(
  value: string | null | undefined,
): boolean {
  if (value == null || value === "") return DEFAULT_SEASON_ONLY;
  if (value === "0" || value === "false" || value === "alltime") return false;
  if (value === "1" || value === "true" || value === "season") return true;
  return DEFAULT_SEASON_ONLY;
}

/**
 * Resolve which match-v5 queue IDs to scan.
 * - all (default): every known Arena queue (2v2 + 3v3)
 * - trios: 1750 only
 * - duos: 1700 + 1710
 */
export function resolveArenaQueueIds(
  mode: ArenaQueueMode = DEFAULT_ARENA_QUEUE_MODE,
): number[] {
  switch (mode) {
    case "duos":
      return [...ARENA_DUOS_QUEUE_IDS];
    case "trios":
      return [...ARENA_TRIOS_QUEUE_IDS];
    case "all":
    default:
      return [...ARENA_QUEUE_IDS];
  }
}

export function parseArenaQueueMode(
  value: string | null | undefined,
): ArenaQueueMode {
  if (value === "duos" || value === "all" || value === "trios") return value;
  return DEFAULT_ARENA_QUEUE_MODE;
}

/** Adapt to All Situations — unique Arena 1st-place champions */
export const ARENA_GOD_CHALLENGE_ID = 602002;
