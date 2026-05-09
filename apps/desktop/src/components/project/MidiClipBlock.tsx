import { memo, useRef } from 'react';
import type { MidiClip } from '../../stores/midiTrackStore';

// One MIDI clip block on a MIDI lane in the arrangement.
//
// Visual: violet block with a tiny note preview drawn inside (one dot
// per note, positioned by pitch + time within the clip). Mirrors how
// drum clips render their step pattern — gives the user a sense of
// what's in the clip without opening the piano roll.
//
// Interactions handled here:
//   - Click body → onSelect (parent opens piano roll for this clip)
//   - Drag body → onMove (snapped to bar by parent)
//   - Drag right edge → onResize (length, snapped to bar by parent)
//   - Right-click → onDelete (no confirmation)
//   - dragstart on body → emits 'application/x-ghost-midi-clip' MIME so
//     the user can drag the clip to a different MIDI lane (FL-style).

export const MIDI_CLIP_DRAG_MIME = 'application/x-ghost-midi-clip';

interface Props {
  clip: MidiClip;
  arrangementDur: number;
  selected: boolean;
  laneHeight: number;
  onSelect: () => void;
  onMove: (newStartSec: number) => void;
  onResize: (newLengthSec: number) => void;
  onDelete: () => void;
  // Convert a clientX (page coords) → project-time on this lane. The
  // parent owns the lane geometry so this gets passed in.
  xToTime: (clientX: number) => number;
}

const PREVIEW_LOW_PITCH = 36;   // C2
const PREVIEW_HIGH_PITCH = 96;  // C7

function MidiClipBlockInner({ clip, arrangementDur, selected, laneHeight, onSelect, onMove, onResize, onDelete, xToTime }: Props) {
  const leftPct = (clip.startSec / arrangementDur) * 100;
  const widthPct = (clip.lengthSec / arrangementDur) * 100;

  // Drag state lives in refs so re-renders during drag don't reset it.
  // Pattern matches the drum clip block — onMouseDown attaches window
  // listeners that fire onMove until mouseup.
  const dragRef = useRef<{ kind: 'move' | 'resize' | null; startClientX: number; originStart: number; originLength: number }>({
    kind: null, startClientX: 0, originStart: 0, originLength: 0,
  });

  const onBodyDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      onDelete();
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();
    dragRef.current = {
      kind: 'move',
      startClientX: e.clientX,
      originStart: clip.startSec,
      originLength: clip.lengthSec,
    };
    const onMouseMove = (mv: MouseEvent) => {
      const drag = dragRef.current;
      if (drag.kind !== 'move') return;
      // Map deltaX to delta-seconds. We can't just call xToTime(mv.clientX)
      // and subtract the start — that loses the original click offset
      // inside the clip. Instead, compute delta from the original click.
      const deltaX = mv.clientX - drag.startClientX;
      // The lane width is unknown locally; use xToTime of two reference
      // x's to derive seconds-per-pixel implicitly. xToTime(clientX) is
      // a linear function of clientX, so the slope is constant and we
      // can compute it once per drag.
      const t0 = xToTime(drag.startClientX);
      const t1 = xToTime(drag.startClientX + 1);
      const secPerPx = t1 - t0;
      const newStart = Math.max(0, drag.originStart + deltaX * secPerPx);
      onMove(newStart);
    };
    const onMouseUp = () => {
      dragRef.current.kind = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onResizeDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      kind: 'resize',
      startClientX: e.clientX,
      originStart: clip.startSec,
      originLength: clip.lengthSec,
    };
    const onMouseMove = (mv: MouseEvent) => {
      const drag = dragRef.current;
      if (drag.kind !== 'resize') return;
      const deltaX = mv.clientX - drag.startClientX;
      const t0 = xToTime(drag.startClientX);
      const t1 = xToTime(drag.startClientX + 1);
      const secPerPx = t1 - t0;
      const newLen = Math.max(0.05, drag.originLength + deltaX * secPerPx);
      onResize(newLen);
    };
    const onMouseUp = () => {
      dragRef.current.kind = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // FL-style drag-out: HTML5 drag emits a MIME with the clip id so the
  // user can drop it onto a different MIDI lane and the parent moves
  // the clip there. Setting effectAllowed=move means the cursor reads
  // as a move while dragging, not a copy.
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(MIDI_CLIP_DRAG_MIME, JSON.stringify({ clipId: clip.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  // Note-preview dot positions. Drawn relative to the block. Using
  // percentages so the preview stays accurate when the clip is
  // resized; the parent rect width changes naturally with widthPct.
  const previewRange = PREVIEW_HIGH_PITCH - PREVIEW_LOW_PITCH;

  return (
    <div
      data-clip-id={clip.id}
      data-midi-clip
      draggable
      onDragStart={onDragStart}
      onMouseDown={onBodyDown}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className="absolute top-0 cursor-grab active:cursor-grabbing rounded-md overflow-hidden"
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        height: laneHeight,
        background: selected
          ? 'linear-gradient(180deg, rgba(168,85,247,0.85) 0%, rgba(124,58,237,0.85) 100%)'
          : 'linear-gradient(180deg, rgba(124,58,237,0.7) 0%, rgba(91,33,182,0.75) 100%)',
        border: selected ? '1px solid rgba(255,255,255,0.85)' : '1px solid rgba(255,255,255,0.18)',
        boxShadow: selected ? '0 0 8px rgba(168,85,247,0.45)' : 'none',
      }}
      title="Click to edit · drag to move · right-click to delete"
    >
      {/* Top label strip — clip name placeholder for now. Future: clip
          name editable via double-click. */}
      <div
        className="absolute top-0 left-0 right-0 px-1.5 py-0.5 text-[9px] font-mono text-white/85 truncate pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.25)' }}
      >
        MIDI · {clip.notes.length} {clip.notes.length === 1 ? 'note' : 'notes'}
      </div>
      {/* Note preview — one dot per note. Ghost-green dots stand out
          on the violet body. Pitches outside the preview range get
          clamped to the edges so we never draw outside the block. */}
      {clip.notes.map((n) => {
        const xPct = (n.startSec / Math.max(0.05, clip.lengthSec)) * 100;
        const wPct = Math.max(0.5, (n.durationSec / Math.max(0.05, clip.lengthSec)) * 100);
        const clampedPitch = Math.max(PREVIEW_LOW_PITCH, Math.min(PREVIEW_HIGH_PITCH, n.pitch));
        const yPct = ((PREVIEW_HIGH_PITCH - clampedPitch) / previewRange) * 100;
        // Reserve the top 12px for the label strip — preview lives in
        // the rest of the block.
        const previewTop = 12;
        const previewHeight = laneHeight - previewTop - 2;
        return (
          <div
            key={n.id}
            className="absolute pointer-events-none"
            style={{
              left: `${xPct}%`,
              width: `${wPct}%`,
              top: previewTop + (yPct / 100) * previewHeight,
              height: 2,
              minHeight: 2,
              background: '#00FFC8',
              opacity: 0.55 + n.velocity * 0.45,
              borderRadius: 1,
            }}
          />
        );
      })}
      {/* Resize edge — rightmost 6px. Cursor flips to ew-resize on hover
          so the user knows it's a different gesture than dragging the
          body. */}
      <div
        onMouseDown={onResizeDown}
        className="absolute top-0 bottom-0 right-0 cursor-ew-resize"
        style={{ width: 6, background: 'rgba(255,255,255,0.04)' }}
        title="Drag to resize"
      />
    </div>
  );
}

export default memo(MidiClipBlockInner);
