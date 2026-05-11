import { useEffect, useState } from 'react';

// Per-battle "I already submitted" flag. Persists across mounts so
// the Submit Beat button stays hidden after the user has locked in
// their bounce, even if they navigate away and back to the project.
// Server-side participant.submitted is the source of truth for the
// lobby badge — this hook is just a client-side mirror so the
// project chrome can react without needing useBeatBattle context.

const EVENT = 'ghost-battle-submitted-changed';

function keyFor(battleId: string | null | undefined): string | null {
  if (!battleId) return null;
  return `beat-battle-submitted::${battleId}`;
}

function read(battleId: string | null | undefined): boolean {
  const key = keyFor(battleId);
  if (!key) return false;
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

export function clearBattleSubmitted(battleId: string | null | undefined): void {
  const key = keyFor(battleId);
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* quota */ }
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* SSR */ }
}

export function useBeatBattleSubmitted(battleId: string | null | undefined): boolean {
  const [submitted, setSubmitted] = useState<boolean>(() => read(battleId));
  useEffect(() => {
    setSubmitted(read(battleId));
    const refresh = () => setSubmitted(read(battleId));
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [battleId]);
  return submitted;
}
