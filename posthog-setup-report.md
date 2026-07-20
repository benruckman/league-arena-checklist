# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the League Arena app. PostHog is initialized in `apps/web/src/main.tsx` using environment variables before React renders. Eleven events are captured across the main app and sync panel components, covering the core user flows: manually marking/unmarking champion wins, Riot API sync lifecycle (started, completed, stopped early, errored), checklist import/export, theme toggling, filter changes, and champion load errors. Error tracking via `posthog.captureException` is wired to sync failures.

| Event | Description | File |
|---|---|---|
| `champion_win_marked` | User manually marks a champion as having a first-place Arena win | `apps/web/src/App.tsx` |
| `champion_win_unmarked` | User manually unmarks a champion win | `apps/web/src/App.tsx` |
| `sync_started` | User initiates a Riot ID sync (captures region, queue mode, season scope) | `apps/web/src/components/SyncPanel.tsx` |
| `sync_completed` | Sync run finishes successfully (captures wins found, games scanned, region) | `apps/web/src/components/SyncPanel.tsx` |
| `sync_stopped_early` | User manually stops an in-progress sync | `apps/web/src/components/SyncPanel.tsx` |
| `sync_error` | Sync attempt fails (captures error message, region) | `apps/web/src/components/SyncPanel.tsx` |
| `checklist_exported` | User downloads their checklist as JSON | `apps/web/src/App.tsx` |
| `checklist_imported` | User successfully imports a checklist from JSON | `apps/web/src/App.tsx` |
| `theme_toggled` | User switches between dark and light theme | `apps/web/src/App.tsx` |
| `champion_filter_changed` | User switches the champion list filter (all/missing/done) | `apps/web/src/App.tsx` |
| `champions_load_error` | App fails to load champion data from Data Dragon | `apps/web/src/App.tsx` |

## Next steps

We've built some insights and a dashboard to keep an eye on user behavior, based on the events just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/521394/dashboard/1879242)
- [Sync activity over time](https://us.posthog.com/project/521394/insights/zrbJ8am1)
- [Champion wins marked over time](https://us.posthog.com/project/521394/insights/s3hC0pDE)
- [Sync completion rate (funnel)](https://us.posthog.com/project/521394/insights/GfcJQvJy)
- [Sync by region](https://us.posthog.com/project/521394/insights/26bm8Fxb)
- [Checklist import and export usage](https://us.posthog.com/project/521394/insights/8ddZ2rHZ)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST` to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
