const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*" } // Her yerden bağlanabilmesi için
});

const PORT = process.env.PORT || 3000;

// Statik dosyaları sun
app.use(express.static(__dirname));

let players = {};

// Her oyuncu bağlandığında
io.on("connection", socket => {
  console.log("Yeni oyuncu bağlandı:", socket.id);

  // Oyuncu varsayılan bilgileri
  players[socket.id] = {
    x: Math.random() * 1500,
    y: Math.random() * 900,
    health: 6500,
    ammo: 3,
    oyuncuAdi: "Oyuncu",
    emojiActive: false
  };

  // Oyuncu durumu güncelle
  socket.on("update", data => {
    if (players[socket.id]) {
      players[socket.id] = { ...players[socket.id], ...data };
    }
  });

  // Emoji paylaşımı
  socket.on("emoji", data => {
    socket.broadcast.emit("emoji", data);
    if (players[data.playerId]) players[data.playerId].emojiActive = true;
    setTimeout(() => {
      if (players[data.playerId]) players[data.playerId].emojiActive = false;
    }, 5000);
  });

  // Mermi paylaşımı (isteğe bağlı, burada sadece broadcast)
  socket.on("bullet", bullet => {
    socket.broadcast.emit("bullet", bullet);
  });

  // Oyuncu disconnect olursa
  socket.on("disconnect", () => {
    console.log("Oyuncu ayrıldı:", socket.id);
    delete players[socket.id];
  });

  // Her 50ms’de tüm oyunculara güncel durumu gönder
  const interval = setInterval(() => {
    socket.emit("state", players);
  }, 50);

  socket.on("disconnect", () => clearInterval(interval));
});

// Server başlat
http.listen(PORT, () => console.log("Server çalışıyor:", PORT));
