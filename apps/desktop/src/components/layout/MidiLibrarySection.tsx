import { useEffect, useState } from 'react';
import {
  listMidiLibrary,
  deleteMidiLibraryEntry,
  renameMidiLibraryEntry,
  MIDI_LIBRARY_DRAG_MIME,
  type MidiLibraryEntry,
} from '../../lib/midiLibrary';

// MIDI Library — sits below the Sample Library in the sidebar. Lists
// every clip the user has saved out of the piano roll (via its 💾 →
// "Save to MIDI Library" button). Each row is draggable onto any MIDI
// lane to drop a fresh copy of the clip.

export default function MidiLibrarySection() {
  const [entries, setEntries] = useState<MidiLibraryEntry[]>(() => listMidiLibrary());
  const [open, setOpen] = useState(false);

  // Re-read storage whenever the library changes (save/delete/rename
  // dispatches a `ghost-midi-library-changed` event).
  useEffect(() => {
    const refresh = () => setEntries(listMidiLibrary());
    window.addEventListener('ghost-midi-library-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('ghost-midi-library-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const onDragStart = (entry: MidiLibraryEntry) => (e: React.DragEvent) => {
    e.dataTransfer.setData(MIDI_LIBRARY_DRAG_MIME, JSON.stringify({ id: entry.id }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const confirmDelete = (entry: MidiLibraryEntry) => {
    if (!window.confirm(`Delete "${entry.name}" from your MIDI library?`)) return;
    deleteMidiLibraryEntry(entry.id);
  };

  const renamePrompt = (entry: MidiLibraryEntry) => {
    const next = window.prompt('Rename MIDI clip', entry.name);
    if (!next || !next.trim()) return;
    renameMidiLibraryEntry(entry.id, next.trim());
  };

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="group w-full flex items-center gap-2 px-3 pt-4 pb-2 cursor-grab active:cursor-grabbing select-none"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 shrink-0">
          <rect x="2" y="6" width="20" height="12" rx="1" />
          <line x1="6" y1="6" x2="6" y2="14" />
          <line x1="10" y1="6" x2="10" y2="14" />
          <line x1="14" y1="6" x2="14" y2="14" />
          <line x1="18" y1="6" x2="18" y2="14" />
        </svg>
        <span className="text-[14px] font-bold text-white tracking-tight">MIDI Library</span>
        <span className="ml-auto text-[11px] font-semibold text-white/30 tabular-nums">{entries.length}</span>
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-1">
          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed border-white/10 px-2 py-3 text-[11px] text-white/40 text-center">
              Save a clip from the piano roll to fill this library.
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                draggable
                onDragStart={onDragStart(entry)}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-white/[0.05] transition-colors"
                title={`Drag onto any MIDI lane to drop a copy · ${entry.notes.length} notes · ${entry.lengthBars.toFixed(2)} bars`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <rect x="2" y="6" width="20" height="12" rx="1" />
                  <line x1="6" y1="6" x2="6" y2="14" />
                  <line x1="10" y1="6" x2="10" y2="14" />
                  <line x1="14" y1="6" x2="14" y2="14" />
                  <line x1="18" y1="6" x2="18" y2="14" />
                </svg>
                <span className="text-[12px] text-white/85 truncate flex-1">{entry.name}</span>
                <span className="text-[9.5px] font-mono text-white/30 tabular-nums shrink-0">
                  {entry.notes.length}n · {entry.lengthBars.toFixed(1)}b
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); renamePrompt(entry); }}
                  className="opacity-0 group-hover:opacity-100 px-1 rounded text-white/45 hover:text-white hover:bg-white/[0.08] transition"
                  title="Rename"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); confirmDelete(entry); }}
                  className="opacity-0 group-hover:opacity-100 px-1 rounded text-white/45 hover:text-red-300 hover:bg-red-500/15 transition"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
