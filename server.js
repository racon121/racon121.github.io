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

  // ✅ Eşleşme işlemi
  if (waitingPlayer) {
    const roomId = createRoom(waitingPlayer, socket.id);
    const room = rooms[roomId];

    socket.join(roomId);
    io.sockets.sockets.get(waitingPlayer).join(roomId);

    // Oyuncu isimlerini al
    const p1 = io.sockets.sockets.get(room.players[0]);
    const p2 = io.sockets.sockets.get(room.players[1]);

    // Her iki oyuncuya başlatma bilgisi gönder
    room.players.forEach(id => {
      const isMe = id === socket.id;
      io.to(id).emit('startGame', {
        roomId,
        playerName: io.sockets.sockets.get(id).playerName,
        opponentName: io.sockets.sockets.get(room.players.find(p => p !== id)).playerName,
        symbol: room.symbols[id],
        myTurn: room.turn === room.symbols[id]
      });
    });

    console.log(`Oyun başlatıldı (${p1.playerName} vs ${p2.playerName})`);
    waitingPlayer = null;

  } else {
    waitingPlayer = socket.id;
    socket.emit('searching', { message: 'Rakip bekleniyor...' });
    console.log(`${socket.playerName} rakip bekliyor...`);
  }

  // ✅ Hamle işlendiğinde
  socket.on('makeMove', (data) => {
    const roomId = Object.keys(rooms).find(rId => rooms[rId].players.includes(socket.id));
    if (!roomId) return;
    const room = rooms[roomId];

    // Sırayı kontrol et
    if (room.symbols[socket.id] !== room.turn) return;
    if (room.board[data.index] !== '') return;

    room.board[data.index] = data.symbol;

    const winner = checkWinner(room.board, data.symbol);

    if (winner) {
      room.players.forEach(id => {
        io.to(id).emit('gameOver', {
          winner: socket.playerName
        });
      });
      room.board = Array(9).fill('');
      room.turn = 'X';
      return;
    }

    // Berabere kontrol
    if (room.board.every(cell => cell !== '')) {
      room.players.forEach(id => {
        io.to(id).emit('gameOver', { winner: null });
      });
      room.board = Array(9).fill('');
      room.turn = 'X';
      return;
    }

    // Sırayı değiştir
    room.turn = room.turn === 'X' ? 'O' : 'X';

    // Hamleyi odadaki herkese gönder
    room.players.forEach(id => {
      io.to(id).emit('updateMove', {
        index: data.index,
        symbol: data.symbol,
        nextTurn: room.players.find(p => room.symbols[p] === room.turn) === id
          ? io.sockets.sockets.get(room.players.find(p => room.symbols[p] === room.turn)).playerName
          : io.sockets.sockets.get(room.players.find(p => room.symbols[p] !== room.turn)).playerName,
        winner: null
      });
    });
  });

  // ✅ Oyuncu ayrıldığında
  socket.on('disconnect', () => {
    console.log('Oyuncu ayrıldı:', socket.id);
    if (waitingPlayer === socket.id) waitingPlayer = null;

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
