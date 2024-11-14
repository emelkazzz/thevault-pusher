"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { pusherClient } from '@/lib/pusher/client';
import { PUSHER_CONFIG } from '@/lib/pusher/config';
import { debounce } from '@/lib/utils/debounce';
import type { PusherChannel } from '@/lib/pusher/types';

const TYPING_TIMEOUT = 2000;

export function useTypingIndicator(nickname: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const channelRef = useRef<PusherChannel | null>(null);
  const mounted = useRef(true);

  const clearTypingTimeout = useCallback((user: string) => {
    const timeout = timeoutsRef.current.get(user);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(user);
    }
  }, []);

  const handleTyping = useCallback((data: { user: string }) => {
    if (!mounted.current || data.user === nickname) return;

    setTypingUsers(prev => {
      const next = new Set(prev);
      next.add(data.user);
      return next;
    });
    
    clearTypingTimeout(data.user);
    
    const timeout = setTimeout(() => {
      if (!mounted.current) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(data.user);
        return next;
      });
      timeoutsRef.current.delete(data.user);
    }, TYPING_TIMEOUT);
    
    timeoutsRef.current.set(data.user, timeout);
  }, [nickname, clearTypingTimeout]);

  const sendTypingNotification = useCallback(
    debounce(async () => {
      try {
        // Send typing notification via API instead of client events
        await fetch('/api/chat/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname }),
        });
      } catch (error) {
        console.error('Failed to send typing notification:', error);
      }
    }, 500),
    [nickname]
  );

  useEffect(() => {
    mounted.current = true;

    const subscribeToChannel = async () => {
      try {
        // Configure auth params
        (pusherClient as any).config.auth = {
          params: { user_data: nickname },
        };

        // Subscribe to Pusher channel
        channelRef.current = pusherClient.subscribe(PUSHER_CONFIG.CHANNELS.CHAT) as PusherChannel;
        channelRef.current.bind(PUSHER_CONFIG.EVENTS.CHAT.TYPING, handleTyping);
      } catch (error) {
        console.error('Failed to subscribe to channel:', error);
      }
    };

    if (nickname) {
      subscribeToChannel();
    }

    return () => {
      mounted.current = false;
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current.clear();

      if (channelRef.current) {
        channelRef.current.unbind(PUSHER_CONFIG.EVENTS.CHAT.TYPING);
        pusherClient.unsubscribe(PUSHER_CONFIG.CHANNELS.CHAT);
        channelRef.current = null;
      }
    };
  }, [handleTyping, nickname]);

  return {
    typingUsers,
    sendTyping: sendTypingNotification,
  };
}