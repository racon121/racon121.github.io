const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Tüm oyuncuları sakla
let players = {};

wss.on('connection', (ws) => {
  console.log('Yeni oyuncu bağlandı');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Oyuncu bilgilerini id ile kaydet
      players[data.id] = {
        id: data.id,
        name: data.name,
        x: data.x,
        y: data.y,
        color: data.color
      };

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
    // Not: ws objesini client objesi ile bağlamıyoruz, bu yüzden basitçe listeyi temizlemek için id kullanacağız
    // Ayrılan oyuncu client tarafında kendini silmeyecekse timeout veya heartbeat ile temizlenebilir
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
