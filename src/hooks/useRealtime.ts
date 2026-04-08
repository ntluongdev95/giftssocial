'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import ngeohash from 'ngeohash';
import { useMapStore } from '@/stores/mapStore';
import { useAuthStore } from '@/stores/auth-store';
import type { Signal, MarkerState } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || '';

interface UseRealtimeReturn {
  connected: boolean;
  lastEvent: string | null;
}

function signalToEntityType(type: string) {
  switch (type) {
    case 'presence': case 'intent': case 'update': return 'people' as const;
    case 'offer': return 'offer' as const;
    case 'event': return 'event' as const;
    case 'proof': return 'proof' as const;
    default: return 'people' as const;
  }
}

export function useRealtime(
  lat: number | null,
  lng: number | null
): UseRealtimeReturn {
  const socketRef = useRef<Socket | null>(null);
  const currentZoneRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  const { accessToken: token } = useAuthStore();
  const { addMarker, removeMarker, setMarkerState } = useMapStore();

  const handleSignalCreated = useCallback(
    (signal: Signal) => {
      setLastEvent('signal.created');
      addMarker({
        id: signal.id,
        entity_type: signalToEntityType(signal.type),
        lat: signal.location.coordinates[1],
        lng: signal.location.coordinates[0],
        title: signal.title,
        state: 'live',
        trust_level: undefined,
      });
    },
    [addMarker]
  );

  const handleSignalExpired = useCallback(
    ({ id }: { id: string }) => {
      setLastEvent('signal.expired');
      removeMarker(id);
    },
    [removeMarker]
  );

  const handleSignalUpdated = useCallback(
    (signal: Signal) => {
      setLastEvent('signal.updated');
      addMarker({
        id: signal.id,
        entity_type: signalToEntityType(signal.type),
        lat: signal.location.coordinates[1],
        lng: signal.location.coordinates[0],
        title: signal.title,
        state: signal.status === 'suppressed' ? 'suppressed' : 'default',
        trust_level: undefined,
      });
    },
    [addMarker]
  );

  const handleAgentExecuting = useCallback(
    ({ agent_id }: { agent_id: string }) => {
      setLastEvent('agent.executing');
      setMarkerState(agent_id, 'executing' as MarkerState);
    },
    [setMarkerState]
  );

  const handleAgentCompleted = useCallback(
    ({ agent_id }: { agent_id: string }) => {
      setLastEvent('agent.completed');
      setMarkerState(agent_id, 'default' as MarkerState);
    },
    [setMarkerState]
  );

  // Connect
  useEffect(() => {
    if (!WS_URL) return;

    const socket = io(WS_URL, {
      auth: { token: token || '' },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      setConnected(true);
      // Re-subscribe to current zone on reconnect
      if (currentZoneRef.current) {
        socket.emit('subscribe', `signals:nearby:${currentZoneRef.current}`);
      }
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('signal.created', handleSignalCreated);
    socket.on('signal.expired', handleSignalExpired);
    socket.on('signal.updated', handleSignalUpdated);
    socket.on('agent.executing', handleAgentExecuting);
    socket.on('agent.completed', handleAgentCompleted);
    socket.on('booking.confirmed', () => setLastEvent('booking.confirmed'));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [
    token,
    handleSignalCreated,
    handleSignalExpired,
    handleSignalUpdated,
    handleAgentExecuting,
    handleAgentCompleted,
  ]);

  // Subscribe to geohash zone
  useEffect(() => {
    if (!socketRef.current || lat === null || lng === null) return;

    const zone = ngeohash.encode(lat, lng, 6);

    if (zone === currentZoneRef.current) return;

    // Unsubscribe old zone
    if (currentZoneRef.current) {
      socketRef.current.emit('unsubscribe', `signals:nearby:${currentZoneRef.current}`);
    }

    // Subscribe new zone
    socketRef.current.emit('subscribe', `signals:nearby:${zone}`);
    currentZoneRef.current = zone;
  }, [lat, lng]);

  return { connected, lastEvent };
}
