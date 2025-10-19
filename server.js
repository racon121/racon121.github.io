const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null; // Eşleşmeyi bekleyen oyuncu
let rooms = {}; // roomId -> { players: [socketId, socketId], board: [], turn: 'X' }

function generateRandomName() {
  return 'Oyuncu' + Math.floor(Math.random() * 1000);
}

function createRoom(player1, player2) {
  const roomId = 'room-' + Math.floor(Math.random() * 10000);
  const firstSymbol = Math.random() < 0.5 ? 'X' : 'O';
  const secondSymbol = firstSymbol === 'X' ? 'O' : 'X';
  const firstTurn = 'X'; // X her zaman başlar

  rooms[roomId] = {
    players: [player1, player2],
    board: Array(9).fill(''),
    turn: firstTurn,
    symbols: {
      [player1]: firstSymbol,
      [player2]: secondSymbol
    }
  };

  return roomId;
}

function checkWinner(board, symbol) {
  const winCombos = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  return winCombos.some(combo => combo.every(i => board[i] === symbol));
}

io.on('connection', (socket) => {
  console.log('Bir oyuncu bağlandı:', socket.id);
  socket.playerName = generateRandomName();

  if (waitingPlayer) {
    // Oyun başlat
    const roomId = createRoom(waitingPlayer, socket.id);
    const room = rooms[roomId];

    socket.join(roomId);
    io.to(waitingPlayer).join(roomId);

    // Her iki oyuncuya startGame event gönder
    room.players.forEach(id => {
      io.to(id).emit('startGame', {
        playerName: id === socket.id ? socket.playerName : io.sockets.sockets.get(id).playerName,
        opponentName: id === socket.id ? io.sockets.sockets.get(room.players.find(p => p !== id)).playerName : socket.playerName,
        symbol: room.symbols[id],
        myTurn: room.turn === room.symbols[id]
      });
    });

    waitingPlayer = null;

  } else {
    waitingPlayer = socket.id;
    socket.emit('searching');
  }

  socket.on('makeMove', (data) => {
    // Oyuncunun odasını bul
    const roomId = Object.keys(rooms).find(rId => rooms[rId].players.includes(socket.id));
    if (!roomId) return;
    const room = rooms[roomId];

    // Sadece sıradaki oyuncu oynayabilir
    if (room.symbols[socket.id] !== room.turn) return;
    if (room.board[data.index] !== '') return;

    room.board[data.index] = data.symbol;

    // Kazanan var mı?
    const winner = checkWinner(room.board, data.symbol);
    if (winner) {
      room.players.forEach(id => {
        io.to(id).emit('gameOver', { winner: socket.playerName });
      });
      room.board = Array(9).fill(''); // board sıfırla
      room.turn = 'X'; // sırayı resetle
      return;
    }

    // Berabere kontrol
    if (room.board.every(c => c !== '')) {
      room.players.forEach(id => {
        io.to(id).emit('gameOver', { winner: null });
      });
      room.board = Array(9).fill('');
      room.turn = 'X';
      return;
    }

    // Sırayı değiştir
    room.turn = room.turn === 'X' ? 'O' : 'X';

    // Hamleyi oyunculara gönder
    room.players.forEach(id => {
      io.to(id).emit('updateMove', {
        index: data.index,
        symbol: data.symbol,
        nextTurn: room.players.find(p => room.symbols[p] === room.turn) === id ? io.sockets.sockets.get(id).playerName : io.sockets.sockets.get(room.players.find(p => p !== id)).playerName,
        winner: null
      });
    });
  });

  socket.on('disconnect', () => {
    console.log('Oyuncu ayrıldı:', socket.id);
    if (waitingPlayer === socket.id) waitingPlayer = null;

    // Oyuncunun odasını sil
    const roomId = Object.keys(rooms).find(rId => rooms[rId].players.includes(socket.id));
    if (roomId) {
      const room = rooms[roomId];
      room.players.forEach(id => {
        if (id !== socket.id) {
          io.to(id).emit('gameOver', { winner: 'Rakip ayrıldı' });
        }
      });
      delete rooms[roomId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor`));
