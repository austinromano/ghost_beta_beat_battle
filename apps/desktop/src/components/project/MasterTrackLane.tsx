import { useEffect, useRef, useState } from 'react';
import { getAnalyser } from '../../stores/audio/graph';
import { useAudioStore } from '../../stores/audioStore';
import { useEffectsStore, EFFECT_DRAG_MIME, MASTER_FX_KEY, type EffectKind } from '../../stores/effectsStore';
import { TRACK_HEADER_WIDTH } from './ArrangementComponents';

/**
 * Master track lane — the final output. Click the lane (or drag an
 * effect chip onto it) to manage its insert chain; effects added
 * here are spliced between `mixerBus` and `masterGain`, so the
 * entire mix (every track + drum row + return-bus output) routes
 * through them before the master fader.
 */
export default function MasterTrackLane({ trackZoom = 'full' }: { trackZoom?: 'full' | 'half' }) {
  const laneHeight = trackZoom === 'half' ? 50 : 72;

  // Gold hue family. Same hsl() construction as TrackHeader so the master
  // reads as a lane peer instead of a foreign banner.
  const fill = `hsl(50, 45%, 24%)`;
  const accent = `hsl(50, 88%, 60%)`;

  const selectedBusId = useAudioStore((s) => s.selectedBusId);
  const setSelectedBusId = useAudioStore((s) => s.setSelectedBusId);
  const setSelectedTrackIds = useAudioStore((s) => s.setSelectedTrackIds);
  const isSelected = selectedBusId === 'master';

  const onClick = () => {
    if (isSelected) {
      setSelectedBusId(null);
    } else {
      setSelectedTrackIds([]);
      setSelectedBusId('master');
    }
  };

  // Effect-drop target — drag any chip from the sidebar's Effects
  // section onto the lane and we append it to the master chain.
  // The chain is spliced between mixerBus and masterGain by
  // audioStore.rebuildMasterFx, so effects here process the mix.
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
      useEffectsStore.getState().add(MASTER_FX_KEY, payload.kind);
      // Auto-select master so the chain editor pops open with the
      // just-added effect already visible.
      setSelectedTrackIds([]);
      setSelectedBusId('master');
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
          background: isSelected ? `hsl(50, 60%, 32%)` : fill,
          borderRight: `2px solid ${accent}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.25)',
        }}
        title={isSelected ? 'Click to deselect' : 'Click to edit master FX, or drag effects here from the sidebar'}
      >
        <span
          className="text-[11px] font-semibold text-white/95 truncate flex-1"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          MASTER
        </span>
        <span
          className="shrink-0 w-1.5 h-1.5 rounded-full"
          style={{ background: accent, boxShadow: `0 0 4px ${accent}` }}
        />
        <MasterLevelMeter />
      </div>
      {/* Empty lane area — clickable + drag-target so effect drops
          land anywhere on the lane, not just the header. */}
      <div
        onClick={onClick}
        className="flex-1 relative cursor-pointer"
        style={{
          background: fxDragOver
            ? 'rgba(255, 215, 0, 0.18)'
            : isSelected ? 'rgba(255, 215, 0, 0.07)' : 'rgba(10,4,18,0.4)',
          outline: fxDragOver ? '1.5px dashed rgba(255, 215, 0, 0.7)' : 'none',
          outlineOffset: -2,
        }}
      />
    </div>
  );
}

/**
 * Same shape as `LaneLevelMeter` (a 4 px vertical VU strip inline in the
 * lane header), but reads off the master analyser so the bar reflects
 * the post-master output level — the sum of every track + drum hit
 * routed through getMaster().
 */
function MasterLevelMeter() {
  const fillRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const analyser = getAnalyser();
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    let lastDisplayed = 0;

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const abs = buf[i] < 0 ? -buf[i] : buf[i];
        if (abs > peak) peak = abs;
      }
      // Mild attack / release so the meter tracks audio without
      // flickering on every frame — same constants LaneLevelMeter uses.
      const next = peak > lastDisplayed ? peak : lastDisplayed * 0.85 + peak * 0.15;
      lastDisplayed = next;
      const el = fillRef.current;
      if (el) el.style.height = `${Math.min(100, next * 100)}%`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      className="relative shrink-0 rounded-sm overflow-hidden"
      style={{
        width: 4,
        height: '70%',
        background: 'rgba(0,0,0,0.45)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      <div
        ref={fillRef}
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '0%',
          // Classic VU gradient — green safe → amber → red near clipping.
          background: 'linear-gradient(180deg, #ff4d4d 0%, #ffd24d 25%, #4dff8c 60%, #2bd16f 100%)',
          transition: 'height 0.05s linear',
        }}
      />
    </div>
  );
}
