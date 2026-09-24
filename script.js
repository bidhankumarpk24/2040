(() => {
  'use strict';
  const SIZE = 4, WIN = 2048;
  const storage = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : v; } catch (_) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (_) {} }
  };

  let board = [], score = 0, best = Number(storage.get('2048-best', 0)) || 0, previous = null, won = false, ended = false, sound = storage.get('2048-sound', 'on') !== 'off';
  const $ = id => document.getElementById(id), boardEl = $('board'), scoreEl = $('score'), bestEl = $('best'), statusEl = $('status-line'), modal = $('modal');
  const randomTile = () => Math.random() < .9 ? 2 : 4;

  function setupModal() {
    // Keep the modal hidden on initial page load. The stylesheet's backdrop rule
    // can otherwise override the browser's default [hidden] behavior.
    modal.hidden = true;
    modal.style.display = 'none';

    const dialog = modal.querySelector('.modal');
    if (!dialog) return;
    dialog.setAttribute('aria-describedby', 'modal-message');

    let close = dialog.querySelector('.modal-close');
    if (!close) {
      close = document.createElement('button');
      close.className = 'modal-close';
      close.type = 'button';
      close.setAttribute('aria-label', 'Close');
      close.innerHTML = '&times;';
      dialog.appendChild(close);
    }
    close.onclick = closeModal;

    let actions = dialog.querySelector('.modal-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'modal-actions';
      dialog.appendChild(actions);
    }

    let retry = actions.querySelector('.modal-retry');
    if (!retry) {
      retry = document.createElement('button');
      retry.className = 'primary-button modal-retry';
      retry.type = 'button';
      retry.textContent = 'Try Again';
      actions.appendChild(retry);
    }
    retry.onclick = newGame;

    modal.onclick = event => {
      if (event.target === modal) closeModal();
    };
  }

  function emptyCells() {
    const cells = [];
    board.forEach((row, r) => row.forEach((v, c) => { if (!v) cells.push([r, c]); }));
    return cells;
  }

  function addTile() {
    const cells = emptyCells();
    if (!cells.length) return;
    const [r, c] = cells[Math.floor(Math.random() * cells.length)];
    board[r][c] = randomTile();
  }

  function newGame() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    score = 0;
    previous = null;
    won = false;
    ended = false;
    addTile();
    addTile();
    closeModal();
    update();
  }

  function restore(state) {
    board = state.board.map(row => row.slice());
    score = state.score;
    won = state.won;
    ended = false;
    closeModal();
    update();
  }

  function slide(line) {
    const values = line.filter(Boolean), result = [];
    let gain = 0;
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        const value = values[i] * 2;
        result.push(value);
        gain += value;
        i++;
      } else result.push(values[i]);
    }
    while (result.length < SIZE) result.push(0);
    score += gain;
    return { result, gain };
  }

  function move(direction) {
    if (ended) return false;
    const before = board.map(row => row.slice()), scoreBefore = score;
    let changed = false, merged = false;
    if (direction === 'left' || direction === 'right') {
      for (let r = 0; r < SIZE; r++) {
        const original = board[r].slice();
        let line = original.slice();
        if (direction === 'right') line.reverse();
        const out = slide(line);
        if (direction === 'right') out.result.reverse();
        if (JSON.stringify(original) !== JSON.stringify(out.result)) changed = true;
        if (out.gain) merged = true;
        board[r] = out.result;
      }
    } else {
      for (let c = 0; c < SIZE; c++) {
        const original = board.map(row => row[c]);
        let line = original.slice();
        if (direction === 'down') line.reverse();
        const out = slide(line);
        if (direction === 'down') out.result.reverse();
        if (JSON.stringify(original) !== JSON.stringify(out.result)) changed = true;
        if (out.gain) merged = true;
        for (let r = 0; r < SIZE; r++) board[r][c] = out.result[r];
      }
    }
    if (!changed) { score = scoreBefore; return false; }
    previous = { board: before, score: scoreBefore, won };
    addTile();
    if (score > best) { best = score; storage.set('2048-best', best); }
    render(merged);
    updateScore();
    if (!won && board.some(row => row.includes(WIN))) { won = true; showWin(); }
    else if (!canMove()) { ended = true; showGameOver(); }
    return true;
  }

  function canMove() {
    if (emptyCells().length) return true;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if ((r < 3 && board[r][c] === board[r + 1][c]) || (c < 3 && board[r][c] === board[r][c + 1])) return true;
    }
    return false;
  }

  function render(merged = false) {
    boardEl.innerHTML = '';
    board.forEach(row => row.forEach(value => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', value ? `Tile ${value}` : 'Empty cell');
      cell.textContent = value || '';
      if (value) cell.classList.add(`tile-${value}`);
      if (merged && value) cell.classList.add('merged');
      boardEl.appendChild(cell);
    }));
  }

  function updateScore() { scoreEl.textContent = score; bestEl.textContent = best; }
  function update() { updateScore(); $('undo').disabled = !previous; render(); }

  function showWin() {
    $('modal-icon').textContent = '✦';
    $('modal-title').textContent = 'You reached 2048!';
    $('modal-message').textContent = "Congratulations! You've mastered the board.";
    $('modal-score').textContent = `Score: ${score}`;
    modal.hidden = false;
    modal.style.display = 'grid';
  }

  function showGameOver() {
    $('modal-icon').textContent = '◇';
    $('modal-title').textContent = 'Game Over';
    $('modal-message').textContent = 'No more moves. Try again!';
    $('modal-score').textContent = `Final score: ${score}`;
    modal.hidden = false;
    modal.style.display = 'grid';
  }

  function closeModal() { modal.hidden = true; modal.style.display = 'none'; }
  function beep(freq = 440) {
    if (!sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(), osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.frequency.value = freq; gain.gain.value = .02; osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .06);
    } catch (_) {}
  }
  function share() {
    const text = `I scored ${score} points in 2048 Master! Can you beat my score?`;
    if (navigator.share) navigator.share({ title: '2048 Master', text }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  }

  document.addEventListener('keydown', e => {
    const keys = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', w:'up', a:'left', s:'down', d:'right', Escape:'close' };
    if (e.key === 'Escape') { closeModal(); return; }
    const dir = keys[e.key];
    if (dir) { e.preventDefault(); if (move(dir)) beep(); }
  });

  let touchStart = null;
  boardEl.addEventListener('touchstart', e => { const t = e.changedTouches[0]; touchStart = { x:t.clientX, y:t.clientY }; }, { passive:true });
  boardEl.addEventListener('touchend', e => {
    if (!touchStart) return;
    const t = e.changedTouches[0], dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 30) {
      const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (move(direction)) beep();
    }
    touchStart = null;
  });

  $('new-game').onclick = newGame;
  $('undo').onclick = () => { if (previous) restore(previous); };
  $('share').onclick = share;
  $('theme-toggle').onclick = () => {
    const light = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    storage.set('2048-theme', light ? 'light' : 'dark');
    $('theme-toggle').textContent = light ? '☾' : '☼';
  };
  const savedTheme = storage.get('2048-theme', 'dark');
  document.documentElement.dataset.theme = savedTheme;
  $('theme-toggle').textContent = savedTheme === 'light' ? '☾' : '☼';
  $('sound-toggle').onclick = () => { sound = !sound; storage.set('2048-sound', sound ? 'on' : 'off'); $('sound-toggle').textContent = sound ? '🔊' : '🔇'; };
  $('sound-toggle').textContent = sound ? '🔊' : '🔇';

  setupModal();
  newGame();
})();
