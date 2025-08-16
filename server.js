const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname)); // HTML, JS, PNG dosyalarını sun

let players = {};
let bullets = [];

io.on("connection", socket => {
  console.log("Yeni oyuncu bağlandı:", socket.id);
  players[socket.id] = {x:100, y:100, health:6500, currentAmmo:3, oyuncuAdi:"Oyuncu", emojiActive:false};

  socket.on("update", data => {
    if(players[socket.id]){
      players[socket.id] = {...players[socket.id], ...data};
    }
  });

  socket.on("bullet", bullet => {
    bullets.push({...bullet, ownerId: socket.id});
  });

  socket.on("emoji", () => {
    socket.broadcast.emit("emoji", socket.id);
  });

  socket.on("disconnect", ()=>{
    delete players[socket.id];
    io.emit("disconnect", socket.id);
  });

  setInterval(() => {
    // Mermi ve çarpışma kontrolü
    bullets.forEach((b, i) => {
      b.x += b.dx;
      b.y += b.dy;

      // Oyunculara çarpma
      for(let id in players){
        if(id !== b.ownerId){
          const p = players[id];
          if(b.x > p.x && b.x < p.x+48 && b.y > p.y && b.y < p.y+48){
            p.health -= 1250; // mermi hasarı
            bullets.splice(i,1);
            break;
          }
        }
      }

      // Harita sınırı
      if(b.x<0 || b.x>1600 || b.y<0 || b.y>1000){
        bullets.splice(i,1);
      }
    });

    io.emit("state", {players, bullets});
  }, 50);
});

http.listen(PORT, ()=>console.log("Server çalışıyor:", PORT));
