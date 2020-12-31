import * as uWS from 'uWebSockets.js';
import { Publisher, WebSocketContext } from '@fanoutio/grip';
import { Redis } from 'ioredis';

const RANDOM_NUMBER = -9;

/**
 * decrement listener count of previous artist and publish the new count
 * increment listener count of current artist and publish the new count
 * @param content message sent from client. Expected to be in the following format: 'previousArtistName,currentArtistName'
 */
export const onText = async (
  res: uWS.HttpResponse,
  redis: Redis,
  pub: Publisher,
  wsContext: WebSocketContext,
  content: string | Buffer | number[],
): Promise<string | void> => {
  console.log(res);
  console.log(pub);
  const contentString = content.toString();
  console.log('content', contentString);
  if (!contentString.includes('||')) {
    console.log('bad content!');
    return;
  }

  try {
    const [previousArtist, currentArtist] = contentString.split('||');

    // set client's latest artist. Useful to update count when client gets disconnected
    await redis.hset('client', wsContext.id, currentArtist);

    // unsub from previousArtist first. THEN publish new value. Order matters
    let previousListenerCount = RANDOM_NUMBER;
    let currentListenerCount = RANDOM_NUMBER;
    wsContext.subscribe(currentArtist);
    if (previousArtist && previousArtist.length) {
      console.log(
        `unsubscribing from ${previousArtist}. subscribing to ${currentArtist}`,
      );
      wsContext.unsubscribe(previousArtist);
      await redis
        .multi()
        .hincrby('artist', currentArtist, 1)
        .hincrby('artist', previousArtist, -1)
        .exec((err, results) => {
          if (err) {
            console.log('error', err);
          }
          previousListenerCount = results[1][1];
        });
    } else {
      console.log(`first artist. nothing to unsubscribe`);
      currentListenerCount = await redis.hincrby('artist', currentArtist, 1);
    }
    wsContext.subscribe(currentArtist);

    // // The above commands made to the wsContext are buffered
    // // in the wsContext as "outgoing events".
    // // Obtain them and write them to the response.
    // const outEvents = wsContext.getOutgoingEvents();
    // const outEventsEncoded = encodeWebSocketEvents(outEvents);
    // res.write(outEventsEncoded);

    console.log(
      `listener count for ${previousArtist}: ${previousListenerCount.toString()}`,
    );
    console.log(
      `listener count for ${currentArtist}: ${currentListenerCount.toString()}`,
    );
    try {
      const items = [
        {
          channel: currentArtist,
          formats: {
            'ws-message': {
              content: currentListenerCount.toString(),
            },
          },
        },
      ];
      if (previousArtist && previousArtist.length) {
        items.push({
          channel: previousArtist,
          formats: {
            'ws-message': {
              content: previousListenerCount.toString(),
            },
          },
        });
      }
      const body = JSON.stringify({
        items,
      });
      return body;

      // const json = await response.json();
      // console.log('json response', json);
      // console.log('Publish successful!');
    } catch (ex) {
      console.log(ex);
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
