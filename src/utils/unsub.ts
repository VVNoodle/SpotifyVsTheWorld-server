import IORedis from 'ioredis';
import fetch from 'node-fetch';
import { COUNT } from '../constants';

async function unsub(
  redis: IORedis.Redis,
  artistName: string,
): Promise<string> {
  try {
    const listenerCount = await redis.hincrby(artistName, COUNT, -1);
    const listenerCountResponse = `c=${listenerCount}`;
    console.log(`unsub value: ${listenerCountResponse}`);
    const response = await fetch(
      `https://${process.env.NCHAN_URL}/broadcast_unsub/${artistName}`,
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
