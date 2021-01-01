import { Job } from 'bullmq';
import fetch from 'node-fetch';

module.exports = async (job: Job) => {
  try {
    const response = await fetch('http://localhost:5561/publish/', {
      method: 'POST',
      body: job.data,
      headers: {
        'Content-Type': 'application/json',
        // 'Content-Length': String(Buffer.byteLength(body, 'utf8')),
      },
    });
    await response.text();
  } catch (error) {
    console.log('error is', error);
  }
};
