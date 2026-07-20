import {
  ARENA_GOD_CHALLENGE_ID,
  PLATFORM_TO_ROUTING,
  resolveArenaQueueIds,
  resolveMatchStartTimeSeconds,
  type ArenaQueueMode,
} from "@league-arena/shared";
import {
  championIdFromParticipant,
  isArenaFirstPlace,
  nextScanStart,
  type ArenaParticipant,
} from "./arenaWins.js";

const matchCache = new Map<string, { data: MatchDto; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type AccountDto = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

type MatchDto = {
  info: {
    queueId: number;
    participants: ArenaParticipant[];
  };
};

type ChallengePlayerData = {
  challenges?: Array<{ challengeId: number; value: number }>;
};

function getApiKey(): string {
  const key = process.env.RIOT_API_KEY;
  if (!key) {
    throw new Error("RIOT_API_KEY is not set");
  }
  return key;
}

function routingForPlatform(platform: string): string {
  const routing = PLATFORM_TO_ROUTING[platform.toLowerCase()];
  if (!routing) {
    throw new Error(`Unknown region/platform: ${platform}`);
  }
  return routing;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function riotFetch<T>(url: string, retries = 4): Promise<T> {
  const apiKey = getApiKey();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { "X-Riot-Token": apiKey },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
      await sleep(Math.max(retryAfter, 1) * 1000);
      continue;
    }

    if (res.status === 404) {
      const err = new Error("Not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Riot API ${res.status}: ${body.slice(0, 200)}`);
      (err as Error & { status: number }).status = res.status;
      throw err;
    }

    return (await res.json()) as T;
  }

  throw new Error("Riot API rate limited — try again shortly");
}

export async function resolveAccount(
  gameName: string,
  tagLine: string,
  platform: string,
): Promise<AccountDto> {
  const routing = routingForPlatform(platform);
  const encodedName = encodeURIComponent(gameName);
  const encodedTag = encodeURIComponent(tagLine);
  return riotFetch<AccountDto>(
    `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTag}`,
  );
}

async function getMatchIds(
  puuid: string,
  routing: string,
  queue: number,
  start: number,
  count: number,
  startTimeSeconds?: number,
): Promise<string[]> {
  const params = new URLSearchParams({
    queue: String(queue),
    start: String(start),
    count: String(count),
  });
  if (startTimeSeconds != null) {
    params.set("startTime", String(startTimeSeconds));
  }
  return riotFetch<string[]>(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?${params}`,
  );
}

async function getMatch(matchId: string, routing: string): Promise<MatchDto> {
  const cached = matchCache.get(matchId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const data = await riotFetch<MatchDto>(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
  );
  matchCache.set(matchId, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

export async function getArenaChallengeValue(
  puuid: string,
  platform: string,
): Promise<number | undefined> {
  try {
    const data = await riotFetch<ChallengePlayerData>(
      `https://${platform.toLowerCase()}.api.riotgames.com/lol/challenges/v1/player-data/${puuid}`,
    );
    const challenge = data.challenges?.find(
      (c) => c.challengeId === ARENA_GOD_CHALLENGE_ID,
    );
    return challenge?.value;
  } catch {
    return undefined;
  }
}

export type ScanPageResult = {
  champions: string[];
  scanned: number;
  nextStart: number | null;
  done: boolean;
};

/**
 * Scan one page of Arena match history for the selected queue mode.
 * `start` / `count` apply per-queue (same offset for each queue in the mode).
 * When seasonOnly, only matches since Arena Season 2 start are returned by Riot.
 */
export async function scanArenaWinsPage(
  puuid: string,
  platform: string,
  start: number,
  count: number,
  queueMode: ArenaQueueMode = "all",
  seasonOnly = true,
): Promise<ScanPageResult> {
  const routing = routingForPlatform(platform);
  const queueIds = resolveArenaQueueIds(queueMode);
  const startTime = resolveMatchStartTimeSeconds(seasonOnly);
  const won = new Set<string>();
  let scanned = 0;
  const queuePageLengths: number[] = [];

  for (const queue of queueIds) {
    const ids = await getMatchIds(
      puuid,
      routing,
      queue,
      start,
      count,
      startTime,
    );
    queuePageLengths.push(ids.length);

    for (const matchId of ids) {
      const match = await getMatch(matchId, routing);
      scanned += 1;
      const participant = match.info.participants.find((p) => p.puuid === puuid);
      if (participant && isArenaFirstPlace(participant)) {
        const champ = championIdFromParticipant(participant);
        if (champ) won.add(champ);
      }
    }
  }

  const page = nextScanStart({ start, count, queuePageLengths });

  return {
    champions: [...won],
    scanned,
    nextStart: page.nextStart,
    done: page.done,
  };
}
