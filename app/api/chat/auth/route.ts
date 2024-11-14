import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher/server';
import { RateLimiter } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.ip || 'unknown';
    RateLimiter.check(`pusher-auth:${ip}`, 100, 60 * 1000);

    // Parse request body as URLSearchParams
    const body = await req.text();
    const params = new URLSearchParams(body);
    
    const socketId = params.get('socket_id');
    const channelName = params.get('channel_name');
    const userData = params.get('user_data');

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

      const presenceData = {
        user_id: socketId,
        user_info: {
          nickname: userData,
          joinedAt: new Date().toISOString(),
        },
      };

      try {
        const authResponse = pusherServer.authorizeChannel(
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
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
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