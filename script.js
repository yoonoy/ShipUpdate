'use strict';
/* =========================================================
   ПИРАТСКИЙ МОРСКОЙ БОЙ — логика игры
   ========================================================= */

const GRID_N = 8;
const FLEET_SPEC = [
  { size: 3 },
  { size: 2 },
  { size: 2 },
  { size: 1 },
  { size: 1 },
];

/* ---------------------------------------------------------
   ЗВУКИ — генерируются в браузере, без внешних файлов
   --------------------------------------------------------- */
let soundOn = true;
let audioCtx = null;

/* ---------------------------------------------------------
   ФОНОВАЯ МУЗЫКА — свой трек, кнопка вкл/выкл
   --------------------------------------------------------- */
let musicOn = true;
const bgMusic = document.getElementById('bgMusic');
bgMusic.volume = 0.35;

function startTheme() {
  if (!musicOn) return;
  const p = bgMusic.play();
  if (p && p.catch) p.catch(() => { /* blocked until a user gesture happens; retried below */ });
}

// Browsers block audio autoplay (music) and can leave the Web Audio context suspended
// (sound effects) until the user interacts with the page at least once. Unlock both here.
function unlockAudio() {
  startTheme();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  document.removeEventListener('click', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
}
document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);

document.getElementById('musicToggleBtn').addEventListener('click', function () {
  musicOn = !musicOn;
  this.textContent = musicOn ? '🎵' : '🔕';
  if (musicOn) startTheme();
  else bgMusic.pause();
});
function audioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Browsers sometimes create/leave the context "suspended" until it is explicitly
  // resumed inside a user-gesture handler — without this, soundOn can be true and
  // every node can be scheduled correctly, yet nothing audible ever comes out.
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function sndHit() {
  if (!soundOn) return;
  const ctx = audioContext();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, ctx.currentTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(); noise.stop(ctx.currentTime + 0.3);
}
function sndMiss() {
  if (!soundOn) return;
  const ctx = audioContext();
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.25);
}
function sndTap() {
  if (!soundOn) return;
  const ctx = audioContext();
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(320, ctx.currentTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.connect(gain).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.08);
}
function sndDrop() {
  if (!soundOn) return;
  const ctx = audioContext();
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(340, ctx.currentTime + 0.12);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.22, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
  osc.connect(gain).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.16);
}
function sndWin() {
  if (!soundOn) return;
  const ctx = audioContext();
  [523, 659, 784, 1046].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const t = ctx.currentTime + i * 0.13;
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.3);
  });
}
function sndLose() {
  if (!soundOn) return;
  const ctx = audioContext();
  [440, 349, 293, 220].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const t = ctx.currentTime + i * 0.16;
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.35);
  });
}

/* ---------------------------------------------------------
   ПОЛЕ И РАССТАНОВКА
   --------------------------------------------------------- */
function makeBlankSea() {
  return Array.from({ length: GRID_N }, () => Array(GRID_N).fill(null));
}

function footprintOf(row, col, size, horizontal) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (r < 0 || r >= GRID_N || c < 0 || c >= GRID_N) return null;
    cells.push([r, c]);
  }
  return cells;
}

function touchesAnotherShip(board, cells) {
  for (const [r, c] of cells) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < GRID_N && nc >= 0 && nc < GRID_N && board[nr][nc] === 'ship') return true;
      }
    }
  }
  return false;
}

function fitsHere(board, row, col, size, horizontal) {
  const cells = footprintOf(row, col, size, horizontal);
  if (!cells) return null;
  for (const [r, c] of cells) if (board[r][c] !== null) return null;
  if (touchesAnotherShip(board, cells)) return null;
  return cells;
}

function stampShip(board, cells) {
  cells.forEach(([r, c]) => { board[r][c] = 'ship'; });
}

function detectSunk(board, ships, r, c) {
  const ship = ships.find(s => s.cells.some(([sr, sc]) => sr === r && sc === c));
  if (!ship) return null;
  const allHit = ship.cells.every(([sr, sc]) => board[sr][sc] === 'hit' || board[sr][sc] === 'sunk');
  if (allHit) {
    ship.cells.forEach(([sr, sc]) => { board[sr][sc] = 'sunk'; });
    ship.sunk = true;
    return ship;
  }
  return null;
}

