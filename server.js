// server.js
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*" }
});
const path = require("path");

const PORT = process.env.PORT || 3000;

// Statik dosyalar
app.use(express.static(path.join(__dirname)));

// Online oyuncular
let onlinePlayers = {};

io.on("connection", socket => {
  console.log("Yeni kullanıcı bağlandı: " + socket.id);

  // Oyuncu bağlandığında adı gönder
  socket.on("registerPlayer", playerName => {
    onlinePlayers[playerName] = socket.id;
    console.log("Kayıtlı oyuncular:", Object.keys(onlinePlayers));
  });

  // Davet gönder
  socket.on("sendInvite", ({ toId, fromName }) => {
    const toSocketId = onlinePlayers[toId];
    if(toSocketId) {
      io.to(toSocketId).emit("receiveInvite", { fromId: fromName, fromName });
    }
  });

  // Daveti kabul et
  socket.on("acceptInvite", ({ fromId, friendName }) => {
    const fromSocketId = onlinePlayers[fromId];
    if(fromSocketId) {
      io.to(fromSocketId).emit("inviteAccepted", { by: friendName });
    }
  });

  // Oyuncu ayrıldığında
  socket.on("disconnect", () => {
    for(let name in onlinePlayers){
      if(onlinePlayers[name] === socket.id){
        delete onlinePlayers[name];
        console.log("Oyuncu ayrıldı:", name);
        break;
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});
