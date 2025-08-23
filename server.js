const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static(__dirname));

io.on("connection", socket => {
    console.log("Yeni kullanıcı bağlandı:", socket.id);

    // Arkadaş daveti gönderme
    socket.on("sendInvite", ({toId, fromName}) => {
        io.to(toId).emit("receiveInvite", {fromName, fromId: socket.id});
    });

    // Lobby’ye kabul etme
    socket.on("acceptInvite", ({fromId, friendName}) => {
        io.to(fromId).emit("inviteAccepted", {friendName});
    });

    // Lobby’ye katılım bildirimi
    socket.on("joinLobby", ({name}) => {
        socket.broadcast.emit("lobbyUpdate", {name});
    });
});

http.listen(3000, () => console.log("Server 3000 portunda çalışıyor"));
