import { WrappedNodeRedisClient } from 'handy-redis';
import { COUNT } from '../constants';

async function pub(
  redis: WrappedNodeRedisClient,
  artistName: string,
): Promise<string> {
  try {
    const listenerCount = await redis.hincrby(artistName, COUNT, 1);
    const listenerCountResponse = `c=${listenerCount + 1}`;
    console.log(`pub: ${listenerCountResponse}`);
    return listenerCountResponse;
  } catch (error) {
    console.log('error is', error);
  }
  return 'c=-1';
}

export { pub };
