export type Champion = {
  id: string;
  key: string;
  name: string;
  tags: string[];
};

let cachedVersion: string | null = null;
let cachedChampions: Champion[] | null = null;

export async function getDdragonVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!res.ok) throw new Error("Failed to load Data Dragon versions");
  const versions = (await res.json()) as string[];
  cachedVersion = versions[0];
  return cachedVersion;
}

export async function loadChampions(): Promise<{
  version: string;
  champions: Champion[];
}> {
  const version = await getDdragonVersion();
  if (cachedChampions) {
    return { version, champions: cachedChampions };
  }

  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
  );
  if (!res.ok) throw new Error("Failed to load champion data");
  const json = (await res.json()) as {
    data: Record<
      string,
      { id: string; key: string; name: string; tags: string[] }
    >;
  };

  const champions = Object.values(json.data)
    .map((c) => ({
      id: c.id,
      key: c.key,
      name: c.name,
      tags: c.tags,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cachedChampions = champions;
  return { version, champions };
}

export function championIconUrl(version: string, id: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
}
