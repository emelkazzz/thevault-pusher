import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher/server';
import { RateLimiter } from '@/lib/rate-limiter';
import { Security } from '@/lib/security';
import { logger } from '@/lib/logger';
import type { PresenceChannelData } from 'pusher';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.ip || 'unknown';
    RateLimiter.check(`pusher-auth:${ip}`, 100, 60 * 1000);

    // Parse request body as form data
    const formData = await req.formData();
    const socketId = formData.get('socket_id')?.toString();
    const channelName = formData.get('channel_name')?.toString();
    const userData = formData.get('user_data')?.toString();

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For presence channels
    if (channelName.startsWith('presence-')) {
      if (!userData) {
        return NextResponse.json(
          { error: 'Nickname required for presence channels' },
          { status: 400 }
        );
      }

      const sanitizedNickname = Security.sanitizeInput(userData);

      const presenceData: PresenceChannelData = {
        user_id: socketId,
        user_info: {
          nickname: sanitizedNickname,
          joinedAt: new Date().toISOString(),
        },
      };

      try {
        const authResponse = await pusherServer.authorizeChannel(
          socketId,
          channelName,
          presenceData
        );
        return NextResponse.json(authResponse);
      } catch (error) {
        logger.error('Presence channel authorization failed:', error);
        throw error;
      }
    }

    // For private channels
    if (channelName.startsWith('private-')) {
      const authResponse = await pusherServer.authorizeChannel(
        socketId,
        channelName
      );
      return NextResponse.json(authResponse);
    }

    return NextResponse.json(
      { error: 'Invalid channel type' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Pusher auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}