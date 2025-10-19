// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // Her yerden bağlanabilsin
});

app.use(express.static('public'));

let waitingPlayer = null; // Eşleşmeyi bekleyen oyuncu
let players = {};          // socket.id -> playerName
let games = {};            // socket.id -> board (9 hücreli array)

// Rastgele oyuncu ismi üret
function generateRandomName() {
  return 'Oyuncu' + Math.floor(Math.random() * 1000);
}

// Kazanan kontrolü
function checkWinner(board, symbol) {
  const winCombos = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  return winCombos.some(combo => combo.every(i => board[i] === symbol));
}

// Board doluluk kontrolü
function isBoardFull(board) {
  return board.every(cell => cell !== '');
}

io.on('connection', (socket) => {
  console.log('Bir oyuncu bağlandı:', socket.id);
  players[socket.id] = generateRandomName();
  games[socket.id] = Array(9).fill('');

  if (waitingPlayer) {
    // Eşleşme bulundu
    const player1 = waitingPlayer;
    const player2 = socket.id;

    const symbols = ['X', 'O'];
    const firstTurn = Math.random() < 0.5 ? 0 : 1;

    io.to(player1).emit('startGame', {
      playerName: players[player1],
      opponentName: players[player2],
      symbol: symbols[0],
      myTurn: firstTurn === 0
    });

    io.to(player2).emit('startGame', {
      playerName: players[player2],
      opponentName: players[player1],
      symbol: symbols[1],
      myTurn: firstTurn === 1
    });

    console.log(`Eşleşme bulundu: ${players[player1]} vs ${players[player2]}`);
    waitingPlayer = null;
  } else {
    waitingPlayer = socket.id;
    socket.emit('searching');
    console.log(`Oyuncu beklemede: ${players[socket.id]}`);
  }

  // Hamle yapıldığında
  socket.on('makeMove', (data) => {
    if (!games[socket.id]) return;

    const board = games[socket.id];
    board[data.index] = data.symbol;

    // Diğer oyuncuyu bul
    let opponentId = Object.keys(players).find(id => id !== socket.id && games[id]);

    // Hamleyi güncelle
    if (opponentId) {
      io.to(opponentId).emit('updateMove', {
        index: data.index,
        symbol: data.symbol,
        nextTurn: opponentId,
        winner: checkWinner(board, data.symbol) ? players[socket.id] : null
      });
    }

    socket.emit('updateMove', {
      index: data.index,
      symbol: data.symbol,
      nextTurn: opponentId || socket.id,
      winner: checkWinner(board, data.symbol) ? players[socket.id] : null
    });

    // Kazanan veya berabere kontrolü
    const winner = checkWinner(board, data.symbol);
    if (winner || isBoardFull(board)) {
      [socket.id, opponentId].forEach(id => {
        if (id) {
          io.to(id).emit('gameOver', { winner: winner ? players[socket.id] : null });
          games[id] = Array(9).fill(''); // Board reset
        }
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Oyuncu ayrıldı:', socket.id);
    if (waitingPlayer === socket.id) waitingPlayer = null;
    delete players[socket.id];
    delete games[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor`));
              
