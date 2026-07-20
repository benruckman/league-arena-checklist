import type { ArenaQueueMode, ArenaWinsResponse } from "@league-arena/shared";

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
    count: String(params.count ?? 20),
    queues: params.queues ?? "all",
    seasonOnly: params.seasonOnly === false ? "false" : "true",
  });

  const res = await fetch(`/api/arena-wins?${qs}`);
  const body = (await res.json()) as ArenaWinsResponse & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Sync failed (${res.status})`);
  }
  return body;
}
