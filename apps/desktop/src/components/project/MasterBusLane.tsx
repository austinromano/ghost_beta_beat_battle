import { useState } from 'react';
import { useAudioStore } from '../../stores/audioStore';
import { useEffectsStore, EFFECT_DRAG_MIME, MASTER_BUS_FX_KEY, type EffectKind } from '../../stores/effectsStore';
import { TRACK_HEADER_WIDTH } from './ArrangementComponents';

/**
 * Master FX bus lane — sits above the master output. Clicking it
 * selects the bus in the audio store, which makes SampleEditorPanel
 * render the horizontal FX rack (EQ → Comp → Reverb) instead of the
 * per-clip controls. Visually distinct from regular track lanes
 * (purple accent) so it reads as a routing peer rather than a clip
 * lane.
 */
export default function MasterBusLane({ trackZoom = 'full' }: { trackZoom?: 'full' | 'half' }) {
  const laneHeight = trackZoom === 'half' ? 50 : 72;
  const selectedBusId = useAudioStore((s) => s.selectedBusId);
  const setSelectedBusId = useAudioStore((s) => s.setSelectedBusId);
  const setSelectedTrackIds = useAudioStore((s) => s.setSelectedTrackIds);

  const isSelected = selectedBusId === 'master-bus';

  // Purple-violet hue family — distinguishes the bus from the gold
  // master and the regular per-track colour palette.
  const fill = isSelected ? `hsl(270, 60%, 32%)` : `hsl(270, 45%, 22%)`;
  const accent = `hsl(270, 88%, 65%)`;

  const onClick = () => {
    if (isSelected) {
      setSelectedBusId(null);
    } else {
      // Selecting the bus clears any clip selection so the editor
      // panel cleanly switches between modes.
      setSelectedTrackIds([]);
      setSelectedBusId('master-bus');
    }
  };

  // Effect-drop target — drag any chip from the sidebar's Effects
  // section onto the lane and we append it to the master-bus chain.
  // The chain is spliced between mixerBus and masterGain by
  // audioStore.rebuildMasterBusFx, so effects on this lane process
  // the entire mix.
  const [fxDragOver, setFxDragOver] = useState(false);
  const isEffectDrag = (dt: DataTransfer) => {
    for (const t of Array.from(dt.types)) if (t === EFFECT_DRAG_MIME) return true;
    return false;
  };
  const onFxDragOver = (e: React.DragEvent) => {
    if (!isEffectDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!fxDragOver) setFxDragOver(true);
  };
  const onFxDragLeave = (e: React.DragEvent) => {
    if (!isEffectDrag(e.dataTransfer)) return;
    setFxDragOver(false);
  };
  const onFxDrop = (e: React.DragEvent) => {
    if (!isEffectDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    setFxDragOver(false);
    try {
      const raw = e.dataTransfer.getData(EFFECT_DRAG_MIME);
      const payload = JSON.parse(raw) as { kind: EffectKind };
      if (!payload?.kind) return;
      useEffectsStore.getState().add(MASTER_BUS_FX_KEY, payload.kind);
      // Auto-select the bus so the chain editor panel pops open
      // showing the just-added effect.
      setSelectedTrackIds([]);
      setSelectedBusId('master-bus');
    } catch { /* malformed payload — ignore */ }
  };

  return (
    <div
      className="flex relative"
      style={{ height: laneHeight }}
      onDragOver={onFxDragOver}
      onDragLeave={onFxDragLeave}
      onDrop={onFxDrop}
    >
      <div
        onClick={onClick}
        className="relative shrink-0 select-none flex items-center gap-1.5 px-2 rounded-l-md overflow-hidden cursor-pointer transition-colors"
        style={{
          width: TRACK_HEADER_WIDTH,
          height: '100%',
          background: fill,
          borderRight: `2px solid ${accent}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.25)',
        }}
        title={isSelected ? 'Click to deselect' : 'Click to edit master bus FX, or drag effects here from the sidebar'}
      >
        <span
          className="text-[11px] font-semibold text-white/95 truncate flex-1"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          MASTER BUS
        </span>
        <span
          className="shrink-0 w-1.5 h-1.5 rounded-full"
          style={{ background: accent, boxShadow: `0 0 4px ${accent}` }}
        />
      </div>
      {/* Empty lane area — same background tone as regular lanes so the
          bus row blends into the arrangement. Click this strip to also
          select the bus, mirroring the header click. */}
      <div
        onClick={onClick}
        className="flex-1 relative cursor-pointer"
        style={{
          background: fxDragOver
            ? 'rgba(168,85,247,0.18)'
            : isSelected ? 'rgba(168,85,247,0.07)' : 'rgba(10,4,18,0.4)',
          outline: fxDragOver ? '1.5px dashed rgba(168,134,255,0.7)' : 'none',
          outlineOffset: -2,
        }}
      />
    </div>
  );
}
