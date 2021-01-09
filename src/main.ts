import fastifyInit from 'fastify';
import { Queue, QueueScheduler, Worker } from 'bullmq';
import * as path from 'path';

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

const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
};

const jobName = 'publisherJob';
const publishQueue = new Queue(jobName, {
  connection: redisConfig,
});
const processorFile = path.join(
  __dirname,
  'workers',
  process.env.PUBLISH_MESSAGE_FILENAME,
);
new Worker(jobName, processorFile, {
  limiter: {
    max: 10,
    duration: 1000,
  },
  connection: redisConfig,
});
new QueueScheduler(jobName, {
  connection: redisConfig,
});

fastify.get('/', function (_, reply) {
  reply.send({ hello: 'world' });
});

fastify.get('/healthcheck', function (_, reply) {
  reply.send('ok');
});

fastify.get('/unsub', async function (request, reply) {
  const lastArtist = request.headers['x-channel-id'] as string;
  console.log(`client unsubbed. decrementing count of artist ${lastArtist}`);
  try {
    await publishQueue.add(lastArtist, lastArtist, {
      delay: 2000,
    });
  } catch (error) {
    console.log('error', error);
  }
  reply.status(200).send('done');
});

const start = async () => {
  try {
    console.log('Listening to fastly server!');
    console.log('envvars:::');
    console.log(process.env.REDIS_HOST);
    console.log(process.env.REDIS_PASSWORD);
    console.log(process.env.REDIS_PORT);
    console.log(process.env.HTTP2);
    await fastify.listen(process.env.PORT);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
