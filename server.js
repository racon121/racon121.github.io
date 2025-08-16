// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {}; // Tüm oyuncular

wss.on('connection', (ws) => {
  console.log('Yeni oyuncu bağlandı');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Oyuncu bilgilerini kaydet
      players[data.id] = data;

      // Tüm oyunculara gönder
      wss.clients.forEach(client => {
        if(client.readyState === WebSocket.OPEN){
          client.send(JSON.stringify(players));
        }
      });

    } catch(e){
      console.error("Mesaj işlenirken hata:", e);
    }
  });

  ws.on('close', () => {
    console.log('Bir oyuncu ayrıldı');

    // Ayrılan oyuncuyu listeden çıkar
    for(const id in players){
      if(players[id].ws === ws) delete players[id];
    }

    // Güncel oyuncu listesi gönder
    wss.clients.forEach(client => {
      if(client.readyState === WebSocket.OPEN){
        client.send(JSON.stringify(players));
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
