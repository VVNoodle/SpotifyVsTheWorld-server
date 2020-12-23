import { HttpResponse } from 'uWebSockets.js';

/* Helper function for reading a posted JSON body */
export const readData = (res: HttpResponse): Promise<string> => {
  return new Promise((resolve, reject) => {
    let buffer: Buffer;
    /* Register data cb */
    res.onData((ab, isLast) => {
      const chunk = Buffer.from(ab);
      if (isLast) {
        let data;
        if (buffer) {
          try {
            data = Buffer.concat([buffer, chunk]).toString();
          } catch (err) {
            reject(err);
          }
          resolve(data);
        } else {
          try {
            data = chunk.toString();
          } catch (err) {
            reject(err);
          }
          resolve(data);
        }
      } else {
        if (buffer) {
          buffer = Buffer.concat([buffer, chunk]);
        } else {
          buffer = Buffer.concat([chunk]);
        }
      }
    });
  });
};
