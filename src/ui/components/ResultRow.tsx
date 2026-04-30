// src/ui/components/ResultRow.tsx
import type { Clip } from '../types';

interface ResultRowProps {
    clip: Clip;
    isSelected: boolean;
    onSelect: () => void;
    onPaste: () => void;
}

// ─── Time-ago helper ────────────────────────────────────────────────────────────

function timeAgo(unixSec: number): string {
    const diff = Math.floor(Date.now() / 1000) - unixSec;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(unixSec * 1000).toLocaleDateString();
}

// ─── Content type badge colors ──────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
    code: '#61dafb',
    command: '#f0c040',
    url: '#a78bfa',
    text: '#8b949e',
};

export const ResultRow: React.FC<ResultRowProps> = ({ clip, isSelected, onSelect, onPaste }) => {
    const badgeColor = BADGE_COLORS[clip.content_type] || BADGE_COLORS.text;
    const label = clip.language
        ? `${clip.content_type} · ${clip.language}`
        : clip.content_type;

    return (
        <div
            className={`result-row ${isSelected ? 'result-row--selected' : ''}`}
            onClick={onSelect}
            onDoubleClick={onPaste}
            role="option"
            aria-selected={isSelected}
        >
            <div className="result-row__badge" style={{ borderColor: badgeColor, color: badgeColor }}>
                {label}
            </div>
            <div className="result-row__preview">
                {clip.preview}
            </div>
            <div className="result-row__meta">
                {clip.source_app && <span className="result-row__app">{clip.source_app}</span>}
                <span className="result-row__time">{timeAgo(clip.captured_at)}</span>
            </div>
        </div>
    );
};
