import { getCtx, getMaster } from './graph';
import { useEffectsStore, type EqParams, type CompParams, type ReverbParams } from '../effectsStore';
import { buildTrackEqChain, removeTrackEq } from './trackEq';
import { buildTrackCompChain, removeTrackComp } from './trackComp';
import { buildTrackReverbChain, removeTrackReverb } from './trackReverb';

// Per-MIDI-track FX bus.
//
// Each MIDI track owns ONE persistent GainNode that every note routes
// through. When the effects chain on that track mutates we rebuild the
// FX graph between the bus and the master. The note-side scheduler
// only ever connects to `getMidiTrackBus(trackId)` so it doesn't have
// to know about effects at all.
//
// Why reuse the existing per-clip builders (trackEq / trackComp /
// trackReverb)?
//   - They already handle bypass, smooth-ramp param updates, IR
//     synthesis, M/S reverb width, etc. — hundreds of lines of DSP
//     wiring per kind. Reusing them means the MIDI editor panel's
//     setLaneEq / setLaneComp / setLaneReverb calls work for free
//     because they look up registry entries by laneKey.
//   - Convention: trackId in the registries is `midi:${trackId}:${fxId}`
//     so MIDI entries don't collide with audio-clip entries; laneKey
//     is the MIDI project-track id so EffectChainEditor's lane-wide
//     param updates reach the MIDI chain.
//
// Lifecycle:
//   - getMidiTrackBus creates the bus on first access. It also calls
//     rebuildMidiTrackFx so the chain is wired before any note plays.
//   - effectsStore fires `ghost-fx-rewire` on add/remove. We listen
//     here and rebuild every known MIDI track bus's chain.
//   - cleanupMidiFx tears everything down on full audio-graph cleanup
//     (project switch, etc.).

const trackBuses = new Map<string, GainNode>();
// Track which (midi trackId, fx id) tuples are currently registered
// in the per-kind registries so we can dispose them cleanly on rebuild.
const activeChainEntries = new Map<string, string[]>();

function fxRegistryKey(trackId: string, fxId: string): string {
  return `midi:${trackId}:${fxId}`;
}

/**
 * Get (or create) the persistent FX bus for a MIDI track. The MIDI
 * scheduler routes every per-note gain into this node. Idempotent —
 * repeated calls return the same node.
 */
export function getMidiTrackBus(trackId: string): GainNode {
  let bus = trackBuses.get(trackId);
  if (bus) return bus;
  const ctx = getCtx();
  bus = ctx.createGain();
  bus.gain.value = 1;
  trackBuses.set(trackId, bus);
  // Wire the chain (or a direct bus → master edge if the track has
  // no effects yet) so the bus is immediately usable.
  rebuildMidiTrackFx(trackId);
  return bus;
}

/**
 * Rebuild the effect chain between a MIDI track's bus and master.
 * Disposes any prior chain registered to this track and walks the
 * effectsStore chain in order: eq → comp → reverb (only the kinds
 * actually present, in the order the user has them).
 */
export function rebuildMidiTrackFx(trackId: string): void {
  const bus = trackBuses.get(trackId);
  if (!bus) return;
  const ctx = getCtx();

  // Tear down the previous chain. disconnect() drops every outbound
  // edge from the bus, then we remove every registry entry we made
  // on the prior pass.
  try { bus.disconnect(); } catch { /* ignore */ }
  const priorIds = activeChainEntries.get(trackId) ?? [];
  for (const fxId of priorIds) {
    const k = fxRegistryKey(trackId, fxId);
    removeTrackEq(k);
    removeTrackComp(k);
    removeTrackReverb(k);
  }

  const chain = useEffectsStore.getState().getChain(trackId);
  const newIds: string[] = [];

  // Walk the chain. Each kind's builder returns { input, output };
  // we string them together by connecting the previous head to the
  // next input. The bus is the head we start with.
  let head: AudioNode = bus;
  for (const fx of chain) {
    const regKey = fxRegistryKey(trackId, fx.id);
    let segment: { input: AudioNode; output: AudioNode } | null = null;
    if (fx.kind === 'eq') {
      const params = (fx.params as EqParams | undefined);
      segment = buildTrackEqChain(ctx, regKey, trackId, params?.bands ?? [], fx.bypassed);
    } else if (fx.kind === 'comp') {
      const params = (fx.params as CompParams | undefined) ?? { threshold: -18, ratio: 4, attack: 10, release: 100, makeup: 2 };
      segment = buildTrackCompChain(ctx, regKey, trackId, params, fx.bypassed);
    } else if (fx.kind === 'reverb') {
      const params = (fx.params as ReverbParams | undefined) ?? { size: 0.6, decay: 0.4, mix: 0.6, time: 2.5, damping: 0.4, width: 0.35 };
      segment = buildTrackReverbChain(ctx, regKey, trackId, params, fx.bypassed);
    }
    if (!segment) continue;
    head.connect(segment.input);
    head = segment.output;
    newIds.push(fx.id);
  }
  activeChainEntries.set(trackId, newIds);

  // Final hop into the master mixer. If the chain was empty, head
  // is still the bus and this is just a direct edge — same shape as
  // the no-effects baseline.
  head.connect(getMaster());
}

/**
 * Cleanup hook for project switch / full audio-graph teardown.
 * Drops every bus + every registered chain entry so the next session
 * doesn't carry stale nodes.
 */
export function cleanupMidiFx(): void {
  trackBuses.forEach((bus, trackId) => {
    try { bus.disconnect(); } catch { /* ignore */ }
    const ids = activeChainEntries.get(trackId) ?? [];
    for (const fxId of ids) {
      const k = fxRegistryKey(trackId, fxId);
      removeTrackEq(k);
      removeTrackComp(k);
      removeTrackReverb(k);
    }
  });
  trackBuses.clear();
  activeChainEntries.clear();
}

// effectsStore fires ghost-fx-rewire on every add/remove. We listen
// once at module load and rebuild every MIDI track's FX whenever it
// fires — cheap because rebuild only touches tracks that already have
// a bus, and the operation is at most "drop + rewire ≤ 3 nodes."
if (typeof window !== 'undefined') {
  window.addEventListener('ghost-fx-rewire', () => {
    trackBuses.forEach((_bus, trackId) => {
      try { rebuildMidiTrackFx(trackId); } catch { /* ignore */ }
    });
  });
}
