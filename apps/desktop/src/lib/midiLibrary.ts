// MIDI Library — local-only catalogue of MIDI clip presets the user
// has saved out of the piano roll. Stored in localStorage as JSON,
// keyed by user (so multiple Ghost accounts on the same browser
// don't see each other's clips). Note timings are stored in bar-
// relative units so drops into a different-BPM project still hit
// the right beat positions without a BPM conversion at load time.

export const MIDI_LIBRARY_DRAG_MIME = 'application/x-ghost-midi-library';
const STORAGE_KEY = 'ghost_midi_library_v1';

export interface MidiLibraryNote {
  pitch: number;        // MIDI pitch 0-127
  startBars: number;    // bars from clip start
  durationBars: number; // bar fractions
  velocity: number;     // 0..1
}

export interface MidiLibraryEntry {
  id: string;
  name: string;
  notes: MidiLibraryNote[];
  lengthBars: number;
  createdAt: number;
}

function read(): MidiLibraryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as MidiLibraryEntry[] : [];
  } catch {
    return [];
  }
}

function write(entries: MidiLibraryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghost-midi-library-changed'));
    }
  } catch { /* quota / serialization — ignore */ }
}

export function listMidiLibrary(): MidiLibraryEntry[] {
  // Sort newest first so the most recent saves are easy to find.
  return read().slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveMidiLibraryEntry(entry: Omit<MidiLibraryEntry, 'id' | 'createdAt'>): MidiLibraryEntry {
  const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `midi-${Date.now()}`;
  const full: MidiLibraryEntry = { ...entry, id, createdAt: Date.now() };
  const all = read();
  all.push(full);
  write(all);
  return full;
}

export function renameMidiLibraryEntry(id: string, name: string): void {
  const all = read();
  const idx = all.findIndex((e) => e.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], name };
  write(all);
}

export function deleteMidiLibraryEntry(id: string): void {
  const all = read();
  write(all.filter((e) => e.id !== id));
}

export function getMidiLibraryEntry(id: string): MidiLibraryEntry | null {
  return read().find((e) => e.id === id) ?? null;
}
