import * as WebSocket from 'ws';
let ws: WebSocket;

export function getWs(): WebSocket {
  if (!ws) {
    ws = new WebSocket(`wss://${process.env.NCHAN_URL}/pubraw?chanid=realtime`);
  }
  return ws;
}
