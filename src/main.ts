import fastifyInit from 'fastify';
import fastifyRateLimit from 'fastify-rate-limit';
import IORedis from 'ioredis';

const config: { [key: string]: string | boolean } = {
  logger: false,
};
if (process.env.LOGGER === 'yes') {
  config.logger = true;
}
if (process.env.HTTP2 === 'yes') {
  config.http2 = true;
}

const fastify = fastifyInit(config);

fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

const redis = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
});

fastify.get('/', function (_, reply) {
  reply.send({ hello: 'world' });
});

fastify.get('/healthcheck', function (_, reply) {
  reply.send('ok');
});

fastify.get('/leaderboard_hour', async function (_, reply) {
  const leaderboard = await redis.zscan('leaderboard_hour', 0, -1);
  console.log('leaderboard', leaderboard);
  reply.send(leaderboard);
});

fastify.get('/unsub', async function (request, reply) {
  const lastArtist = request.headers['x-channel-id'] as string;
  console.log(`client unsubbed. decrementing count of artist ${lastArtist}`);
  try {
    await unsub(lastArtist);
  } catch (error) {
    console.log('error', error);
  }
  reply.status(200).send('done');
});

const start = async () => {
  try {
    console.log(`Listening to fastly server in port ${process.env.PORT}`);
    await fastify.listen(process.env.PORT);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();

async function unsub(artistName: string) {
  try {
    const listenerCountResponse = await fetch(
      `https://${process.env.NCHAN_URL}/pub/${artistName}`,
      {
        method: 'GET',
        headers: {
          Accept: 'text/json',
        },
      },
    );
    const count = await listenerCountResponse.json();
    console.log('count=', count);
    try {
      console.log(count.subscribers);
    } catch (error) {
      console.log('err', error);
    }

    const response = await fetch(
      `https://${process.env.NCHAN_URL}/pub/${artistName}`,
      {
        method: 'POST',
        body: `c=${count.subscribers}`,
      },
    );
    await response.text();
  } catch (error) {
    console.log('error is', error);
  }
}
