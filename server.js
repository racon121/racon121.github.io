const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

let players = {};
let bullets = [];

io.on("connection", socket => {
  console.log("Yeni oyuncu bağlandı:", socket.id);
  players[socket.id] = {
    x: Math.random() * 1600,
    y: Math.random() * 1000,
    health: 6500,
    currentAmmo: 3,
    oyuncuAdi: "Oyuncu",
    emojiActive: false,
  };

  // Oyuncu pozisyon ve durum güncellemesi
  socket.on("update", data => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].health = data.health;
      players[socket.id].currentAmmo = data.currentAmmo;
    }
  });

  // Mermi atma
  socket.on("shoot", bullet => {
    bullet.owner = socket.id;
    bullets.push(bullet);
  });

  // Emoji
  socket.on("emoji", () => {
    io.emit("emoji", socket.id);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });

  // Oyun döngüsü: her 50ms güncelle
  setInterval(() => {
    // Mermileri güncelle ve çarpışma kontrolü
    bullets = bullets.filter(b => {
      b.x += b.dx;
      b.y += b.dy;

      // Mermiyi sınırdan sil
      if (b.x < 0 || b.y < 0 || b.x > 1600 || b.y > 1000) return false;

      // Her oyuncuya çarpma kontrolü
      for (let id in players) {
        if (id !== b.owner) {
          const p = players[id];
          if (b.x > p.x && b.x < p.x + 48 && b.y > p.y && b.y < p.y + 48) {
            p.health -= 1250; // Hasar
            if (p.health < 0) p.health = 0;
            return false; // Mermi yok olur
          }
        }
      }
      return true;
    });

    // Oyuncu ölüme sıfırlama
    for (let id in players) {
      if (players[id].health <= 0) {
        players[id].health = 6500;
        players[id].x = Math.random() * 1600;
        players[id].y = Math.random() * 1000;
      }
    }

    // Durum gönder
    io.emit("state", { players, bullets });
  }, 50);
});

http.listen(PORT, () => console.log("Server çalışıyor:", PORT));
