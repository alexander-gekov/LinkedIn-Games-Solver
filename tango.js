// ==UserScript==
// @name         LinkedIn Tango Solver
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Auto-solve LinkedIn Tango (Moon/Sun) puzzle
// @author       You
// @match        https://www.linkedin.com/games/tango*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Constants
    const GRID_SIZE = 6;
    const EMPTY = null;
    const SUN = 0;
    const MOON = 1; // cell-one

    // Wait for game to load
    function waitForGame() {
        return new Promise((resolve) => {
            // First check if grid already exists
            const existingGrid = document.querySelector('[data-testid="interactive-grid"]');
            if (existingGrid) {
                console.log('[Tango] Grid already exists');
                resolve(existingGrid);
                return;
            }

            // Otherwise poll for it
            console.log('[Tango] Waiting for grid...');
            const check = () => {
                const grid = document.querySelector('[data-testid="interactive-grid"]');
                if (grid) {
                    console.log('[Tango] Grid found via polling');
                    resolve(grid);
                } else {
                    setTimeout(check, 500);
                }
            };
            check();
        });
    }

    // Parse the current game state
    function parseGameState() {
        const cells = [];
        const hints = [];

        // Initialize empty grid
        for (let r = 0; r < GRID_SIZE; r++) {
            cells[r] = [];
            hints[r] = [];
            for (let c = 0; c < GRID_SIZE; c++) {
                cells[r][c] = EMPTY;
                hints[r][c] = { value: EMPTY, rightHint: null, bottomHint: null };
            }
        }

        // Parse cells
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cellEl = document.getElementById(`tango-cell-${i}`);
            if (!cellEl) continue;

            const r = Math.floor(i / GRID_SIZE);
            const c = i % GRID_SIZE;

            // Check cell value
            const innerCell = cellEl.querySelector('[data-testid="cell-zero"], [data-testid="cell-one"], [data-testid="cell-empty"]');
            if (innerCell) {
                const testId = innerCell.getAttribute('data-testid');
                if (testId === 'cell-zero') {
                    cells[r][c] = SUN;
                    hints[r][c].value = SUN;
                } else if (testId === 'cell-one') {
                    cells[r][c] = MOON;
                    hints[r][c].value = MOON;
                }
            }
        }

        // Parse edge constraints (= and ×)
        const edgeElements = document.querySelectorAll('[data-testid="edge-equal"], [data-testid="edge-cross"]');
        edgeElements.forEach(edge => {
            const isEqual = edge.getAttribute('data-testid') === 'edge-equal';
            const hintType = isEqual ? '=' : 'x';

            // Find the parent cell to determine position
            const parentCell = edge.closest('[id^="tango-cell-"]');
            if (!parentCell) {
                // Edge might be positioned between cells, find adjacent cells
                const rect = edge.getBoundingClientRect();
                const allCells = document.querySelectorAll('[id^="tango-cell-"]');

                let closestCell = null;
                let minDist = Infinity;

                allCells.forEach(cell => {
                    const cellRect = cell.getBoundingClientRect();
                    const cellCenterX = cellRect.left + cellRect.width / 2;
                    const cellCenterY = cellRect.top + cellRect.height / 2;
                    const edgeCenterX = rect.left + rect.width / 2;
                    const edgeCenterY = rect.top + rect.height / 2;

                    const dist = Math.sqrt(
                        Math.pow(cellCenterX - edgeCenterX, 2) +
                        Math.pow(cellCenterY - edgeCenterY, 2)
                    );

                    if (dist < minDist) {
                        minDist = dist;
                        closestCell = cell;
                    }
                });

                if (closestCell) {
                    const idx = parseInt(closestCell.id.replace('tango-cell-', ''));
                    const r = Math.floor(idx / GRID_SIZE);
                    const c = idx % GRID_SIZE;

                    const cellRect = closestCell.getBoundingClientRect();
                    const edgeRect = edge.getBoundingClientRect();
                    const edgeCenterX = edgeRect.left + edgeRect.width / 2;
                    const edgeCenterY = edgeRect.top + edgeRect.height / 2;

                    // Determine if horizontal (right) or vertical (bottom)
                    if (edgeCenterX > cellRect.right - 5 && c < GRID_SIZE - 1) {
                        hints[r][c].rightHint = hintType;
                    } else if (edgeCenterY > cellRect.bottom - 5 && r < GRID_SIZE - 1) {
                        hints[r][c].bottomHint = hintType;
                    }
                }
                return;
            }

            const idx = parseInt(parentCell.id.replace('tango-cell-', ''));
            const r = Math.floor(idx / GRID_SIZE);
            const c = idx % GRID_SIZE;

            // Determine direction based on CSS classes or position
            const edgeRect = edge.getBoundingClientRect();
            const cellRect = parentCell.getBoundingClientRect();

            const edgeCenterX = edgeRect.left + edgeRect.width / 2;
            const edgeCenterY = edgeRect.top + edgeRect.height / 2;
            const cellCenterX = cellRect.left + cellRect.width / 2;
            const cellCenterY = cellRect.top + cellRect.height / 2;

            // If edge is to the right of cell center, it's a right hint
            // If edge is below cell center, it's a bottom hint
            if (Math.abs(edgeCenterX - cellCenterX) > Math.abs(edgeCenterY - cellCenterY)) {
                // Horizontal
                if (edgeCenterX > cellCenterX && c < GRID_SIZE - 1) {
                    hints[r][c].rightHint = hintType;
                } else if (edgeCenterX < cellCenterX && c > 0) {
                    hints[r][c - 1].rightHint = hintType;
                }
            } else {
                // Vertical
                if (edgeCenterY > cellCenterY && r < GRID_SIZE - 1) {
                    hints[r][c].bottomHint = hintType;
                } else if (edgeCenterY < cellCenterY && r > 0) {
                    hints[r - 1][c].bottomHint = hintType;
                }
            }
        });

        return { cells, hints };
    }

    // Solve the puzzle using logic
    function solve(hints) {
        const working = hints.map(row => row.map(cell => cell.value));
        let changed = true;
        let iterations = 0;
        const maxIterations = 100;

        while (changed && iterations < maxIterations) {
            changed = false;
            iterations++;

            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    if (working[r][c] !== EMPTY) continue;

                    // Triple avoidance - horizontal
                    if (c >= 2 && working[r][c - 1] === working[r][c - 2] && working[r][c - 1] !== EMPTY) {
                        working[r][c] = 1 - working[r][c - 1];
                        changed = true;
                        continue;
                    }
                    if (c <= GRID_SIZE - 3 && working[r][c + 1] === working[r][c + 2] && working[r][c + 1] !== EMPTY) {
                        working[r][c] = 1 - working[r][c + 1];
                        changed = true;
                        continue;
                    }
                    // Gap filling: X _ X pattern
                    if (c >= 1 && c <= GRID_SIZE - 2 &&
                        working[r][c - 1] !== EMPTY && working[r][c + 1] !== EMPTY &&
                        working[r][c - 1] === working[r][c + 1]) {
                        working[r][c] = 1 - working[r][c - 1];
                        changed = true;
                        continue;
                    }

                    // Triple avoidance - vertical
                    if (r >= 2 && working[r - 1][c] === working[r - 2][c] && working[r - 1][c] !== EMPTY) {
                        working[r][c] = 1 - working[r - 1][c];
                        changed = true;
                        continue;
                    }
                    if (r <= GRID_SIZE - 3 && working[r + 1][c] === working[r + 2][c] && working[r + 1][c] !== EMPTY) {
                        working[r][c] = 1 - working[r + 1][c];
                        changed = true;
                        continue;
                    }
                    // Gap filling: X _ X pattern (vertical)
                    if (r >= 1 && r <= GRID_SIZE - 2 &&
                        working[r - 1][c] !== EMPTY && working[r + 1][c] !== EMPTY &&
                        working[r - 1][c] === working[r + 1][c]) {
                        working[r][c] = 1 - working[r - 1][c];
                        changed = true;
                        continue;
                    }

                    // Row completion
                    const rowVals = working[r].filter(v => v !== EMPTY);
                    if (rowVals.filter(v => v === MOON).length === GRID_SIZE / 2) {
                        working[r][c] = SUN;
                        changed = true;
                        continue;
                    }
                    if (rowVals.filter(v => v === SUN).length === GRID_SIZE / 2) {
                        working[r][c] = MOON;
                        changed = true;
                        continue;
                    }

                    // Column completion
                    const colVals = working.map(row => row[c]).filter(v => v !== EMPTY);
                    if (colVals.filter(v => v === MOON).length === GRID_SIZE / 2) {
                        working[r][c] = SUN;
                        changed = true;
                        continue;
                    }
                    if (colVals.filter(v => v === SUN).length === GRID_SIZE / 2) {
                        working[r][c] = MOON;
                        changed = true;
                        continue;
                    }
                }
            }

            // Equality/opposite hints propagation
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    const hint = hints[r][c];

                    // Right hint
                    if (hint.rightHint && c < GRID_SIZE - 1) {
                        const leftVal = working[r][c];
                        const rightVal = working[r][c + 1];

                        if (leftVal !== EMPTY && rightVal === EMPTY) {
                            working[r][c + 1] = hint.rightHint === '=' ? leftVal : (1 - leftVal);
                            changed = true;
                        } else if (rightVal !== EMPTY && leftVal === EMPTY) {
                            working[r][c] = hint.rightHint === '=' ? rightVal : (1 - rightVal);
                            changed = true;
                        }
                    }

                    // Bottom hint
                    if (hint.bottomHint && r < GRID_SIZE - 1) {
                        const topVal = working[r][c];
                        const bottomVal = working[r + 1][c];

                        if (topVal !== EMPTY && bottomVal === EMPTY) {
                            working[r + 1][c] = hint.bottomHint === '=' ? topVal : (1 - topVal);
                            changed = true;
                        } else if (bottomVal !== EMPTY && topVal === EMPTY) {
                            working[r][c] = hint.bottomHint === '=' ? bottomVal : (1 - bottomVal);
                            changed = true;
                        }
                    }
                }
            }
        }

        // If basic logic didn't solve it, try backtracking
        const emptyCells = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (working[r][c] === EMPTY) {
                    emptyCells.push({ r, c });
                }
            }
        }

        if (emptyCells.length > 0) {
            console.log(`Logic solved ${GRID_SIZE * GRID_SIZE - emptyCells.length} cells, ${emptyCells.length} remaining. Trying backtracking...`);
            const solved = backtrack(working, hints, emptyCells, 0);
            if (!solved) {
                console.error('Could not solve puzzle with backtracking');
            }
        }

        return working;
    }

    // Backtracking solver for remaining cells
    function backtrack(grid, hints, emptyCells, idx) {
        if (idx >= emptyCells.length) {
            return isValidComplete(grid, hints);
        }

        const { r, c } = emptyCells[idx];

        for (const val of [SUN, MOON]) {
            grid[r][c] = val;
            if (isValidPartial(grid, hints, r, c)) {
                if (backtrack(grid, hints, emptyCells, idx + 1)) {
                    return true;
                }
            }
        }

        grid[r][c] = EMPTY;
        return false;
    }

    // Check if current placement is valid
    function isValidPartial(grid, hints, r, c) {
        const val = grid[r][c];

        // Check triple rule horizontally
        if (c >= 2 && grid[r][c - 1] === val && grid[r][c - 2] === val) return false;
        if (c >= 1 && c < GRID_SIZE - 1 && grid[r][c - 1] === val && grid[r][c + 1] === val) return false;
        if (c < GRID_SIZE - 2 && grid[r][c + 1] === val && grid[r][c + 2] === val) return false;

        // Check triple rule vertically
        if (r >= 2 && grid[r - 1][c] === val && grid[r - 2][c] === val) return false;
        if (r >= 1 && r < GRID_SIZE - 1 && grid[r - 1][c] === val && grid[r + 1][c] === val) return false;
        if (r < GRID_SIZE - 2 && grid[r + 1][c] === val && grid[r + 2][c] === val) return false;

        // Check row count
        const rowCount = grid[r].filter(v => v === val).length;
        if (rowCount > GRID_SIZE / 2) return false;

        // Check column count
        const colCount = grid.map(row => row[c]).filter(v => v === val).length;
        if (colCount > GRID_SIZE / 2) return false;

        // Check hint constraints
        const hint = hints[r][c];

        if (hint.rightHint && c < GRID_SIZE - 1 && grid[r][c + 1] !== EMPTY) {
            const expected = hint.rightHint === '=' ? val : (1 - val);
            if (grid[r][c + 1] !== expected) return false;
        }

        if (hint.bottomHint && r < GRID_SIZE - 1 && grid[r + 1][c] !== EMPTY) {
            const expected = hint.bottomHint === '=' ? val : (1 - val);
            if (grid[r + 1][c] !== expected) return false;
        }

        // Check hints from adjacent cells pointing to this cell
        if (c > 0 && hints[r][c - 1].rightHint && grid[r][c - 1] !== EMPTY) {
            const expected = hints[r][c - 1].rightHint === '=' ? grid[r][c - 1] : (1 - grid[r][c - 1]);
            if (val !== expected) return false;
        }

        if (r > 0 && hints[r - 1][c].bottomHint && grid[r - 1][c] !== EMPTY) {
            const expected = hints[r - 1][c].bottomHint === '=' ? grid[r - 1][c] : (1 - grid[r - 1][c]);
            if (val !== expected) return false;
        }

        return true;
    }

    // Check if complete grid is valid
    function isValidComplete(grid, hints) {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (grid[r][c] === EMPTY) return false;
                if (!isValidPartial(grid, hints, r, c)) return false;
            }
        }
        return true;
    }

    // Helper: random delay for human-like behavior
    function randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Helper: sleep function
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Apply solution to the game like a human
    async function applySolution(solution) {
        console.log('[Tango] Starting to fill in solution...');

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const idx = r * GRID_SIZE + c;
                const cellEl = document.getElementById(`tango-cell-${idx}`);

                if (!cellEl) continue;

                // Skip pre-filled cells (aria-disabled="true")
                if (cellEl.getAttribute('aria-disabled') === 'true') {
                    continue;
                }

                const targetValue = solution[r][c];
                if (targetValue === EMPTY) continue;

                // Get current cell state
                const getCurrentValue = () => {
                    const innerEl = cellEl.querySelector('[data-testid="cell-zero"], [data-testid="cell-one"], [data-testid="cell-empty"]');
                    if (!innerEl) return EMPTY;
                    const testId = innerEl.getAttribute('data-testid');
                    if (testId === 'cell-zero') return SUN;
                    if (testId === 'cell-one') return MOON;
                    return EMPTY;
                };

                let currentValue = getCurrentValue();

                // Skip if already correct
                if (currentValue === targetValue) continue;

                // Click cycle: empty → sun → moon → empty → ...
                // 1 click from empty = sun
                // 2 clicks from empty = moon
                const clicksNeeded = targetValue === SUN ? 1 : 2;

                console.log(`[Tango] Cell [${r},${c}]: clicking ${clicksNeeded}x for ${targetValue === SUN ? 'SUN' : 'MOON'}`);

                for (let i = 0; i < clicksNeeded; i++) {
                    // Human-like delay before each click
                    await sleep(randomDelay(80, 200));

                    // Simulate mouse events for more realistic interaction
                    const rect = cellEl.getBoundingClientRect();
                    const x = rect.left + rect.width / 2;
                    const y = rect.top + rect.height / 2;

                    // Try PointerEvents first (React often uses these)
                    cellEl.dispatchEvent(new PointerEvent('pointerdown', {
                        bubbles: true,
                        cancelable: true,
                        pointerId: 1,
                        pointerType: 'mouse',
                        clientX: x,
                        clientY: y
                    }));

                    cellEl.dispatchEvent(new PointerEvent('pointerup', {
                        bubbles: true,
                        cancelable: true,
                        pointerId: 1,
                        pointerType: 'mouse',
                        clientX: x,
                        clientY: y
                    }));

                    // Also dispatch MouseEvents
                    cellEl.dispatchEvent(new MouseEvent('mousedown', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: x,
                        clientY: y
                    }));

                    cellEl.dispatchEvent(new MouseEvent('mouseup', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: x,
                        clientY: y
                    }));

                    cellEl.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: x,
                        clientY: y
                    }));

                    // Also try native click
                    cellEl.click();

                    // Small delay between multiple clicks on same cell
                    if (i < clicksNeeded - 1) {
                        await sleep(randomDelay(100, 200));
                    }
                }

                // Delay before moving to next cell
                await sleep(randomDelay(150, 350));
            }
        }

        console.log('[Tango] Solution complete!');
    }

    // Create UI button
    function createSolveButton() {
        const btn = document.createElement('button');
        btn.textContent = '🧩 Solve Tango';
        btn.style.cssText = `
              position: fixed;
              top: 80px;
              right: 20px;
              z-index: 99999;
              padding: 12px 20px;
              background: linear-gradient(135deg, #0077b5, #00a0dc);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              font-weight: bold;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              transition: transform 0.2s, box-shadow 0.2s;
          `;

        btn.onmouseover = () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        };
        btn.onmouseout = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        };

        btn.onclick = async () => {
            btn.textContent = '⏳ Solving...';
            btn.disabled = true;

            try {
                console.log('[Tango] Parsing game state...');
                const { hints } = parseGameState();
                console.log('[Tango] Parsed hints:', hints);

                console.log('[Tango] Solving puzzle...');
                const solution = solve(hints);
                console.log('[Tango] Solution:');
                console.table(solution.map(row => row.map(v => v === SUN ? '☀️' : v === MOON ? '🌙' : '·')));

                await applySolution(solution);

                btn.textContent = '✅ Solved!';
                setTimeout(() => {
                    btn.textContent = '🧩 Solve Tango';
                    btn.disabled = false;
                }, 2000);
            } catch (error) {
                console.error('[Tango] Solver error:', error);
                btn.textContent = '❌ Error';
                setTimeout(() => {
                    btn.textContent = '🧩 Solve Tango';
                    btn.disabled = false;
                }, 2000);
            }
        };

        document.body.appendChild(btn);
    }

    // Initialize
    async function init() {
        console.log('[Tango] LinkedIn Tango Solver loading...');
        await waitForGame();
        console.log('[Tango] Game detected! Adding solve button...');
        createSolveButton();
    }

    // Start when page is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
