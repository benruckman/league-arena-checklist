import { describe, expect, it } from "vitest";
import {
  ARENA_QUEUE_IDS,
  ARENA_SEASON_START_ISO,
  ARENA_SEASON_START_SECONDS,
  DEFAULT_ARENA_QUEUE_MODE,
  DEFAULT_SEASON_ONLY,
  parseArenaQueueMode,
  parseSeasonOnly,
  resolveArenaQueueIds,
  resolveMatchStartTimeSeconds,
} from "@league-arena/shared";
import {
  championIdFromParticipant,
  collectFirstPlaceChampions,
  isArenaFirstPlace,
  matchIdsPageHasMore,
  nextScanStart,
} from "../src/arenaWins.js";

describe("resolveArenaQueueIds", () => {
  it("defaults to all Arena formats (2v2 + 3v3), matching Season Journey", () => {
    expect(DEFAULT_ARENA_QUEUE_MODE).toBe("all");
    expect(resolveArenaQueueIds()).toEqual([1700, 1710, 1750]);
    expect(resolveArenaQueueIds("all")).toEqual([...ARENA_QUEUE_IDS]);
  });

  it("can restrict to 3x6 trios only", () => {
    expect(resolveArenaQueueIds("trios")).toEqual([1750]);
  });

  it("can restrict to duos / 2x8 only", () => {
    expect(resolveArenaQueueIds("duos")).toEqual([1700, 1710]);
  });

  it("parses query param with all as default for unknown values", () => {
    expect(parseArenaQueueMode(undefined)).toBe("all");
    expect(parseArenaQueueMode("")).toBe("all");
    expect(parseArenaQueueMode("nope")).toBe("all");
    expect(parseArenaQueueMode("duos")).toBe("duos");
    expect(parseArenaQueueMode("trios")).toBe("trios");
  });
});

describe("season cutoff", () => {
  it("defaults to current Arena season only (Season Journey)", () => {
    expect(DEFAULT_SEASON_ONLY).toBe(true);
    expect(resolveMatchStartTimeSeconds()).toBe(ARENA_SEASON_START_SECONDS);
    expect(resolveMatchStartTimeSeconds(true)).toBe(ARENA_SEASON_START_SECONDS);
    expect(ARENA_SEASON_START_ISO.startsWith("2026-04-28")).toBe(true);
  });

  it("omits startTime when all-time history is requested", () => {
    expect(resolveMatchStartTimeSeconds(false)).toBeUndefined();
  });

  it("parses seasonOnly query values", () => {
    expect(parseSeasonOnly(undefined)).toBe(true);
    expect(parseSeasonOnly("true")).toBe(true);
    expect(parseSeasonOnly("1")).toBe(true);
    expect(parseSeasonOnly("false")).toBe(false);
    expect(parseSeasonOnly("0")).toBe(false);
    expect(parseSeasonOnly("alltime")).toBe(false);
  });
});

/**
 * Fixtures mirror real CHERRY match-v5 payloads observed for NA Arena:
 * win=true for top half, not only first place.
 * - 2x8 (16 players): placements 1–8, win true for 1–4
 * - 3x6 (18 players): placements 1–6, win true for 1–3
 */
