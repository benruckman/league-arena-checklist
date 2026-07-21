import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.POSTHOG_API_KEY ?? process.env.VITE_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.POSTHOG_HOST ?? process.env.VITE_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/** Fire-and-forget product analytics from the API (no PII). */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
) {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        source: "api",
      },
    });
  } catch (err) {
    console.warn("[analytics] capture failed", err);
  }
}

export async function shutdownAnalytics() {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
