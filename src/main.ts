import * as uWS from 'uWebSockets.js';
import * as Redis from 'ioredis';
import { Request } from 'express';
import { IRequestGrip, ServeGrip } from '@fanoutio/serve-grip';
import {
  decodeWebSocketEvents,
  encodeWebSocketEvents,
  parseGripUri,
  WebSocketContext,
} from '@fanoutio/grip';
import { readData } from './utils/readData';
import { onDisconnect } from './utils/onDisconnect';
import { onText } from './utils/onText';

const redis = new Redis({
  password: process.env.REDIS_PASSWORD,
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  username: 'default',
});
const config = parseGripUri(process.env.GRIP_URL);
const serveGrip = new ServeGrip({
  grip: config,
});

interface CustomRequest extends uWS.HttpRequest, Request {
  grip: IRequestGrip;
}

const onAbortedOrFinishedResponse = (res: uWS.HttpResponse) => {
  if (res.id == -1) {
    console.log(
      'ERROR! onAbortedOrFinishedResponse called twice for the same res!',
    );
  } else {
    console.log('Stream was closed');
    console.timeEnd(res.id);
  }

  /* Mark this response already accounted for */
  res.id = -1;
};

uWS
  .App()
  .post('/api/websocket', async (res, req: CustomRequest) => {
    req.headers = {};
    req.forEach((header, value) => {
      req.headers[header] = value;
    });
    req.method = 'POST';

    res.onAborted(() => {
      onAbortedOrFinishedResponse(res);
    });

    let data: string;
    try {
      data = await readData(res);
    } catch (error) {
      console.log('error!', error);
      res.end();
    }
    req.body = data;

    // // Validate the Grip-Sig header:
    // if (!validateSig(req.headers['grip-sig'], process.env.REALM_KEY)) {
    //   res.writeHead(401);
    //   res.end('invalid grip-sig token');
    //   return;
    // }

    // Make sure we have a connection ID
    let cid = req.headers['connection-id'];
    if (Array.isArray(cid)) {
      cid = cid[0];
    }
    if (req.headers['connection-id'] == null) {
      res.writeHead(401);
      res.end('connection-id required');
      return;
    }

    const inEvents = decodeWebSocketEvents(data);
    const wsContext = new WebSocketContext(cid, {}, inEvents);

    // If this is a new connection, accept it
    if (wsContext.isOpening()) {
      try {
        wsContext.accept();
      } catch (error) {
        console.log('error', error);
        console.log(error.message);
      }
    }

    const pub = serveGrip.getPublisher();

    for (let i = 0; i < wsContext.inEvents.length; i++) {
      const { type, content } = wsContext.inEvents[i];

      console.log('type', type);
      if (type === 'OPEN') {
        console.log(`client with id ${wsContext.id} has connected`);
      } else if (type === 'DISCONNECT') {
        await onDisconnect(redis, pub, wsContext);
      } else if (type === 'TEXT') {
        if (content) {
          await onText(res, redis, pub, wsContext, content);
        }
      }
    }

    function writeHeaders(res: uWS.HttpResponse) {
      const headers = wsContext.toHeaders();
      console.log(headers);
      Object.keys(headers).forEach((key) => {
        res.writeHeader(key, headers[key]);
      });
      return res;
    }
    res = writeHeaders(res);
    res
      .writeStatus('200 OK')
      .end(encodeWebSocketEvents(wsContext.getOutgoingEvents()));
  })
  .listen(parseInt(process.env.PORT), (listenSocket) => {
    if (listenSocket) {
      console.log(`Listening to port ${process.env.PORT}`);
    }
  });
