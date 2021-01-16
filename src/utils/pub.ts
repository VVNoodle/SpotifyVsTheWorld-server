import IORedis from 'ioredis';
import { ARTIST_COUNT_HASH } from '../constants';

async function pub(redis: IORedis.Redis, artistName: string): Promise<string> {
  try {
    const listenerCount = await redis.hincrby(ARTIST_COUNT_HASH, artistName, 1);
    const listenerCountResponse = `c=${
      listenerCount === 0 ? 1 : listenerCount
    }`;
    console.log(`pub: ${listenerCountResponse}`);
    return listenerCountResponse;
  } catch (error) {
    console.log('error is', error);
  }
  return 'c=-1';
}

export { pub };
