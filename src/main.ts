import { Server, IncomingMessage, ServerResponse } from 'http';
import fastifyInit, { FastifyReply, FastifyRequest } from 'fastify';
import fastifyRateLimit from 'fastify-rate-limit';
import fastifyCors from 'fastify-cors';
import fastifySchedulePlugin from 'fastify-schedule';
import { RouteGenericInterface } from 'fastify/types/route';
import { SimpleIntervalJob } from 'toad-scheduler';
import { pub } from './routes/pub';
import { unsub } from './utils/unsub';
import { getRedis } from './utils/redis';
import {
  realtimeLeaderboardUpdate,
  realtimeLeaderboardUpdateJob,
} from './utils/realtimeLeaderboardUpdate';
import { getWs } from './utils/getWs';
import WebSocket from 'ws';

const config: { [key: string]: string | boolean } = {
  logger: false,
};
if (process.env.LOGGER === 'yes') {
  config.logger = true;
}
if (process.env.HTTP2 === 'yes') {
  config.http2 = true;
}

let leaderboardLastHourPages: number;
let leaderboardAlltimePages: number;

// init redis
const redis = getRedis();

const fastify = fastifyInit(config);

fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

fastify.register(fastifyCors, {
  // put your options here
  // origin: '*',
  origin: [
    'https://www.spotifyvstheworld.com',
    'https://spotifyvstheworld.com',
    'https://app.spotifyvstheworld.com',
    'http://app.spotifyvstheworld.com',
    'https://www.app.spotifyvstheworld.com',
    'https://www.nchan.spotifyvstheworld.com',
    'https://nchan.spotifyvstheworld.com',
  ],
});

fastify.register(fastifySchedulePlugin);

let ws: WebSocket = getWs();

ws.onopen = async () => {
  console.log('opened websocket connection');
  await realtimeLeaderboardUpdate();
  const job = new SimpleIntervalJob(
    { seconds: 20 },
    realtimeLeaderboardUpdateJob,
  );
  fastify.scheduler.addSimpleIntervalJob(job);
};

ws.onerror = () => {
  setTimeout(() => {
    ws = getWs();
  }, 10000);
};

fastify.get('/', function (_, reply) {
  reply.send({ hello: 'world' });
});

fastify.get('/healthcheck', function (_, reply) {
  reply.send('ok');
});

function validateInterval(
  request: FastifyRequest<RouteGenericInterface, Server, IncomingMessage>,
  reply: FastifyReply<
    Server,
    IncomingMessage,
    ServerResponse,
    RouteGenericInterface,
    unknown
  >,
) {
  const interval: string = request.params['interval']
    ? request.params['interval']
    : 'alltime';
  let zsetName = '';
  if (interval === 'alltime') {
    zsetName = 'leaderboard_alltime';
  } else if (interval === 'last6Hours') {
    zsetName = 'leaderboard_hour';
  } else if (interval === 'realitme') {
    zsetName = 'realtime';
  } else {
    reply.status(403).send('interval should either be alltime or last6Hours');
  }
  return zsetName;
}

fastify.get('/leaderboard/page_total', async function () {
  const [
    leaderboardLastHourCount,
    leaderboardAlltimeCount,
  ] = await redis
    .multi()
    .zcard('leaderboard_hour')
    .zcard('leaderboard_alltime')
    .exec();

  leaderboardLastHourPages = Math.ceil(
    (leaderboardLastHourCount as number) / 20,
  );
  leaderboardAlltimePages = Math.ceil((leaderboardAlltimeCount as number) / 20);
  return {
    alltime: leaderboardAlltimePages,
    hour: leaderboardLastHourPages,
  };
});

fastify.get('/leaderboard/:interval/:page', async function (request, reply) {
  const zsetName = validateInterval(request, reply);
  const pageNumber: number = request.params['page']
    ? parseInt(request.params['page'])
    : 0;

  let pageTotal = 0;
  if (zsetName == 'leaderboard_alltime') {
    pageTotal = leaderboardAlltimePages;
  } else if (zsetName == 'leaderboard_hour') {
    pageTotal = leaderboardLastHourPages;
  }
  if (pageNumber > pageTotal - 1) {
    reply.status(403).send('page number requested is too high');
  }
  const leaderboard = await redis.zrevrange(
    zsetName,
    pageNumber * 20,
    pageNumber * 20 + 19,
    'WITHSCORES',
  );
  const artists = leaderboard.filter((_, index) => {
    return index % 2 == 0;
  });
  const artistMetadata = await redis.hmget('artist_metadata', ...artists);
  const message = {
    artistMetadata,
    leaderboard,
  };
  reply.send(JSON.stringify(message));
});

fastify.get('/unsub', async function (request) {
  let lastArtist = request.headers['x-channel-id'] as string;
  lastArtist = decodeURI(lastArtist);
  console.log(`client unsubbed. decrementing count of artist ${lastArtist}`);
  try {
    await unsub(redis, lastArtist);
  } catch (error) {
    console.log('error', error);
  }
  return 'OK';
});

fastify.all('/pub', async function (request) {
  return pub(request, redis);
});

const start = async () => {
  const [
    leaderboardLastHourCount,
    leaderboardAlltimeCount,
  ] = await redis
    .multi()
    .zcard('leaderboard_hour')
    .zcard('leaderboard_alltime')
    .exec();

  leaderboardLastHourPages = Math.ceil(
    (leaderboardLastHourCount as number) / 20,
  );
  leaderboardAlltimePages = Math.ceil((leaderboardAlltimeCount as number) / 20);
  try {
    console.log(`Listening to fastly server in port ${process.env.PORT}`);
    await fastify.listen(process.env.PORT);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
