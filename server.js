// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;
let players = {}; // socket.id -> playerName

function generateRandomName() {
  return 'Oyuncu' + Math.floor(Math.random() * 1000);
}

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı:', socket.id);
    players[socket.id] = generateRandomName();

    if (waitingPlayer) {
        // Eşleşme bulundu
        const firstPlayer = Math.random() < 0.5 ? waitingPlayer : socket.id;
        const secondPlayer = firstPlayer === waitingPlayer ? socket.id : waitingPlayer;

        const firstSymbol = Math.random() < 0.5 ? 'X' : 'O';
        const secondSymbol = firstSymbol === 'X' ? 'O' : 'X';

        io.to(firstPlayer).emit('startGame', {
            playerName: players[firstPlayer],
            opponentName: players[secondPlayer],
            symbol: firstSymbol,
            myTurn: firstSymbol === 'X'
        });

        io.to(secondPlayer).emit('startGame', {
            playerName: players[secondPlayer],
            opponentName: players[firstPlayer],
            symbol: secondSymbol,
            myTurn: secondSymbol === 'X'
        });

        waitingPlayer = null;
    } else {
        waitingPlayer = socket.id;
        socket.emit('searching');
    }

    socket.on('makeMove', (data) => {
        const winner = checkWinner(data.index, data.symbol, socket.id);
        let nextTurn = null;

        for (let id in players) {
            if (id !== socket.id) {
                nextTurn = players[id];
                io.to(id).emit('updateMove', { index: data.index, symbol: data.symbol, nextTurn, winner });
            } else {
                io.to(id).emit('updateMove', { index: data.index, symbol: data.symbol, nextTurn: players[id], winner });
            }
        }

        if (winner || isBoardFull()) {
            for (let id in players) {
                io.to(id).emit('gameOver', { winner: winner ? players[socket.id] : null });
            }
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayer === socket.id) waitingPlayer = null;
        delete players[socket.id];
        console.log('Oyuncu ayrıldı:', socket.id);
    });
});

// Basit oyun kontrolü (sadece ilk 3 hamlede kazanma durumu)
let board = Array(9).fill('');
function checkWinner(index, symbol, socketId) {
    board[index] = symbol;
    const winCombos = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];

    return winCombos.some(combo => combo.every(i => board[i] === symbol));
}

function isBoardFull() {
    return board.every(cell => cell !== '');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor`));
