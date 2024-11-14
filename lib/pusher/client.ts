"use client";

import PusherClient from 'pusher-js';
import { PUSHER_CONFIG } from './config';
import { logger } from '../logger';
import type { PusherChannel, PusherClientConfig } from './types';

// Ensure environment variables are defined
if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
  throw new Error('NEXT_PUBLIC_PUSHER_KEY is not configured');
}

if (!process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
  throw new Error('NEXT_PUBLIC_PUSHER_CLUSTER is not configured');
}

// Type-safe environment variables
const PUSHER_KEY: string = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_CLUSTER: string = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

class PusherClientManager {
  private static instance: PusherClient;

  static getInstance(): PusherClient {
    if (!this.instance) {
      this.instance = this.createInstance();
    }
    return this.instance;
  }

  private static createInstance(): PusherClient {
    PusherClient.logToConsole = process.env.NODE_ENV === 'development';

    const config: PusherClientConfig = {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      authEndpoint: PUSHER_CONFIG.AUTH.ENDPOINT,
      auth: {
        headers: {
          'Content-Type': PUSHER_CONFIG.AUTH.CONTENT_TYPE,
        },
        params: {},
      },
      enableStats: false,
      activityTimeout: PUSHER_CONFIG.DEFAULTS.ACTIVITY_TIMEOUT,
      pongTimeout: PUSHER_CONFIG.DEFAULTS.PONG_TIMEOUT,
      wsHost: undefined,
      wsPort: undefined,
      wssPort: undefined,
      disableStats: true,
      enabledTransports: ['ws', 'wss'],
    };

    return new PusherClient(PUSHER_KEY, config);
  }

  static async reconnect(): Promise<void> {
    try {
      if (this.instance) {
        this.instance.disconnect();
      }
      this.instance = this.createInstance();
      await this.instance.connect();
    } catch (error) {
      logger.error('Reconnection failed:', error);
      throw error;
    }
  }

  static disconnect(): void {
    if (this.instance) {
      this.instance.disconnect();
      this.instance = null!;
    }
  }

  static getConnectionState(): string {
    return this.instance?.connection.state || 'disconnected';
  }

  static isConnected(): boolean {
    return this.instance?.connection.state === PUSHER_CONFIG.EVENTS.CONNECTION.CONNECTED;
  }
}

export const {
  getInstance: getPusherClient,
  reconnect: reconnectPusher,
  disconnect: disconnectPusher,
  getConnectionState,
  isConnected,
} = PusherClientManager;

export const pusherClient = PusherClientManager.getInstance();