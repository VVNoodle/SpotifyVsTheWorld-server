"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express = require("express");
const serve_grip_1 = require("@fanoutio/serve-grip");
const grip_1 = require("@fanoutio/grip");
const PORT = 3000;
const CHANNEL_NAME = 'test';
const app = express();
const serveGrip = new serve_grip_1.ServeGrip({
    grip: {
        control_uri: process.env.GRIP_URL,
        control_iss: process.env.REALM_ID,
        key: process.env.REALM_KEY,
    },
});
app.use(serveGrip);
app.post('/api/websocket', (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const { wsContext } = req.grip;
    if (wsContext == null) {
        res.statusCode = 400;
        res.end('[not a websocket request]\n');
        return;
    }
    if (wsContext.isOpening()) {
        wsContext.accept();
        wsContext.subscribe(CHANNEL_NAME);
    }
    while (wsContext.canRecv()) {
        const message = wsContext.recv();
        if (message == null) {
            wsContext.close();
            break;
        }
        wsContext.send(message);
    }
    res.end();
}));
app.post('/api/broadcast', express.text({ type: '*/*' }), (req, res) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const publisher = serveGrip.getPublisher();
    yield publisher.publishFormats(CHANNEL_NAME, new grip_1.WebSocketMessageFormat(req.body));
    res.setHeader('Content-Type', 'text/plain');
    res.end('Ok\n');
}));
app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`));
//# sourceMappingURL=main.js.map