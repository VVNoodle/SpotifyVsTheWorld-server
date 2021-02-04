import { FastifyRequest } from 'fastify';
import { RouteGenericInterface } from 'fastify/types/route';
import { WrappedNodeRedisClient } from 'handy-redis';
import { Server, IncomingMessage } from 'http';

export async function pub(
  request: FastifyRequest<RouteGenericInterface, Server, IncomingMessage>,
  redis: WrappedNodeRedisClient,
): Promise<string> {
  try {
    let artistName = request.headers['x-channel-id'] as string;
    artistName = decodeURI(artistName);
    const trackId = request.query['trackid'] as string;
    let listenerCount = await redis.zincrby(
      'leaderboard_realtime',
      1,
      artistName,
    );
    listenerCount = listenerCount.split('\r\n')[1];
    await redis['RG.TRIGGER'](
      'addListener',
      artistName,
      listenerCount,
      trackId,
    );
    const listenerCountResponse = `c=${listenerCount}`;
    console.log(`pub: ${listenerCountResponse}`);
    return listenerCountResponse;
  } catch (error) {
    console.log('error is', error);
  }
  return 'c=-1';
}
