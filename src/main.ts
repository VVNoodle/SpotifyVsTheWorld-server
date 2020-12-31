import * as uWS from 'uWebSockets.js';
import * as IORedis from 'ioredis';
import { Request } from 'express';
import { IRequestGrip, ServeGrip } from '@fanoutio/serve-grip';
import {
  decodeWebSocketEvents,
  encodeWebSocketEvents,
  WebSocketContext,
} from '@fanoutio/grip';
import { Queue, QueueScheduler, Worker } from 'bullmq';
import { readData } from './utils/readData';
import { onDisconnect } from './utils/onDisconnect';
import { onText } from './utils/onText';
import * as path from 'path';

const redis = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
});
const serveGrip = new ServeGrip({
  grip: {
    control_uri: 'http://127.0.0.1:5561',
    key: 'changeme',
  },
});

const jobName = 'publisherJob';
const publishQueue = new Queue(jobName, {
  connection: redis,
});
const processorFile = path.join(__dirname, 'workers', 'publishMessages.ts');
new Worker(jobName, processorFile, {
  limiter: {
    max: 10,
    duration: 1000,
  },
});
new QueueScheduler(jobName);

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
  .get('/', async (res) => {
    res.end('server still running');
  })
  .get('/healthcheck', async (res) => {
    res.end('healthcheck: server still running');
  })
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

    const body: (string | void)[] = [];
    for (let i = 0; i < wsContext.inEvents.length; i++) {
      const { type, content } = wsContext.inEvents[i];

      console.log('type', type);
      if (type === 'OPEN') {
        console.log(`client with id ${wsContext.id} has connected`);
      } else if (type === 'DISCONNECT') {
        await onDisconnect(redis, pub, wsContext);
      } else if (type === 'TEXT' && content) {
        body.push(await onText(res, redis, pub, wsContext, content));
      } else if (type === 'CLOSE') {
        console.log('client disconnects on purpose');
        await onDisconnect(redis, pub, wsContext);
      }
    }

    res.cork(async () => {
      res = writeHeaders(res, wsContext);
      res
        .writeStatus('200 OK')
        .end(encodeWebSocketEvents(wsContext.getOutgoingEvents()));

      if (!body) {
        return;
      }
      const addAsyncJobs = body.map(async (stuff) => {
        if (typeof stuff === 'string' && stuff.length) {
          await publishQueue.add(stuff, stuff, {
            delay: 5000,
          });
        }
      });
      await Promise.all(addAsyncJobs);
    });
  })
  .listen(parseInt(process.env.PORT), (listenSocket) => {
    if (listenSocket) {
      console.log(`Listening to port ${process.env.PORT}`);
    }
  });

function writeHeaders(res: uWS.HttpResponse, wsContext: WebSocketContext) {
  const headers = wsContext.toHeaders();
  console.log(headers);
  Object.keys(headers).forEach((key) => {
    res.writeHeader(key, headers[key]);
  });
  return res;
}
