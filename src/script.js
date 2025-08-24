(function () {
  /* ========================
     1. DOM ELEMENTS
     ======================== */
  const N = 6;
  const CELL = 64,
    GAP = 8,
    STRIDE = CELL + GAP;

  const boardEl = document.getElementById('board');
  const timeEl = document.getElementById('time');
  const lastScoreEl = document.getElementById('lastScore');
  const hintBtn = document.getElementById('hintBtn');
  const hintTimerEl = document.getElementById('hintTimer');
  const undoBtn = document.getElementById('undoBtn');
  const newBtn = document.getElementById('newBtn');

  /* ========================
     2. GAME STATE
     ======================== */
  let solution = null;
  let grid = null;
  let locked = null;
  let constraints = [];
  let history = [];
  let validateTimers = {};
  let startTime = 0;
  let timerInterval = null;
  let hintCooldown = 0;

  /* ========================
     3. UTILITY FUNCTIONS
     ======================== */
  /**
   * Shuffles an array in place using the Fisher-Yates algorithm.
   * @param {Array} a - The array to shuffle.
   * @returns {Array} The shuffled array.
   */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Generates a new, valid game solution board.
   * Uses a backtracking algorithm to ensure all rules are met.
   * @returns {Array<Array<string>>} The solved game board.
   */
  function generateSolution() {
    const sol = Array.from({
      length: N
    }, () => Array(N).fill(null));
    const cells = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        cells.push([r, c]);
      }
    }
    shuffle(cells);

    /**
     * Checks if a value can be placed at a given cell without violating rules.
     * @param {number} r - Row index.
     * @param {number} c - Column index.
     * @param {string} val - The value to check ('S' or 'M').
     * @returns {boolean} True if the placement is valid, false otherwise.
     */
    function validPlace(r, c, val) {
      sol[r][c] = val;
      // Check for three-in-a-row horizontally
      for (let i = 0; i <= N - 3; i++) {
        if (sol[r][i] && sol[r][i + 1] && sol[r][i + 2] && sol[r][i] === sol[r][i + 1] && sol[r][i] === sol[r][i + 2]) {
          sol[r][c] = null;
          return false;
        }
      }
      // Check for three-in-a-row vertically
      for (let i = 0; i <= N - 3; i++) {
        if (sol[i][c] && sol[i + 1][c] && sol[i + 2][c] && sol[i][c] === sol[i + 1][c] && sol[i][c] === sol[i + 2][c]) {
          sol[r][c] = null;
          return false;
        }
      }
      // Check for more than 3 of a kind in the current row
      const sRow = sol[r].filter(x => x === 'S').length;
      const mRow = sol[r].filter(x => x === 'M').length;
      if (sRow > 3 || mRow > 3) {
        sol[r][c] = null;
        return false;
      }
      // Check for more than 3 of a kind in the current column
      let sCol = 0,
        mCol = 0;
      for (let i = 0; i < N; i++) {
        if (sol[i][c] === 'S') sCol++;
        if (sol[i][c] === 'M') mCol++;
      }
      if (sCol > 3 || mCol > 3) {
        sol[r][c] = null;
        return false;
      }
      sol[r][c] = null;
      return true;
    }

    /**
     * Backtracking function to fill the grid.
     * @param {number} idx - Current cell index.
     * @returns {boolean} True if a solution is found, false otherwise.
     */
    function backtrack(idx) {
      if (idx === cells.length) {
        // Final validation to ensure 3 of each symbol per row/column
        for (let r = 0; r < N; r++) {
          if (sol[r].filter(x => x === 'S').length !== 3) return false;
        }
        for (let c = 0; c < N; c++) {
          if (sol.map(x => x[c]).filter(x => x === 'S').length !== 3) return false;
        }
        return true;
      }

      const [r, c] = cells[idx];
      const choices = shuffle(['S', 'M']);
      for (const ch of choices) {
        if (validPlace(r, c, ch)) {
          sol[r][c] = ch;
          if (backtrack(idx + 1)) return true;
          sol[r][c] = null;
        }
      }
      return false;
    }

    backtrack(0);
    return sol;
  }

  /**
   * Randomly selects a number of clue cells to be locked.
   * @param {Array<Array<string>>} sol - The solution board.
   * @returns {Array<Array<boolean>>} A boolean grid indicating locked cells.
   */
  function pickClues(sol) {
    const min = 7,
      max = 9,
      k = Math.floor(Math.random() * (max - min + 1)) + min;
    const pos = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        pos.push([r, c]);
      }
    }
    shuffle(pos);
    const lock = Array.from({
      length: N
    }, () => Array(N).fill(false));
    for (let i = 0; i < k; i++) {
      const [r, c] = pos[i];
      lock[r][c] = true;
    }
    return lock;
  }

  /**
   * Generates a set of constraints for the puzzle.
   * @param {Array<Array<string>>} sol - The solution board.
   * @returns {Array<Object>} An array of constraint objects.
   */
  function pickConstraints(sol) {
    const cons = [];
    const candidates = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (c + 1 < N) candidates.push({
          r1: r,
          c1: c,
          r2: r,
          c2: c + 1
        });
        if (r + 1 < N) candidates.push({
          r1: r,
          c1: c,
          r2: r + 1,
          c2: c
        });
      }
    }
    shuffle(candidates);
    for (const cand of candidates) {
      if (cons.length >= 7) break;
      if (Math.random() > 0.22) continue;
      const t = sol[cand.r1][cand.c1] === sol[cand.r2][cand.c2] ? '=' : 'X';
      cons.push({ ...cand,
        type: t
      });
    }
    return cons;
  }

  /**
   * Resets the game and generates a new puzzle.
   */
  function newPuzzle() {
    solution = generateSolution();
    locked = pickClues(solution);
    constraints = pickConstraints(solution);
    grid = Array.from({
      length: N
    }, (_, r) => Array.from({
      length: N
    }, (_, c) => locked[r][c] ? solution[r][c] : null));
    history = [];
    clearInterval(timerInterval);
    startTime = Date.now();
    timerInterval = setInterval(updateTime, 300);
    hintCooldown = 0;
    updateHintUI();
    render();
  }

  /**
   * Renders the game board and constraints on the page.
   */
  function render() {
    boardEl.innerHTML = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        if ((Math.floor(r / 2) + Math.floor(c / 2)) % 2 === 0) {
          cell.classList.add('shade');
        }
        if (locked[r][c]) {
          cell.classList.add('locked');
        }
        const v = grid[r][c];
        if (v === 'S') {
          cell.classList.add('s');
          cell.textContent = '☀️';
        } else if (v === 'M') {
          cell.classList.add('m');
          cell.textContent = '🌙';
        }
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (!locked[r][c]) {
          cell.addEventListener('click', onCellClick);
          cell.addEventListener('contextmenu', onCellRightClick);
        }
        boardEl.appendChild(cell);
      }
    }

    // Draw constraints using precise centers
    constraints.forEach(con => {
      const el = document.createElement('div');
      el.className = 'conn';
      el.textContent = con.type;
      el.dataset.r1 = con.r1;
      el.dataset.c1 = con.c1;
      el.dataset.r2 = con.r2;
      el.dataset.c2 = con.c2;
      const x1 = con.c1 * STRIDE + CELL / 2;
      const y1 = con.r1 * STRIDE + CELL / 2;
      const x2 = con.c2 * STRIDE + CELL / 2;
      const y2 = con.r2 * STRIDE + CELL / 2;
      el.style.left = ((x1 + x2) / 2) + 'px';
      el.style.top = ((y1 + y2) / 2) + 'px';
      boardEl.appendChild(el);
    });
  }

  /**
   * Handles click events on a cell, cycling through states.
   * @param {Event} e - The click event.
   */
  function onCellClick(e) {
    const r = +this.dataset.r;
    const c = +this.dataset.c;
    history.push(JSON.stringify(grid));
    grid[r][c] = grid[r][c] === null ? 'S' : grid[r][c] === 'S' ? 'M' : null;
    render();
    scheduleValidate(r, c);
  }

  /**
   * Handles right-click events on a cell to clear its value.
   * @param {Event} e - The context menu event.
   */
  function onCellRightClick(e) {
    e.preventDefault();
    const r = +this.dataset.r;
    const c = +this.dataset.c;
    history.push(JSON.stringify(grid));
    grid[r][c] = null;
    render();
    scheduleValidate(r, c);
  }

  /**
   * Schedules a delayed validation check to avoid multiple checks on rapid clicks.
   * @param {number} r - Row index.
   * @param {number} c - Column index.
   */
  function scheduleValidate(r, c) {
    const key = r + ',' + c;
    if (validateTimers[key]) clearTimeout(validateTimers[key]);
    validateTimers[key] = setTimeout(() => {
      validate();
      delete validateTimers[key];
      checkSolved();
    }, 1000);
  }

  /**
   * Validates the current board state against all rules and flashes errors.
   */
  function validate() {
    document.querySelectorAll('.cell').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.conn').forEach(el => el.classList.remove('bad'));

    // Check row rules
    for (let r = 0; r < N; r++) {
      const row = grid[r];
      if (row.filter(x => x === 'S').length > 3 || row.filter(x => x === 'M').length > 3) {
        flashRow(r);
      }
      for (let i = 0; i <= N - 3; i++) {
        if (row[i] && row[i] === row[i + 1] && row[i] === row[i + 2]) {
          flashRow(r);
        }
      }
    }
    // Check column rules
    for (let c = 0; c < N; c++) {
      const col = grid.map(x => x[c]);
      if (col.filter(x => x === 'S').length > 3 || col.filter(x => x === 'M').length > 3) {
        flashCol(c);
      }
      for (let i = 0; i <= N - 3; i++) {
        if (col[i] && col[i] === col[i + 1] && col[i] === col[i + 2]) {
          flashCol(c);
        }
      }
    }
    // Check constraints
    constraints.forEach(con => {
      const v1 = grid[con.r1][con.c1],
        v2 = grid[con.r2][con.c2];
      if (v1 && v2) {
        if (con.type === '=' && v1 !== v2) {
          markConn(con);
        }
        if (con.type === 'X' && v1 === v2) {
          markConn(con);
        }
      }
    });
  }

  /**
   * Adds an 'error' class to all cells in a row, then removes it.
   * @param {number} r - Row index.
   */
  function flashRow(r) {
    for (let c = 0; c < N; c++) {
      const el = boardEl.children[r * N + c];
      if (el) el.classList.add('error');
    }
    setTimeout(() => {
      for (let c = 0; c < N; c++) {
        const el = boardEl.children[r * N + c];
        if (el) el.classList.remove('error');
      }
    }, 900);
  }

  /**
   * Adds an 'error' class to all cells in a column, then removes it.
   * @param {number} c - Column index.
   */
  function flashCol(c) {
    for (let r = 0; r < N; r++) {
      const el = boardEl.children[r * N + c];
      if (el) el.classList.add('error');
    }
    setTimeout(() => {
      for (let r = 0; r < N; r++) {
        const el = boardEl.children[r * N + c];
        if (el) el.classList.remove('error');
      }
    }, 900);
  }

  /**
   * Marks a constraint connector as 'bad' then unmarks it.
   * @param {Object} con - The constraint object.
   */
  function markConn(con) {
    const sel = `.conn[data-r1="${con.r1}"][data-c1="${con.c1}"][data-r2="${con.r2}"][data-c2="${con.c2}"]`;
    const el = boardEl.querySelector(sel);
    if (el) {
      el.classList.add('bad');
      setTimeout(() => el.classList.remove('bad'), 900);
    }
  }

  /**
   * Updates the game timer display.
   */
  function updateTime() {
    const s = Math.floor((Date.now() - startTime) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    timeEl.textContent = mm + ':' + ss;
  }

  /**
   * Checks if the puzzle is completely solved.
   * @returns {boolean} True if the puzzle is solved, false otherwise.
   */
  function checkSolved() {
    // Check all cells are filled
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!grid[r][c]) return false;
      }
    }
    // Check row rules
    for (let r = 0; r < N; r++) {
      const row = grid[r];
      if (row.filter(x => x === 'S').length !== 3 || row.filter(x => x === 'M').length !== 3) return false;
      for (let i = 0; i <= N - 3; i++) {
        if (row[i] && row[i] === row[i + 1] && row[i] === row[i + 2]) return false;
      }
    }
    // Check column rules
    for (let c = 0; c < N; c++) {
      const col = grid.map(x => x[c]);
      if (col.filter(x => x === 'S').length !== 3 || col.filter(x => x === 'M').length !== 3) return false;
      for (let i = 0; i <= N - 3; i++) {
        if (col[i] && col[i] === col[i + 1] && col[i] === col[i + 2]) return false;
      }
    }
    // Check constraints
    for (const con of constraints) {
      const v1 = grid[con.r1][con.c1],
        v2 = grid[con.r2][con.c2];
      if (con.type === '=' && v1 !== v2) return false;
      if (con.type === 'X' && v1 === v2) return false;
    }

    // If all checks pass, the puzzle is solved
    const finalSec = Math.floor((Date.now() - startTime) / 1000);
    lastScoreEl.textContent = formatTime(finalSec);
    document.querySelectorAll('.cell').forEach((el, i) => {
      el.style.transition = 'transform .6s cubic-bezier(.2,.9,.2,1)';
      setTimeout(() => el.style.transform = 'scale(1.08)', i * 40);
      setTimeout(() => el.style.transform = '', 700 + i * 40);
    });
    setTimeout(() => {
      newPuzzle();
    }, 1200);
    return true;
  }

  /**
   * Formats seconds into a MM:SS string.
   * @param {number} s - Time in seconds.
   * @returns {string} The formatted time string.
   */
  function formatTime(s) {
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return mm + ':' + ss;
  }

  /**
   * Updates the hint button's UI based on the cooldown.
   */
  function updateHintUI() {
    if (hintCooldown > 0) {
      hintBtn.classList.add('disabled');
      hintBtn.disabled = true;
      hintTimerEl.textContent = hintCooldown;
    } else {
      hintBtn.classList.remove('disabled');
      hintBtn.disabled = false;
      hintTimerEl.textContent = '20';
    }
  }

  /**
   * Starts the hint cooldown timer.
   */
  function startHintCooldown() {
    hintCooldown = 20;
    updateHintUI();
    const t = setInterval(() => {
      hintCooldown--;
      updateHintUI();
      if (hintCooldown <= 0) {
        clearInterval(t);
      }
    }, 1000);
  }

  /* ========================
     4. EVENT LISTENERS
     ======================== */
  hintBtn.addEventListener('click', () => {
    if (hintCooldown > 0) return;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!locked[r][c] && grid[r][c] !== solution[r][c]) {
          history.push(JSON.stringify(grid));
          grid[r][c] = solution[r][c];
          locked[r][c] = true;
          render();
          scheduleValidate(r, c);
          startHintCooldown();
          return;
        }
      }
    }
  });

  undoBtn.addEventListener('click', () => {
    if (history.length) {
      grid = JSON.parse(history.pop());
      render();
    }
  });

  newBtn.addEventListener('click', () => {
    newPuzzle();
  });

  /* ========================
     5. INITIALIZATION
     ======================== */
  newPuzzle();
})();


function getCssVariable(name) {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue(name));
}