function fleetDestroyed(ships) {
  return ships.every(s => s.sunk);
}

function autoDeployRest(board, ships, defs) {
  for (const def of defs) {
    let cells = null, horizontal = true;
    while (!cells) {
      horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * GRID_N);
      const col = Math.floor(Math.random() * GRID_N);
      cells = fitsHere(board, row, col, def.size, horizontal);
    }
    stampShip(board, cells);
    ships.push({ cells, size: def.size, horizontal, sunk: false });
  }
}

/* ---------------------------------------------------------
   КОРАБЛИ — SVG рисуется в коде для каждой ориентации
   --------------------------------------------------------- */
function drawGalleonSvg(length, horizontal, variant) {
  const L = length * 100, S = 100;
  const w = horizontal ? L : S;
  const h = horizontal ? S : L;
  const pt = (long, short) => horizontal ? `${long},${short}` : `${short},${long}`;

  let body = '';
  if (length === 1) {
    body += `<circle cx="50" cy="50" r="36" class="hull"/>`;
    body += `<circle cx="50" cy="50" r="14" class="turret"/>`;
  } else {
    const d = `M ${pt(4, 50)} L ${pt(26, 8)} L ${pt(L - 18, 8)} `
      + `Q ${pt(L - 2, 8)} ${pt(L - 2, 50)} `
      + `${pt(L - 2, 50)} `
      + `Q ${pt(L - 2, 92)} ${pt(L - 18, 92)} `
      + `L ${pt(26, 92)} Z`;
    body += `<path d="${d}" class="hull"/>`;

    // deckhouse near the stern
    const dhLongStart = L - 58, dhShortStart = 26, dhLongSpan = 42, dhShortSpan = 48;
    const dhX = horizontal ? dhLongStart : dhShortStart;
    const dhY = horizontal ? dhShortStart : dhLongStart;
    const dhW = horizontal ? dhLongSpan : dhShortSpan;
    const dhH = horizontal ? dhShortSpan : dhLongSpan;
    body += `<rect x="${dhX}" y="${dhY}" width="${dhW}" height="${dhH}" rx="6" class="deck"/>`;

    // turret per cell, skipping the deckhouse zone
    for (let i = 0; i < length; i++) {
      const centerLong = 100 * i + 50;
      if (centerLong > L - 70) continue;
      const [cx, cy] = pt(centerLong, 50).split(',');
      body += `<circle cx="${cx}" cy="${cy}" r="13" class="turret"/>`;
    }

    // centerline stripe
    const [x1, y1] = pt(18, 50).split(',');
    const [x2, y2] = pt(L - 10, 50).split(',');
    body += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="stripe"/>`;
  }

  return `<svg viewBox="0 0 ${w} ${h}" class="ship-svg ship-${variant}" preserveAspectRatio="none">${body}</svg>`;
}

function paintShipLayer(overlayEl, ships, board, revealAll) {
  overlayEl.innerHTML = '';
  ships.forEach(ship => {
    if (!revealAll && !ship.sunk) return;
    const anyHit = ship.cells.some(([r, c]) => board[r][c] === 'hit' || board[r][c] === 'sunk');
    const variant = ship.sunk ? 'sunk' : (anyHit ? 'hit' : 'normal');
    const [r0, c0] = ship.cells[0];
    const div = document.createElement('div');
    div.className = 'ship-piece';
    div.style.gridColumn = `${c0 + 1} / span ${ship.horizontal ? ship.size : 1}`;
    div.style.gridRow = `${r0 + 1} / span ${ship.horizontal ? 1 : ship.size}`;
    div.innerHTML = drawGalleonSvg(ship.size, ship.horizontal, variant);
    overlayEl.appendChild(div);
  });
}

/* ---------------------------------------------------------
   ЭФФЕКТ ВЗРЫВА
   --------------------------------------------------------- */
function fireBlast(cellEl) {
  const boom = document.createElement('div');
  boom.className = 'explosion';
  const core = document.createElement('div');
  core.className = 'core';
  boom.appendChild(core);
  for (let i = 0; i < 8; i++) {
    const spark = document.createElement('div');
    spark.className = 'spark';
    const angle = (Math.PI * 2 * i) / 8;
    const dist = 26 + Math.random() * 10;
    spark.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    spark.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    boom.appendChild(spark);
  }
  cellEl.appendChild(boom);
  setTimeout(() => boom.remove(), 550);
}

/* ---------------------------------------------------------
   ПОДПИСИ КООРДИНАТ
   --------------------------------------------------------- */
const COLS = 'ABCDEFGH';
function writeAxisLabels(colEl, rowEl) {
  if (colEl) colEl.innerHTML = COLS.split('').map(l => `<span>${l}</span>`).join('');
  if (rowEl) rowEl.innerHTML = Array.from({ length: GRID_N }, (_, i) => `<span>${i + 1}</span>`).join('');
}

/* ---------------------------------------------------------
   ЭЛЕМЕНТЫ СТРАНИЦЫ
   --------------------------------------------------------- */
const screens = {
  menu: document.getElementById('screen-menu'),
  setup: document.getElementById('screen-setup'),
  pass: document.getElementById('screen-pass'),
  battle: document.getElementById('screen-battle'),
  over: document.getElementById('screen-over'),
};
function switchPanel(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

const setupGridEl = document.getElementById('setupGrid');
const setupShipsEl = document.getElementById('setupShips');
const shipDockEl = document.getElementById('shipDock');
const setupPlayerLabelEl = document.getElementById('setupPlayerLabel');
const setupReadyBtn = document.getElementById('setupReadyBtn');

const fleetGridEl = document.getElementById('fleetGrid');
const fleetShipsEl = document.getElementById('fleetShips');
const enemyGridEl = document.getElementById('enemyGrid');
const enemyShipsEl = document.getElementById('enemyShips');
const fleetLabelEl = document.getElementById('fleetLabel');
const enemyLabelEl = document.getElementById('enemyLabel');
const statusEl = document.getElementById('status');
const fleetVeilEl = document.getElementById('fleetVeil');
const toggleFleetBtn = document.getElementById('toggleFleetBtn');

const passMessageEl = document.getElementById('passMessage');
const overMessageEl = document.getElementById('overMessage');

writeAxisLabels(document.getElementById('setupColLabels'), document.getElementById('setupRowLabels'));
writeAxisLabels(document.getElementById('fleetColLabels'), document.getElementById('fleetRowLabels'));
writeAxisLabels(document.getElementById('enemyColLabels'), document.getElementById('enemyRowLabels'));

/* ---------------------------------------------------------
   СОСТОЯНИЕ ИГРЫ
   --------------------------------------------------------- */
let mode = null;              // 'cpu' | 'hotseat'
let seas = {};              // {1:{grid,ships}, 2:{grid,ships}}
let attacker = 1;
let defender = 2;
let gameOver = false;
let botQueue = [];
let botThinking = false;
let deckShown = false;

function setDeckVisible(visible) {
  deckShown = visible;
  fleetVeilEl.classList.toggle('hidden', visible);
  toggleFleetBtn.textContent = visible ? '🙈 Скрыть' : '👁 Показать';
  toggleFleetBtn.classList.toggle('is-active', visible);
}

toggleFleetBtn.addEventListener('click', () => { sndTap(); setDeckVisible(!deckShown); });
fleetVeilEl.addEventListener('click', () => { sndTap(); setDeckVisible(true); });

function announce(text) { statusEl.textContent = text; }

/* ---------------------------------------------------------
   МЕНЮ
   --------------------------------------------------------- */
document.getElementById('btnVsComputer').addEventListener('click', () => { sndTap(); launchMode('cpu'); });
document.getElementById('btnVsFriend').addEventListener('click', () => { sndTap(); launchMode('hotseat'); });
document.getElementById('menuBtn').addEventListener('click', () => {
  sndTap();
  if (mode && !gameOver && !confirm('Вернуться в меню? Текущая партия будет потеряна.')) return;
  switchPanel('menu');
});
document.getElementById('toMenuBtn').addEventListener('click', () => { sndTap(); switchPanel('menu'); });
document.getElementById('playAgainBtn').addEventListener('click', () => { sndTap(); launchMode(mode); });

document.getElementById('soundToggleBtn').addEventListener('click', function () {
  soundOn = !soundOn;
  this.textContent = soundOn ? '🔊' : '🔇';
  if (soundOn) sndTap();
});

function launchMode(chosenMode) {
  mode = chosenMode;
  seas = {
    1: { grid: makeBlankSea(), ships: [] },
    2: { grid: makeBlankSea(), ships: [] },
  };
  gameOver = false;
  botQueue = [];
  botThinking = false;
  attacker = 1;
  defender = 2;
  openDeckFor(1);
}

/* ---------------------------------------------------------
   РАССТАНОВКА ВРУЧНУЮ
   --------------------------------------------------------- */
let deployState = null;

function openDeckFor(playerNum) {
  switchPanel('setup');
  setupPlayerLabelEl.textContent = mode === 'hotseat' ? `Игрок ${playerNum}` : 'Вы';
  seas[playerNum].grid = makeBlankSea();
  seas[playerNum].ships = [];

  deployState = {
    playerNum,
    board: seas[playerNum].grid,
    horizontal: true,
    currentIdx: 0,
    hover: null,
  };

  buildDeckGrid();
  renderHarbor();
  paintShipLayer(setupShipsEl, seas[playerNum].ships, deployState.board, true);
  setupReadyBtn.disabled = true;
}

function buildDeckGrid() {
  setupGridEl.innerHTML = '';
  for (let r = 0; r < GRID_N; r++) {
    for (let c = 0; c < GRID_N; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener('mouseenter', () => { deployState.hover = [r, c]; drawGhost(); });
      cell.addEventListener('mouseleave', () => { deployState.hover = null; wipeGhost(); });
      cell.addEventListener('click', () => tryDrop(r, c));
      setupGridEl.appendChild(cell);
    }
  }
}

function nextShipSpec() {
  return deployState.currentIdx < FLEET_SPEC.length ? FLEET_SPEC[deployState.currentIdx] : null;
}

function wipeGhost() {
  setupGridEl.querySelectorAll('.cell').forEach(c => c.classList.remove('preview-ok', 'preview-bad'));
}

function drawGhost() {
  wipeGhost();
  const def = nextShipSpec();
  if (!def || !deployState.hover) return;
  const [r, c] = deployState.hover;
  const ok = fitsHere(deployState.board, r, c, def.size, deployState.horizontal);
  const proj = ok || footprintOf(r, c, def.size, deployState.horizontal) || [];
  proj.forEach(([pr, pc]) => {
    const el = setupGridEl.querySelector(`.cell[data-r="${pr}"][data-c="${pc}"]`);
    if (el) el.classList.add(ok ? 'preview-ok' : 'preview-bad');
  });
}

function tryDrop(r, c) {
  const def = nextShipSpec();
  if (!def) return;
  const cells = fitsHere(deployState.board, r, c, def.size, deployState.horizontal);
  if (!cells) return;
  stampShip(deployState.board, cells);
  seas[deployState.playerNum].ships.push({ cells, size: def.size, horizontal: deployState.horizontal, sunk: false });
  sndDrop();
  deployState.currentIdx++;
  wipeGhost();
  paintShipLayer(setupShipsEl, seas[deployState.playerNum].ships, deployState.board, true);
  renderHarbor();
  if (!nextShipSpec()) setupReadyBtn.disabled = false;
}

function renderHarbor() {
  shipDockEl.innerHTML = '';
  FLEET_SPEC.forEach((def, i) => {
    const item = document.createElement('div');
    item.className = 'dock-item';
    if (i < deployState.currentIdx) item.classList.add('is-placed');
    else if (i === deployState.currentIdx) item.classList.add('is-current');
    item.innerHTML = `<span class="dock-chip" style="width:${16 + def.size * 10}px"></span><span>Корабль (${def.size})</span>`;
    shipDockEl.appendChild(item);
  });
}

document.getElementById('rotateBtn').addEventListener('click', () => {
  sndTap();
  deployState.horizontal = !deployState.horizontal;
  drawGhost();
});

document.getElementById('randomizeBtn').addEventListener('click', () => {
  sndTap();
  const remainingDefs = FLEET_SPEC.slice(deployState.currentIdx);
  autoDeployRest(deployState.board, seas[deployState.playerNum].ships, remainingDefs);
  deployState.currentIdx = FLEET_SPEC.length;
  wipeGhost();
  paintShipLayer(setupShipsEl, seas[deployState.playerNum].ships, deployState.board, true);
  renderHarbor();
  setupReadyBtn.disabled = false;
});

document.getElementById('resetPlacementBtn').addEventListener('click', () => {
  sndTap();
  openDeckFor(deployState.playerNum);
});

setupReadyBtn.addEventListener('click', () => {
  if (setupReadyBtn.disabled) return;
  sndTap();
  const justPlaced = deployState.playerNum;
  if (mode === 'cpu') {
    autoDeployRest(seas[2].grid, seas[2].ships, FLEET_SPEC);
    attacker = 1; defender = 2;
    startDuel();
  } else {
    if (justPlaced === 1) {
      showHandoff(2, () => openDeckFor(2));
    } else {
      attacker = 1; defender = 2;
      showHandoff(1, () => startDuel());
    }
  }
});

/* ---------------------------------------------------------
   ЭКРАН ПЕРЕДАЧИ УСТРОЙСТВА
   --------------------------------------------------------- */
function showHandoff(forPlayerNum, onReady) {
  switchPanel('pass');
  passMessageEl.textContent = `Передайте устройство игроку ${forPlayerNum}`;
  const btn = document.getElementById('passReadyBtn');
  btn.onclick = () => { sndTap(); onReady(); };
}

/* ---------------------------------------------------------
   БОЙ
   --------------------------------------------------------- */
function startDuel() {
  switchPanel('battle');
  gameOver = false;
  botQueue = [];
  botThinking = false;
  redrawDuel();
  announce(mode === 'cpu' ? 'Ваш ход — стреляйте по полю противника.' : `Игрок ${attacker}: ваш ход, стреляйте!`);
}

function captionFor(playerNum, isFleet) {
  if (mode === 'cpu') return isFleet ? 'Ваш флот' : 'Поле противника';
  return isFleet ? `Флот игрока ${playerNum}` : `Поле игрока ${playerNum === 1 ? 2 : 1}`;
}

function redrawDuel() {
  fleetLabelEl.textContent = captionFor(attacker, true);
  enemyLabelEl.textContent = captionFor(attacker, false);
  toggleFleetBtn.style.display = mode === 'cpu' ? 'none' : '';
  setDeckVisible(mode === 'cpu'); // vs computer there's nothing to hide from; hotseat starts each turn hidden

  buildSeaGrid(fleetGridEl, seas[attacker].grid, null);
  paintShipLayer(fleetShipsEl, seas[attacker].ships, seas[attacker].grid, true);

  buildSeaGrid(enemyGridEl, seas[defender].grid, (r, c) => handleShot(r, c));
  paintShipLayer(enemyShipsEl, seas[defender].ships, seas[defender].grid, false);
}

function buildSeaGrid(gridEl, board, onClick) {
  gridEl.innerHTML = '';
  for (let r = 0; r < GRID_N; r++) {
    for (let c = 0; c < GRID_N; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const val = board[r][c];
      if (val === 'hit') cell.classList.add('hit');
      else if (val === 'sunk') cell.classList.add('sunk');
      else if (val === 'miss') cell.classList.add('miss');
      cell.dataset.r = r;
      cell.dataset.c = c;
      if (onClick) cell.addEventListener('click', () => onClick(r, c));
      gridEl.appendChild(cell);
    }
  }
}

function handleShot(r, c) {
  if (gameOver || botThinking) return;
  const board = seas[defender].grid;
  const ships = seas[defender].ships;
  if (board[r][c] === 'hit' || board[r][c] === 'miss' || board[r][c] === 'sunk') return;

  const cellEl = enemyGridEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);

  if (board[r][c] === 'ship') {
    board[r][c] = 'hit';
    cellEl.classList.add('hit');
    fireBlast(cellEl);
    sndHit();
    const sunkShip = detectSunk(board, ships, r, c);
    if (sunkShip) {
      paintShipLayer(enemyShipsEl, ships, board, false);
      announce('Корабль потоплен!');
    } else {
      announce('Попадание! Стреляйте ещё раз.');
    }
    if (fleetDestroyed(ships)) { finishGame(attacker); return; }
  } else {
    board[r][c] = 'miss';
    cellEl.classList.add('miss');
    sndMiss();
    announce('Промах! Ход переходит.');
    passTurn();
  }
}

function passTurn() {
  if (mode === 'cpu') {
    botThinking = true;
    announce('Промах! Ход компьютера...');
    setTimeout(botMove, 700);
  } else {
    const nextActive = defender, nextDefender = attacker;
    attacker = nextActive; defender = nextDefender;
    showHandoff(attacker, () => {
      switchPanel('battle'); // was missing — this is why "Готово" seemed to do nothing between turns
      redrawDuel();
      announce(`Игрок ${attacker}: ваш ход, стреляйте!`);
    });
  }
}

/* ---- простой ИИ: случайные выстрелы, после попадания добивает рядом ---- */
function botMove() {
  if (gameOver) return;
  const board = seas[1].grid;
  const ships = seas[1].ships;
  let r, c;
  if (botQueue.length > 0) {
    [r, c] = botQueue.shift();
  } else {
    do {
      r = Math.floor(Math.random() * GRID_N);
      c = Math.floor(Math.random() * GRID_N);
    } while (board[r][c] === 'hit' || board[r][c] === 'miss' || board[r][c] === 'sunk');
  }

  const cellEl = fleetGridEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);

  if (board[r][c] === 'ship') {
    board[r][c] = 'hit';
    fireBlast(cellEl);
    cellEl.classList.add('hit');
    sndHit();
    queueNeighbors(board, r, c);
    const sunkShip = detectSunk(board, ships, r, c);
    if (sunkShip) paintShipLayer(fleetShipsEl, ships, board, true);
    if (fleetDestroyed(ships)) { finishGame(2); return; }
    announce(sunkShip ? 'Компьютер потопил ваш корабль! Его ход продолжается...' : 'Компьютер попал! Его ход продолжается...');
    setTimeout(botMove, 700);
  } else {
    board[r][c] = 'miss';
    cellEl.classList.add('miss');
    sndMiss();
    botThinking = false;
    announce('Компьютер промахнулся. Ваш ход!');
  }
}

function queueNeighbors(board, r, c) {
  const candidates = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
  for (const [nr, nc] of candidates) {
    if (nr >= 0 && nr < GRID_N && nc >= 0 && nc < GRID_N &&
        board[nr][nc] !== 'hit' && board[nr][nc] !== 'miss' && board[nr][nc] !== 'sunk') {
      botQueue.push([nr, nc]);
    }
  }
}

/* ---------------------------------------------------------
   КОНЕЦ ИГРЫ
   --------------------------------------------------------- */
function finishGame(winnerPlayerNum) {
  gameOver = true;
  setDeckVisible(true);
  paintShipLayer(fleetShipsEl, seas[attacker].ships, seas[attacker].grid, true);
  paintShipLayer(enemyShipsEl, seas[defender].ships, seas[defender].grid, true);

  let msg, isPlayerWin;
  if (mode === 'cpu') {
    isPlayerWin = winnerPlayerNum === 1;
    msg = isPlayerWin ? '🎉 Победа! Весь флот противника потоплен.' : '💀 Поражение. Ваш флот уничтожен.';
  } else {
    isPlayerWin = true;
    msg = `🏆 Игрок ${winnerPlayerNum} побеждает! Флот соперника уничтожен.`;
  }
  if (isPlayerWin) sndWin(); else sndLose();

  setTimeout(() => {
    overMessageEl.textContent = msg;
    switchPanel('over');
  }, 650);
}
