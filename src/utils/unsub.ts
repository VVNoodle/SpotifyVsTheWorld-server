import IORedis from 'ioredis';
async function unsub(
  redis: IORedis.Redis,
  artistName: string,
): Promise<string> {
  try {
    const listenerCount = await redis.hincrby(artistName, 'count', -1);
    const listenerCountResponse = `c=${listenerCount}`;
    console.log(`unsub value: ${listenerCountResponse}`);
    return listenerCountResponse;
  } catch (error) {
    console.log('error is', error);
  }
  return 'c=-1';
}

export { unsub };
