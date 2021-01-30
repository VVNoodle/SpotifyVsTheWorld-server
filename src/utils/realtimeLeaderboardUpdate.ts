import { AsyncTask } from 'toad-scheduler';
import fetch from 'node-fetch';
import { getRedis } from './redis';
import { getWs } from './getWs';

let currentData = [];
export async function realtimeLeaderboardUpdate(): Promise<void> {
  try {
    const ws = getWs();
    const response = await fetch(
      `https://${process.env.NCHAN_URL}/pubraw?chanid=realtime`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
    );
    const data = await response.json();
    if (data.subscribers != 0) {
      const redis = getRedis();
      const leaderboard = await redis.zrevrange(
        'leaderboard_realtime',
        0,
        20,
        'WITHSCORES',
      );
      console.log('sending...');
      console.log(leaderboard);
      currentData = leaderboard;
      ws.send(leaderboard.toString());
    }
  } catch (error) {
    console.log(error.message);
  }
}

export const realtimeLeaderboardUpdateJob = new AsyncTask(
  'realtime leaderboard update',
  realtimeLeaderboardUpdate,
  (err: Error) => {
    /* handle errors here */
    console.log('errrrr', err);
  },
);
