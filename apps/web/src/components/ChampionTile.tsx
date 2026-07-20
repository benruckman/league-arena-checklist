import type { Champion } from "../lib/ddragon";
import { championIconUrl } from "../lib/ddragon";

type Props = {
  champion: Champion;
  version: string;
  completed: boolean;
  onToggle: () => void;
};

export function ChampionTile({ champion, version, completed, onToggle }: Props) {
  return (
    <button
      type="button"
      className={`champ-tile${completed ? " is-done" : ""}`}
      onClick={onToggle}
      title={completed ? `Unmark ${champion.name}` : `Mark ${champion.name} won`}
      aria-pressed={completed}
    >
      <img
        src={championIconUrl(version, champion.id)}
        alt=""
        width={56}
        height={56}
        loading="lazy"
        decoding="async"
      />
      <span className="champ-name">{champion.name}</span>
      {completed && <span className="champ-check" aria-hidden="true">✓</span>}
    </button>
  );
}
