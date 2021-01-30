import {
  addNodeRedisCommand,
  createNodeRedisClient,
  WrappedNodeRedisClient,
} from 'handy-redis';

let redis: WrappedNodeRedisClient;

export function getRedis(): WrappedNodeRedisClient {
  if (!redis) {
    addNodeRedisCommand('RG.TRIGGER');
    redis = createNodeRedisClient({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
    });
  }
  return redis;
}
