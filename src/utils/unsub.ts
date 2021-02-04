import { WrappedNodeRedisClient } from 'handy-redis';
import fetch from 'node-fetch';
import { LEADERBOARD_REALTIME } from '../constants';

async function unsub(
  redis: WrappedNodeRedisClient,
  artistName: string,
): Promise<string> {
  try {
    const listenerCountBulkString = await redis.zincrby(
      'leaderboard_realtime',
      -1,
      artistName,
    );
    const listenerCount = parseInt(listenerCountBulkString.split('\r\n')[1]);
    await redis.zadd(LEADERBOARD_REALTIME, [listenerCount, artistName]);
    const listenerCountResponse = `c=${listenerCount}`;
    console.log(`unsub value: ${listenerCountResponse}`);
    const response = await fetch(
      `https://${process.env.NCHAN_URL}/pubraw?chanid=${artistName}`,
      {
        method: 'POST',
        body: listenerCountResponse,
      },
    );
    await response.text();

    return listenerCountResponse;
  } catch (error) {
    console.log('error is', error);
  }
  return 'c=-1';
}

export { unsub };
