import * as http from 'http';
import {
  validateSig,
  decodeWebSocketEvents,
  encodeWebSocketEvents,
  WebSocketContext,
  WebSocketMessageFormat,
  Publisher,
} from '@fanoutio/grip';

try {
  http
    .createServer(async (req, res) => {
      try {
        // Validate the Grip-Sig header:
        if (
          !validateSig(req.headers['grip-sig'] as string, process.env.REALM_KEY)
        ) {
          res.writeHead(401);
          res.end('invalid grip-sig token');
          return;
        }

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

        const inEventsEncoded = await new Promise((resolve) => {
          let body = '';
          req.on('data', function (chunk) {
            body += chunk;
          });
          req.on('end', function () {
            resolve(body);
          });
        });

        const inEvents = decodeWebSocketEvents(
          inEventsEncoded as string | Buffer,
        );
        const wsContext = new WebSocketContext(cid, {}, inEvents);

        if (wsContext.isOpening()) {
          // Open the WebSocket and subscribe it to a channel:
          wsContext.accept();
          wsContext.subscribe('test');

          // The above commands made to the wsContext are buffered
          // in the wsContext as "outgoing events".
          // Obtain them and write them to the response.
          const outEvents = wsContext.getOutgoingEvents();
          const outEventsEncoded = encodeWebSocketEvents(outEvents);
          res.write(outEventsEncoded);

          // As an example way to check our subscription, wait and then
          // publish a message to the subscribed channel:
          setTimeout(() => {
            const publisher = new Publisher({
              control_uri: process.env.GRIP_URL,
              control_iss: process.env.REALM_ID,
              key: Buffer.from(process.env.REALM_KEY, 'base64'),
            });
            publisher.publishFormats(
              'test',
              new WebSocketMessageFormat('Test WebSocket Publish!!'),
            );
          }, 5000);
        }

        // Set the headers required by the GRIP proxy:
        res.writeHead(200, wsContext.toHeaders());
      } catch (error) {
        console.log('oops, theres error:', error);
      }
      res.end();
    })
    .listen(parseInt(process.env.PORT), '0.0.0.0');
  console.log('Server running...');
} catch (error) {
  console.log('Server NOT running...');
  console.log('ERROR', error);
  try {
    console.log('ERROR', error.message);
  } catch (err) {
    console.log('foo no', err);
  }
}
