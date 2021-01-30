import { FastifyRequest } from 'fastify';
import { RouteGenericInterface } from 'fastify/types/route';
import { WrappedNodeRedisClient } from 'handy-redis';
import { Server, IncomingMessage } from 'http';
import { ARTIST_COUNT_HASH } from '../constants';

export async function pub(
  request: FastifyRequest<RouteGenericInterface, Server, IncomingMessage>,
  redis: WrappedNodeRedisClient,
): Promise<string> {
  try {
    const artistName = request.headers['x-channel-id'] as string;
    console.log(`client published.incrementing count ${artistName}`);
    const listenerCount = await redis.hincrby(ARTIST_COUNT_HASH, artistName, 1);
    await redis['RG.TRIGGER']('addListener', artistName, listenerCount);
    const listenerCountResponse = `c=${listenerCount}`;
    console.log(`pub: ${listenerCountResponse}`);
    return listenerCountResponse;
  } catch (error) {
    console.log('error is', error);
  }
  return 'c=-1';
}
