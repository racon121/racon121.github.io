const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {}; // Tüm oyuncular
let activePlayers = []; // Maksimum 2 oyuncu oyun alanında

wss.on('connection', (ws) => {
  console.log('Yeni oyuncu bağlandı');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      players[data.id] = data;

      // Eğer aktif oyuncu listesi dolu değilse ekle
      if(activePlayers.length < 2 && !activePlayers.includes(data.id)){
        activePlayers.push(data.id);
      }

      // Tüm bağlı clientlara gönder
      wss.clients.forEach(client => {
        if(client.readyState === WebSocket.OPEN){
          client.send(JSON.stringify({
            allPlayers: players,
            activePlayers: activePlayers
          }));
        }
      });
    } catch(e){
      console.error("Mesaj işlenirken hata:", e);
    }
  });

  ws.on('close', () => {
    console.log('Bir oyuncu ayrıldı');
    // Ayrılan oyuncuyu tüm listelerden temizle
    for(const id in players){
      if(players[id].ws === ws) delete players[id];
    }
    activePlayers = activePlayers.filter(id => id in players);

    // Güncel listeyi gönder
    wss.clients.forEach(client => {
      if(client.readyState === WebSocket.OPEN){
        client.send(JSON.stringify({
          allPlayers: players,
          activePlayers: activePlayers
        }));
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
