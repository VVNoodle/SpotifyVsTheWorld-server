import { Job } from 'bullmq';
import fetch from 'node-fetch';

module.exports = async (job: Job<string>) => {
  try {
    console.log('running worker', job.data);
    const listenerCountResponse = await fetch(
      `https://${process.env.NCHAN_URL}/pub/${job.data}`,
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
      `https://${process.env.NCHAN_URL}/pub/${job.data}`,
      {
        method: 'POST',
        body: `c=${count.subscribers}`,
      },
    );
    await response.text();
  } catch (error) {
    console.log('error is', error);
  }
};
