import { useCallback, useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

// Live state for a single Beat Battle lobby. Mounts → join via socket;
// unmounts → leave. Subscribes to `battle:state` and re-renders the
// caller (BeatBattlePage) with the latest participant + status data.

export interface BattleParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  ready: boolean;
  joinedAt: string;
}

export interface BattleState {
  battleId: string;
  name: string;
  status: 'waiting' | 'starting' | 'active' | 'voting' | 'complete';
  kit: string;
  timeLimit: number;
  prizePool: number;
  maxPlayers: number;
  participants: BattleParticipant[];
}

export function useBeatBattle(battleId: string | null) {
  const [state, setState] = useState<BattleState | null>(null);

  useEffect(() => {
    if (!battleId) return;
    const socket = getSocket();
    if (!socket) return;

    const onState = (payload: BattleState) => {
      if (payload.battleId !== battleId) return;
      setState(payload);
    };

    socket.on('battle:state', onState);
    socket.emit('battle:join', { battleId });

    return () => {
      socket.off('battle:state', onState);
      try { socket.emit('battle:leave', { battleId }); } catch { /* socket closed */ }
    };
  }, [battleId]);

  const setReady = useCallback((ready: boolean) => {
    if (!battleId) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('battle:ready', { battleId, ready });
  }, [battleId]);

  return { state, setReady };
}
