"use client";

import { useState, useCallback } from 'react';
import { usePusherChannel } from './use-pusher-channel';
import type { PusherMember } from '@/lib/pusher/types';

interface UsePresenceChannelOptions {
  channelName: string;
  userData?: any;
  onMemberJoined?: (member: PusherMember) => void;
  onMemberLeft?: (member: PusherMember) => void;
}

export function usePresenceChannel({
  channelName,
  userData,
  onMemberJoined,
  onMemberLeft,
}: UsePresenceChannelOptions) {
  const [members, setMembers] = useState<Map<string, PusherMember>>(new Map());

  const handleSubscriptionSuccess = useCallback((data: any) => {
    setMembers(new Map(Object.entries(data.members || {})));
  }, []);

  const handleMemberAdded = useCallback((member: PusherMember) => {
    setMembers(prev => new Map(prev).set(member.id, member));
    onMemberJoined?.(member);
  }, [onMemberJoined]);

  const handleMemberRemoved = useCallback((member: PusherMember) => {
    setMembers(prev => {
      const updated = new Map(prev);
      updated.delete(member.id);
      return updated;
    });
    onMemberLeft?.(member);
  }, [onMemberLeft]);

  const { isSubscribed, error, channel } = usePusherChannel({
    channelName,
    userData,
    onSubscriptionSucceeded: handleSubscriptionSuccess,
    onMemberAdded: handleMemberAdded,
    onMemberRemoved: handleMemberRemoved,
  });

  return {
    members,
    isSubscribed,
    error,
    channel,
  };
}