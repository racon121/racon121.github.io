// server.js
const io = require("socket.io")(3000, {
  cors: { origin: "*" } // Her yerden bağlantıya izin
});

let players = {}; // Tüm oyuncuların bilgisi

io.on("connection", socket => {
  console.log("Yeni oyuncu bağlandı:", socket.id);

  // Yeni oyuncu ekle
  players[socket.id] = {
    x: Math.random()*1600,
    y: Math.random()*1000,
    health: 6500,
    maxHealth: 6500,
    currentAmmo: 3,
    emojiActive: false,
    name: "Oyuncu"
  };

  // Yeni bağlanan oyuncuya mevcut state'i gönder
  socket.emit("state", players);
  // Diğer oyunculara yeni oyuncuyu göster
  socket.broadcast.emit("state", players);

  // Pozisyon, sağlık ve ammo güncellemesi
  socket.on("update", data => {
    if(players[socket.id]){
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].health = data.health;
      players[socket.id].currentAmmo = data.currentAmmo;
    }
    socket.broadcast.emit("state", players);
  });

  // Mermi atma
  socket.on("bullet", b => {
    // Diğer oyunculara mermi bilgisi gönder
    socket.broadcast.emit("bullet", { ...b, shooterId: socket.id });
  });

  // Emoji kullanımı
  socket.on("emoji", () => {
    if(players[socket.id]){
      players[socket.id].emojiActive = true;
      socket.broadcast.emit("emoji", { playerId: socket.id });

      // 5 saniye sonra emoji kapanır
      setTimeout(()=>{
        if(players[socket.id]){
          players[socket.id].emojiActive = false;
          socket.broadcast.emit("emoji", { playerId: socket.id });
        }
      }, 5000);
    }
  });

  // Oyuncu ayrıldığında
  socket.on("disconnect", () => {
    console.log("Oyuncu ayrıldı:", socket.id);
    delete players[socket.id];
    socket.broadcast.emit("state", players);
  });
});

console.log("Server çalışıyor! Port: 3000");