describe("isArenaFirstPlace", () => {
  it("counts placement 1 as a first-place win", () => {
    expect(
      isArenaFirstPlace({
        championName: "Maokai",
        placement: 1,
        subteamPlacement: 1,
        win: true,
      }),
    ).toBe(true);
  });

  it("counts 3x6 trio first place the same way (placement 1)", () => {
    // Winning trio all share placement 1
    const trio = [
      { championName: "Vayne", placement: 1, subteamPlacement: 1, win: true },
      { championName: "Irelia", placement: 1, subteamPlacement: 1, win: true },
      { championName: "Yunara", placement: 1, subteamPlacement: 1, win: true },
    ];
    expect(trio.every(isArenaFirstPlace)).toBe(true);
  });

  it("does NOT count 3x6 top-half (placement 2–3) even when win=true", () => {
    expect(
      isArenaFirstPlace({
        championName: "Yorick",
        placement: 2,
        subteamPlacement: 2,
        win: true,
      }),
    ).toBe(false);
    expect(
      isArenaFirstPlace({
        championName: "Jhin",
        placement: 3,
        subteamPlacement: 3,
        win: true,
      }),
    ).toBe(false);
  });

  it("does NOT count top-half finishes (placement 2–4) even when win=true", () => {
    // Regression: treating win===true as first place falsely marks champs (e.g. Hecarim)
    expect(
      isArenaFirstPlace({
        championName: "Hecarim",
        placement: 3,
        subteamPlacement: 3,
        win: true,
      }),
    ).toBe(false);
    expect(
      isArenaFirstPlace({
        championName: "Sona",
        placement: 4,
        subteamPlacement: 4,
        win: true,
      }),
    ).toBe(false);
    expect(
      isArenaFirstPlace({
        championName: "Aurora",
        placement: 2,
        subteamPlacement: 2,
        win: true,
      }),
    ).toBe(false);
  });

  it("does NOT count bottom-half placements", () => {
    expect(
      isArenaFirstPlace({
        championName: "Fizz",
        placement: 5,
        subteamPlacement: 5,
        win: false,
      }),
    ).toBe(false);
    expect(
      isArenaFirstPlace({
        placement: 8,
        subteamPlacement: 8,
        win: false,
      }),
    ).toBe(false);
  });

  it("uses subteamPlacement when placement is missing/zero", () => {
    expect(
      isArenaFirstPlace({
        championName: "Darius",
        placement: 0,
        subteamPlacement: 1,
        win: true,
      }),
    ).toBe(true);
    expect(
      isArenaFirstPlace({
        placement: 0,
        subteamPlacement: 2,
        win: true,
      }),
    ).toBe(false);
  });

  it("does NOT fall back to win=true when Arena placement fields are missing", () => {
    // Bugged matches sometimes zero out placement; win still means top-half
    expect(
      isArenaFirstPlace({
        championName: "Hecarim",
        placement: 0,
        subteamPlacement: 0,
        win: true,
      }),
    ).toBe(false);
    expect(
      isArenaFirstPlace({
        win: true,
      }),
    ).toBe(false);
  });

  it("both teammates on the winning duo share placement 1", () => {
    const duo = [
      { championName: "Taric", placement: 1, subteamPlacement: 1, win: true },
      { championName: "Rengar", placement: 1, subteamPlacement: 1, win: true },
    ];
    expect(duo.every(isArenaFirstPlace)).toBe(true);
  });
});

describe("collectFirstPlaceChampions", () => {
  const puuid = "player-a";

  it("returns unique champion names for placement-1 games only", () => {
    const matches = [
      // first place
      [
        { puuid, championName: "Yuumi", placement: 1, win: true },
        { puuid: "other", championName: "Rengar", placement: 1, win: true },
      ],
      // top half but not first — must NOT count
      [
        { puuid, championName: "Hecarim", placement: 3, win: true },
        { puuid: "other", championName: "Brand", placement: 3, win: true },
      ],
      // another first on same champ — still one unique
      [
        { puuid, championName: "Yuumi", placement: 1, win: true },
      ],
      // first on different champ
      [
        { puuid, championName: "Maokai", placement: 1, subteamPlacement: 1, win: true },
      ],
    ];

    expect(collectFirstPlaceChampions(matches, puuid)).toEqual(["Maokai", "Yuumi"]);
  });

  it("ignores matches where the player is absent", () => {
    expect(
      collectFirstPlaceChampions(
        [[{ puuid: "someone-else", championName: "Zed", placement: 1, win: true }]],
        puuid,
      ),
    ).toEqual([]);
  });
});

describe("championIdFromParticipant", () => {
  it("uses championName from match-v5", () => {
    expect(championIdFromParticipant({ championName: "ChoGath" })).toBe("ChoGath");
  });

  it("returns null when name is missing", () => {
    expect(championIdFromParticipant({})).toBeNull();
    expect(championIdFromParticipant({ championName: "" })).toBeNull();
  });
});

describe("match pagination", () => {
  it("has more when a full page of ids is returned", () => {
    expect(matchIdsPageHasMore({ ids: Array(20).fill("x"), count: 20 })).toBe(true);
    expect(matchIdsPageHasMore({ ids: Array(19).fill("x"), count: 20 })).toBe(false);
    expect(matchIdsPageHasMore({ ids: [], count: 20 })).toBe(false);
  });

  it("continues when any queue still has a full page", () => {
    expect(
      nextScanStart({ start: 0, count: 20, queuePageLengths: [20, 0] }),
    ).toEqual({ nextStart: 20, done: false });
  });

  it("stops when every queue returns a short page", () => {
    expect(
      nextScanStart({ start: 180, count: 20, queuePageLengths: [12, 0] }),
    ).toEqual({ nextStart: null, done: true });
  });
});
