// import * as uWS from 'uWebSockets.js';
import {
  // encodeWebSocketEvents,
  Publisher,
  WebSocketContext,
  WebSocketMessageFormat,
} from '@fanoutio/grip';
import { Redis } from 'ioredis';

/**
 * decrement listener count of previous artist and publish the new count
 * increment listener count of current artist and publish the new count
 * @param content message sent from client. Expected to be in the following format: 'previousArtistName,currentArtistName'
 */
export const onText = async (
  // res: uWS.HttpResponse,
  redis: Redis,
  pub: Publisher,
  wsContext: WebSocketContext,
  content: string | Buffer | number[],
): Promise<void> => {
  const contentString = content.toString();
  console.log('content', contentString);
  if (!contentString.includes(',')) {
    console.log('bad content!');
    return;
  }

  try {
    const [previousArtist, currentArtist] = contentString.split(',');

    // set client's latest artist. Useful to update count when client gets disconnected
    await redis.hset('client', wsContext.id, currentArtist);

    // unsub from previousArtist first. THEN publish new value. Order matters
    if (previousArtist && previousArtist.length) {
      console.log(
        `unsubscribing from ${previousArtist}. subscribing to ${currentArtist}`,
      );
      wsContext.unsubscribe(previousArtist);

      const previousListenerCount = await redis.hincrby(
        'artist',
        previousArtist,
        -1,
      );

      try {
        pub.publishFormats(
          previousArtist,
          new WebSocketMessageFormat(previousListenerCount.toString()),
        );
        console.log('Publish successful!', previousListenerCount.toString());
      } catch (ex) {
        if (ex.message) {
          console.log('Publish failed!');
          console.log('Message: ' + ex.message);
          console.log('Context: ');
          console.dir(ex.context);
        } else {
          throw ex;
        }
      }
    } else {
      console.log(`first artist. nothing to unsubscribe`);
    }

    wsContext.subscribe(currentArtist);
    const currentListenerCount = await redis.hincrby(
      'artist',
      currentArtist,
      1,
    );
    console.log('listener count', currentListenerCount.toString());
    try {
      setTimeout(() => {
        pub.publishFormats(
          currentArtist,
          new WebSocketMessageFormat(currentListenerCount.toString()),
        );
      }, 3000);
      console.log('Publish successful!');
    } catch (ex) {
      if (ex.message) {
        console.log('Publish failed!');
        console.log('Message: ' + ex.message);
        console.log('Context: ');
        console.dir(ex.context);
      } else {
        throw ex;
      }
    }
  } catch (error) {
    console.log('error', error);
    console.log(error.message);
  }
};
