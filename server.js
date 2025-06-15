// server.js
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let queue = [];

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', ws => {
  queue.push(ws);

  if (queue.length >= 2) {
    const [p1, p2] = queue.splice(0,2);
    p1.send(JSON.stringify({ type: 'start', role: 'blue' }));
    p2.send(JSON.stringify({ type: 'start', role: 'red' }));
  }

  ws.on('message', data => {
    queue.forEach(p => {
      if (p !== ws && p.readyState === WebSocket.OPEN) {
        p.send(data);
      }
    });
  });

  ws.on('close', () => {
    queue = queue.filter(p => p !== ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu port ${PORT} çalışıyor.`));


