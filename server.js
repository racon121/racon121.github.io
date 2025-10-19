// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

let waitingPlayer = null;

io.on("connection", (socket) => {
  console.log("Oyuncu bağlandı:", socket.id);

  if (waitingPlayer) {
    // İkinci oyuncu geldi — eşleşme yap
    const player1 = waitingPlayer;
    const player2 = socket.id;
    waitingPlayer = null;

    // Oyunculara bilgi gönder
    io.to(player1).emit("startGame", { opponent: player2, myTurn: true });
    io.to(player2).emit("startGame", { opponent: player1, myTurn: false });

    console.log("Eşleşme yapıldı:", player1, "ve", player2);
  } else {
    // İlk oyuncu beklemeye alındı
    waitingPlayer = socket.id;
    socket.emit("searching");
    console.log("Oyuncu beklemeye alındı:", socket.id);
  }

  socket.on("disconnect", () => {
    console.log("Oyuncu ayrıldı:", socket.id);
    if (waitingPlayer === socket.id) waitingPlayer = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
