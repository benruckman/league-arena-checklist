import type { SyncActivity } from "./SyncPanel";

type Props = {
  activity: SyncActivity;
  onStop: () => void;
  onOpenPanel: () => void;
};

export function SyncToast({ activity, onStop, onOpenPanel }: Props) {
  if (activity.status !== "running") return null;

  const scanned = activity.progress?.scanned ?? 0;
  const found = activity.progress?.found ?? 0;

  return (
    <div className="sync-toast" role="status" aria-live="polite">
      <span className="sync-spinner sync-spinner-lg" aria-hidden="true" />
      <div className="sync-toast-copy">
        <strong>Scanning Arena history</strong>
        <span>
          {scanned > 0
            ? `${scanned} games · ${found} unique 1sts`
            : "Looking up account…"}
        </span>
      </div>
      <button type="button" className="btn btn-ghost sync-toast-btn" onClick={onOpenPanel}>
        Details
      </button>
      <button type="button" className="btn btn-ghost sync-toast-btn" onClick={onStop}>
        Stop
      </button>
    </div>
  );
}
