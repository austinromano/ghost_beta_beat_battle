import { useAudioStore } from '../../stores/audioStore';
import { TRACK_HEADER_WIDTH } from './ArrangementComponents';

/**
 * Master FX bus lane — Ableton-style return. Per-track `busSend`
 * knobs route a parallel WET signal here; the bus runs its
 * built-in EQ → Comp → Wet/Dry chain (wired in graph.ts) and the
 * processed return sums back into mixerBus.
 *
 * Insert-style FX live on the MASTER lane below this one (drag
 * effects there to process the entire mix). This lane is now
 * pure routing — selectable for future return-chain editing but
 * not a drop target.
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
      setSelectedTrackIds([]);
      setSelectedBusId('master-bus');
    }
  };

  return (
    <div className="flex relative" style={{ height: laneHeight }}>
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
        title={isSelected ? 'Click to deselect' : 'Send / return — turn up the bus-send knob on a track to route signal here'}
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
      <div
        onClick={onClick}
        className="flex-1 relative cursor-pointer"
        style={{ background: isSelected ? 'rgba(168,85,247,0.07)' : 'rgba(10,4,18,0.4)' }}
      />
    </div>
  );
}
