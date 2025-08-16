const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname)); // HTML, JS, PNG dosyalarını sun

let players = {};

io.on("connection", socket => {
  console.log("Yeni oyuncu bağlandı:", socket.id);
  players[socket.id] = {
    x: Math.random() * 1600,
    y: Math.random() * 1000,
    health: 6500,
    currentAmmo: 3,
    oyuncuAdi: "Oyuncu",
    emojiActive: false
  };

  // Oyuncu durum güncellemesi
  socket.on("update", data => {
    if(players[socket.id]){
      players[socket.id] = {...players[socket.id], ...data};
    }
  });

  // Emoji kullanımı
  socket.on("emoji", () => {
    socket.broadcast.emit("emoji", {playerId: socket.id});
  });

  // Mermi atışı
  socket.on("bullet", data => {
    socket.broadcast.emit("bullet", data);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("disconnect", {playerId: socket.id});
  });

  // Oyuncuların durumu
  setInterval(()=>{
    socket.emit("state", players);
  },50);
});

http.listen(PORT, ()=>console.log("Server çalışıyor:", PORT));
