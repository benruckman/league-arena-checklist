/**
 * Pure Arena (CHERRY) helpers — no Riot network I/O.
 *
 * Real match-v5 behavior:
 * - 2x8 (16 players / 8 duos): placement 1–8; win=true for top half (1–4)
 * - 3x6 (18 players / 6 trios): placement 1–6; win=true for top half (1–3)
 * - First place for Arena God / Season Journey = placement === 1
 *   (all teammates on the winning team share placement 1)
 * - Never treat `win === true` alone as first place
 */

export type ArenaParticipant = {
  puuid?: string;
  championName?: string;
  championId?: number;
  placement?: number;
  subteamPlacement?: number;
  win?: boolean;
};

/**
 * True only when this participant finished 1st in Arena.
 * Never treat `win` alone as a first-place signal.
 */
export function isArenaFirstPlace(p: ArenaParticipant): boolean {
  const placement = normalizePlacement(p.placement);
  const subteam = normalizePlacement(p.subteamPlacement);

  if (placement != null) {
    return placement === 1;
  }
  if (subteam != null) {
    return subteam === 1;
  }
  // Bugged/missing Arena fields — do not use `win` (true for places 1–4)
  return false;
}

function normalizePlacement(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

export function championIdFromParticipant(p: ArenaParticipant): string | null {
  if (typeof p.championName === "string" && p.championName.length > 0) {
    return p.championName;
  }
  return null;
}

export type MatchIdsPage = {
  /** Match IDs returned for this page request */
  ids: string[];
  /** Requested page size */
  count: number;
};

/**
 * Whether another page of match IDs may exist.
 * A short page means the list is exhausted for that queue.
 */
export function matchIdsPageHasMore(page: MatchIdsPage): boolean {
  return page.ids.length >= page.count;
}

/**
 * Collect unique first-place champion IDs from participants for one player.
 */
export function collectFirstPlaceChampions(
  participantsByMatch: ArenaParticipant[][],
  puuid: string,
): string[] {
  const won = new Set<string>();
  for (const participants of participantsByMatch) {
    const me = participants.find((p) => p.puuid === puuid);
    if (!me || !isArenaFirstPlace(me)) continue;
    const id = championIdFromParticipant(me);
    if (id) won.add(id);
  }
  return [...won].sort();
}

/**
 * Pagination cursor after scanning queues at the same `start` offset.
 * Done only when every queue returned a short page.
 */
export function nextScanStart(args: {
  start: number;
  count: number;
  queuePageLengths: number[];
}): { nextStart: number | null; done: boolean } {
  const anyFull = args.queuePageLengths.some((len) => len >= args.count);
  if (!anyFull) {
    return { nextStart: null, done: true };
  }
  return { nextStart: args.start + args.count, done: false };
}
