// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

let waitingPlayer = null;
let players = {};
let games = {}; // eşleşmiş oyuncuların oyunları

function generateRandomName() {
  return 'Oyuncu' + Math.floor(Math.random() * 1000);
}

io.on('connection', (socket) => {
  console.log('Bir oyuncu bağlandı:', socket.id);
  players[socket.id] = generateRandomName();

  if (waitingPlayer) {
    const firstPlayer = waitingPlayer;
    const secondPlayer = socket.id;
    waitingPlayer = null;

    const firstSymbol = Math.random() < 0.5 ? 'X' : 'O';
    const secondSymbol = firstSymbol === 'X' ? 'O' : 'X';

    const roomId = firstPlayer + secondPlayer;
    games[roomId] = {
      board: Array(9).fill(''),
      players: [firstPlayer, secondPlayer],
      turn: firstSymbol === 'X' ? firstPlayer : secondPlayer
    };

    io.to(firstPlayer).emit('startGame', {
      playerName: players[firstPlayer],
      opponentName: players[secondPlayer],
      symbol: firstSymbol,
      myTurn: firstSymbol === 'X',
      roomId
    });

    io.to(secondPlayer).emit('startGame', {
      playerName: players[secondPlayer],
      opponentName: players[firstPlayer],
      symbol: secondSymbol,
      myTurn: secondSymbol === 'X',
      roomId
    });

    console.log(`Eşleşme yapıldı: ${players[firstPlayer]} vs ${players[secondPlayer]}`);
  } else {
    waitingPlayer = socket.id;
    socket.emit('searching');
    console.log('Oyuncu bekliyor:', socket.id);
  }

  socket.on('makeMove', (data) => {
    const game = games[data.roomId];
    if (!game) return;

    if (socket.id !== game.turn) return; // sırası değilse oynamasın
    if (game.board[data.index] !== '') return;

    game.board[data.index] = data.symbol;
    const winner = checkWinner(game.board);
    const nextTurn = game.players.find(p => p !== socket.id);
    game.turn = nextTurn;

    game.players.forEach(p => {
      io.to(p).emit('updateMove', {
        index: data.index,
        symbol: data.symbol,
        nextTurn: nextTurn === p,
        winner
      });
    });

    if (winner || isBoardFull(game.board)) {
      game.players.forEach(p => {
        io.to(p).emit('gameOver', { winner });
      });
      delete games[data.roomId];
    }
  });

  socket.on('disconnect', () => {
    if (waitingPlayer === socket.id) waitingPlayer = null;
    delete players[socket.id];
    console.log('Oyuncu ayrıldı:', socket.id);
  });
});

function checkWinner(board) {
  const winCombos = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const combo of winCombos) {
    const [a,b,c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function isBoardFull(board) {
  return board.every(cell => cell !== '');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor`));
