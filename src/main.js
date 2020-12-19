const express = require('express');
const { ServeGrip } = require('@fanoutio/serve-grip');
const { WebSocketMessageFormat } = require('@fanoutio/grip');

const CHANNEL_NAME = 'test';

const app = express();

const serveGrip = new ServeGrip({
  grip: {
    control_uri: process.env.GRIP_URL,
    control_iss: process.env.REALM_ID,
    key: process.env.REALM_KEY,
  },
});

app.use(serveGrip);

// Websocket-over-HTTP is translated to HTTP POST
app.post('/api/websocket', async (req, res) => {
  const { wsContext } = req.grip;
  if (wsContext == null) {
    res.statusCode = 400;
    res.end('[not a websocket request]\n');
    return;
  }

  // If this is a new connection, accept it and subscribe it to a channel
  if (wsContext.isOpening()) {
    wsContext.accept();
    wsContext.subscribe(CHANNEL_NAME);
  }

  while (wsContext.canRecv()) {
    const message = wsContext.recv();

    if (message == null) {
      // If return value is undefined then connection is closed
      wsContext.close();
      break;
    }

    // Echo the message
    wsContext.send(message);
  }

  res.end();
});

app.post('/api/broadcast', express.text({ type: '*/*' }), async (req, res) => {
  const publisher = serveGrip.getPublisher();
  await publisher.publishFormats(
    CHANNEL_NAME,
    new WebSocketMessageFormat(req.body),
  );

  res.setHeader('Content-Type', 'text/plain');
  res.end('Ok\n');
});

app.listen(process.env.PORT, () =>
  console.log(`Example app listening on port ${process.env.PORT}!`),
);
