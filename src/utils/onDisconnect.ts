import {
  Publisher,
  WebSocketContext,
  WebSocketMessageFormat,
} from '@fanoutio/grip';
import { Redis } from 'ioredis';

/**
 * if client is listening to a track
 * decrement the artist listener count, unsubscribe client, and
 * delete client entry from client hash
 * Finally, publish the updated listener count
 * @param redis the redis connection instance
 * @param pub the publisher helper util
 * @param wsContext wsContext helper util
 */
export const onDisconnect = async (
  redis: Redis,
  pub: Publisher,
  wsContext: WebSocketContext,
): Promise<void> => {
  console.log(`client with id ${wsContext.id} has disconnected`);
  const artistLastListened = await redis.hget('client', wsContext.id);

  if (!artistLastListened) {
    console.log('client is not listening to anything');
    return;
  }

  const listenerCount = await redis.hincrby('artist', artistLastListened, -1);

  wsContext.unsubscribe(artistLastListened);
  await redis.hdel('client', wsContext.id);

  pub.publishFormats(
    artistLastListened,
    new WebSocketMessageFormat(listenerCount.toString()),
  );
};
