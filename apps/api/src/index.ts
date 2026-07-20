import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARENA_SEASON_START_ISO,
  parseArenaQueueMode,
  parseSeasonOnly,
} from "@league-arena/shared";
import {
  getArenaChallengeValue,
  resolveAccount,
  scanArenaWinsPage,
} from "./riot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

const app = new Hono();

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  "*",
  cors({
    origin: corsOrigin
      ? corsOrigin.split(",").map((o) => o.trim())
      : "*",
  }),
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    hasRiotKey: Boolean(process.env.RIOT_API_KEY),
  }),
);

app.get("/api/arena-wins", async (c) => {
  const gameName = c.req.query("gameName")?.trim();
  const tagLine = c.req.query("tagLine")?.trim();
  const region = c.req.query("region")?.trim()?.toLowerCase();
  const start = Math.max(0, Number(c.req.query("start") ?? "0") || 0);
  const count = Math.min(
    100,
    Math.max(1, Number(c.req.query("count") ?? "20") || 20),
  );
  const queueMode = parseArenaQueueMode(c.req.query("queues"));
  const seasonOnly = parseSeasonOnly(c.req.query("seasonOnly"));

  if (!gameName || !tagLine || !region) {
    return c.json(
      { error: "gameName, tagLine, and region are required" },
      400,
    );
  }

  if (!process.env.RIOT_API_KEY) {
    return c.json({ error: "RIOT_API_KEY is not configured on the server" }, 503);
  }

  try {
    const account = await resolveAccount(gameName, tagLine, region);
    const page = await scanArenaWinsPage(
      account.puuid,
      region,
      start,
      count,
      queueMode,
      seasonOnly,
    );

    let challengeValue: number | undefined;
    // Lifetime challenge — only useful as a reference for all-time syncs
    if (start === 0 && !seasonOnly) {
      challengeValue = await getArenaChallengeValue(account.puuid, region);
    }

    return c.json({
      champions: page.champions,
      scanned: page.scanned,
      start,
      count,
      nextStart: page.nextStart,
      done: page.done,
      challengeValue,
      riotId: `${account.gameName}#${account.tagLine}`,
      puuid: account.puuid,
      queues: queueMode,
      seasonOnly,
      seasonStart: seasonOnly ? ARENA_SEASON_START_ISO : undefined,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    if (status === 404) {
      return c.json({ error: "Riot account not found for that Game Name#Tag" }, 404);
    }
    console.error("[arena-wins]", message);
    if (status === 429) {
      return c.json({ error: message }, 429);
    }
    if (status === 403) {
      return c.json({ error: message }, 403);
    }
    return c.json({ error: message }, 500);
  }
});

const webDist = resolve(__dirname, "../../web/dist");
if (existsSync(webDist)) {
  app.use("/*", serveStatic({ root: webDist }));
  app.notFound(async (c) => {
    if (c.req.path.startsWith("/api")) {
      return c.json({ error: "Not found" }, 404);
    }
    const { readFile } = await import("node:fs/promises");
    const html = await readFile(resolve(webDist, "index.html"), "utf8");
    return c.html(html);
  });
}

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://localhost:${port}`);
  if (existsSync(webDist)) {
    console.log(`Serving web from ${webDist}`);
  }
});
