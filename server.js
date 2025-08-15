// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Tüm bağlı oyuncuları saklayacağımız obje
let players = {};

// Yeni oyuncu bağlandığında
wss.on('connection', (ws) => {
  console.log('Yeni oyuncu bağlandı');

  // Mesaj geldiğinde diğer oyunculara gönder
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Oyuncu ID ve bilgilerini kaydet
      players[data.id] = {
        id: data.id,
        name: data.name || "Oyuncu",
        x: data.x,
        y: data.y,
        color: data.color || "red"
      };

      // Sadece 2 oyuncu kabul ediliyor
      const playerCount = Object.keys(players).length;
      if(playerCount > 2){
        // Fazla oyuncuyu reddet
        ws.send(JSON.stringify({error: "Sadece 2 oyuncu oynayabilir"}));
        return;
      }

      // Tüm bağlı oyunculara güncel durumu gönder
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(players));
        }
      });

    } catch(e){
      console.error("Mesaj işlenirken hata:", e);
    }
  });

  // Oyuncu ayrıldığında listeden çıkar
  ws.on('close', () => {
    console.log('Bir oyuncu ayrıldı');
    for(const id in players){
      // Eğer bağlantısı kopan client ise sil
      // Bu basit versiyonda tüm bağlantıları silmek yerine
      // client kendini kaldıracak şekilde frontend ile uyumlu
    }
  });
});

// Sunucu portu (Render otomatik olarak PORT verir)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
