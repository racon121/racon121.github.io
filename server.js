// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static client files from ./public
app.use(express.static(path.join(__dirname, 'public')));

// --- Game constants (mirrors client) ---
const WORLD = { w: 5000, h: 5000 };
const FOOD_COUNT = 1000;
const FOOD_MIN_R = 4;
const FOOD_MAX_R = 10;
const PLAYER_START_MASS = 20;
const TICK_RATE = 20; // 20 ticks/sec server authoritative
const PLAYER_BASE_SPEED = 5.2;
const PLAYER_SHRINK_SCALE = 0.65;

// --- Server state ---
let foods = [];
let players = {}; // socket.id -> player object

function rand(min, max) { return Math.random() * (max - min) + min; }
function makeFood() {
  return {
    id: Math.random().toString(36).slice(2, 9),
    x: rand(20, WORLD.w - 20),
    y: rand(20, WORLD.h - 20),
    r: rand(FOOD_MIN_R, FOOD_MAX_R),
    color: `hsl(${Math.floor(rand(0,360))},80%,60%)`
  };
}
function spawnInitialFood() {
  foods = [];
  for (let i = 0; i < FOOD_COUNT; i++) foods.push(makeFood());
}
spawnInitialFood();

// --- Player helpers ---
function createPlayer(id, name) {
  return {
    id,
    name: name || `Player${id.slice(0,4)}`,
    x: Math.floor(rand(50, WORLD.w - 50)),
    y: Math.floor(rand(50, WORLD.h - 50)),
    vx: 0,
    vy: 0,
    mass: PLAYER_START_MASS,
    score: 0,
    power: false,
    shrinkScale: PLAYER_SHRINK_SCALE,
    lastActivity: Date.now()
  };
}

function playerRadius(mass, power=false) {
  let pr = Math.sqrt(mass) * 6;
  if (power) pr *= PLAYER_SHRINK_SCALE;
  return pr;
}

function playerSpeed(mass, power=false) {
  let massFactor = Math.pow(mass, 0.18);
  let sp = PLAYER_BASE_SPEED / massFactor;
  if (power) sp *= 1.9;
  return sp;
}

// --- Networking logic ---
io.on('connection', socket => {
  const ip = socket.handshake.address;
  console.log(`connect ${socket.id} (${ip})`);

  socket.on('join', (data) => {
    const name = (data && data.name) || undefined;
    players[socket.id] = createPlayer(socket.id, name);
    // send initial world
    socket.emit('world', { world: {w:WORLD.w, h:WORLD.h}, foods, id: socket.id });
  });

  socket.on('input', (data) => {
    // data: {dx, dy, target: {x,y}?, power: boolean}
    const p = players[socket.id];
    if (!p) return;
    p.lastActivity = Date.now();
    // store desired input on player object
    p.input = {
      dx: typeof data.dx === 'number' ? data.dx : 0,
      dy: typeof data.dy === 'number' ? data.dy : 0,
      target: data.target || null,
      power: !!data.power
    };
  });

  socket.on('setName', (name) => {
    if (!players[socket.id]) return;
    players[socket.id].name = String(name).slice(0,24);
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    delete players[socket.id];
  });
});

// --- Game loop (server authoritative) ---
function tick() {
  // Update each player according to their input
  for (const id in players) {
    const p = players[id];
    const input = p.input || { dx:0, dy:0, target:null, power:false };
    p.power = !!input.power;

    const sp = playerSpeed(p.mass, p.power) / (TICK_RATE / 60);

    if (input.dx || input.dy) {
      const mag = Math.hypot(input.dx, input.dy) || 1;
      p.vx = (input.dx / mag) * sp;
      p.vy = (input.dy / mag) * sp;
    } else if (input.target && typeof input.target.x === 'number') {
      // move toward target
      const dx = input.target.x - p.x, dy = input.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        p.vx = (dx / d) * sp;
        p.vy = (dy / d) * sp;
      } else {
        p.vx *= 0.86; p.vy *= 0.86;
      }
    } else {
      // no input
      p.vx = 0; p.vy = 0;
    }

    p.x += p.vx;
    p.y += p.vy;
    // enforce walls
    p.x = Math.max(1, Math.min(WORLD.w - 1, p.x));
    p.y = Math.max(1, Math.min(WORLD.h - 1, p.y));
  }

  // Food collisions (players eat foods)
  for (const id in players) {
    const p = players[id];
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      const dx = f.x - p.x, dy = f.y - p.y;
      const pr = playerRadius(p.mass, p.power);
      const r = pr + f.r;
      if (dx*dx + dy*dy <= r*r) {
        // eat it
        p.mass += 1.2; // faster mass gain per food
        p.score += 1;
        foods.splice(i,1);
      }
    }
  }

  // Player collisions (bigger eats smaller)
  const ids = Object.keys(players);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i+1; j < ids.length; j++) {
      const A = players[ids[i]];
      const B = players[ids[j]];
      if (!A || !B) continue;
      const dx = B.x - A.x, dy = B.y - A.y, d2 = dx*dx + dy*dy;
      const rA = playerRadius(A.mass, A.power);
      const rB = playerRadius(B.mass, B.power);
      if (d2 <= (rA + rB) * (rA + rB)) {
        // collision, whoever bigger eats smaller if sufficiently larger
        if (A.mass > B.mass * 1.05) {
          // A eats B
          const transferScore = Math.floor(B.score / 2);
          A.score += transferScore;
          B.score = 0;
          // mass transfer: eater gains half of victim's mass, victim reset
          A.mass += Math.floor(B.mass * 0.5);
          // reset victim
          B.mass = PLAYER_START_MASS;
          B.x = Math.floor(rand(50, WORLD.w-50));
          B.y = Math.floor(rand(50, WORLD.h-50));
          B.vx = B.vy = 0;
          // notify eaten client (optional) - we will let clients handle local respawn visuals when server state changes
        } else if (B.mass > A.mass * 1.05) {
          // B eats A
          const transferScore = Math.floor(A.score / 2);
          B.score += transferScore;
          A.score = 0;
          B.mass += Math.floor(A.mass * 0.5);
          A.mass = PLAYER_START_MASS;
          A.x = Math.floor(rand(50, WORLD.w-50));
          A.y = Math.floor(rand(50, WORLD.h-50));
          A.vx = A.vy = 0;
        }
      }
    }
  }

  // keep food count topped up quickly (faster respawn)
  while (foods.length < FOOD_COUNT) {
    // spawn a few per tick for faster regen
    foods.push(makeFood());
    if (foods.length % 50 === 0) break;
  }

  // Remove inactive players older than X minutes? (optional)
}

// broadcast state at regular intervals
setInterval(() => {
  tick();

  // Prepare a lightweight broadcast state
  const playersArr = Object.values(players).map(p => ({
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    mass: p.mass,
    score: p.score,
    power: p.power
  }));

  // build top10 scoreboard
  const top10 = Object.values(players)
    .slice()
    .sort((a,b) => b.score - a.score)
    .slice(0, 10)
    .map((p, idx) => ({ rank: idx+1, name: p.name, score: p.score }));

  io.emit('state', {
    players: playersArr,
    foods,
    top10
  });
}, 1000 / 12); // ~12 updates/sec to clients

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
