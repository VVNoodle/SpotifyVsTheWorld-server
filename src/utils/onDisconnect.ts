import {
  Publisher,
  WebSocketContext,
  WebSocketMessageFormat,
} from '@fanoutio/grip';
import { Redis } from 'ioredis';

export const onDisconnect = async (
  redis: Redis,
  pub: Publisher,
  wsContext: WebSocketContext,
): Promise<void> => {
  console.log(`client with id ${wsContext.id} has disconnected`);
  const artistLastListened = await redis.hget('client', wsContext.id);
  const listenerCount = await redis.hincrby('artist', artistLastListened, -1);
  pub.publishFormats(
    artistLastListened,
    new WebSocketMessageFormat(listenerCount.toString()),
  );
};
