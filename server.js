const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname)); // HTML, JS, PNG dosyalarını sun

let players = {};

io.on("connection", socket => {
  console.log("Yeni oyuncu bağlandı:", socket.id);
  players[socket.id] = {x:0, y:0, health:6500, currentAmmo:5, oyuncuAdi:"Oyuncu", emojiActive:false};

  socket.on("update", data => {
    if(players[socket.id]){
      players[socket.id] = {...players[socket.id], ...data};
    }
  });

  socket.on("emoji", data=>{
    socket.broadcast.emit("emoji", data);
  });

  socket.on("disconnect", ()=>{
    delete players[socket.id];
  });

  setInterval(()=>{
    socket.emit("state", players);
  },50);
});

http.listen(PORT, ()=>console.log("Server çalışıyor:", PORT));
