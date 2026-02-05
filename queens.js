// ==UserScript==
// @name         LinkedIn Queens Auto Solver
// @namespace    queens-autosolver
// @version      1.1
// @match        https://www.linkedin.com/games/queens*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function waitForBoard() {
        return new Promise(resolve => {
            // First check if board already exists
            const existingBoard = document.querySelector('[data-testid="interactive-grid"]');
            if (existingBoard) {
                console.log('[Queens] Board already exists');
                resolve(existingBoard);
                return;
            }

            // Otherwise wait for it via MutationObserver
            console.log('[Queens] Waiting for board...');
            const obs = new MutationObserver(() => {
                const board = document.querySelector('[data-testid="interactive-grid"]');
                if (board) {
                    console.log('[Queens] Board found via observer');
                    obs.disconnect();
                    resolve(board);
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });

            // Also poll as a fallback (React apps can be tricky)
            const poll = setInterval(() => {
                const board = document.querySelector('[data-testid="interactive-grid"]');
                if (board) {
                    console.log('[Queens] Board found via polling');
                    clearInterval(poll);
                    obs.disconnect();
                    resolve(board);
                }
            }, 500);
        });
    }

    function parseBoard(board) {
        const cells = [...board.querySelectorAll('[data-cell-idx]')];
        const size = Math.sqrt(cells.length);

        console.log(`[Queens] Found ${cells.length} cells, board size: ${size}x${size}`);

        const regionMap = new Map();
        let regionId = 0;

        const regions = Array(cells.length).fill(null);

        cells.forEach(cell => {
            const idx = +cell.dataset.cellIdx;
            const label = cell.getAttribute("aria-label");
            const color = label?.match(/color ([^,]+)/)?.[1];

            if (!color) {
                console.warn(`[Queens] Could not parse color from label: "${label}" for cell ${idx}`);
                return;
            }

            if (!regionMap.has(color)) {
                regionMap.set(color, regionId++);
            }
            regions[idx] = regionMap.get(color);
        });

        console.log('[Queens] Regions:', regionMap);
        console.log('[Queens] Region assignments:', regions);

        return { size, regions };
    }

    function solveQueens(size, regions) {
        const solution = Array(size).fill(-1);
        const usedCols = new Set();
        const usedRegions = new Set();

        function safe(row, col) {
            for (let r = 0; r < row; r++) {
                const c = solution[r];

                // ONLY adjacent diagonal conflict
                if (Math.abs(r - row) === 1 && Math.abs(c - col) === 1) {
                    return false;
                }
            }
            return true;
        }


        function backtrack(row) {
            if (row === size) return true;

            for (let col = 0; col < size; col++) {
                const idx = row * size + col;
                const region = regions[idx];

                if (usedCols.has(col) || usedRegions.has(region)) continue;
                if (!safe(row, col)) continue;

                solution[row] = col;
                usedCols.add(col);
                usedRegions.add(region);

                if (backtrack(row + 1)) return true;

                usedCols.delete(col);
                usedRegions.delete(region);
            }
            return false;
        }

        backtrack(0);
        return solution.map((col, row) => row * size + col);
    }

    async function clickSolution(indices) {
        console.log('[Queens] Clicking solution cells:', indices);
        for (const idx of indices) {
            const cell = document.querySelector(`[data-cell-idx="${idx}"]`);
            if (cell) {
                console.log(`[Queens] Clicking cell ${idx}`);
                // Try multiple click methods for React compatibility
                cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
                cell.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
                cell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                cell.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                cell.click();
                await sleep(50);
            } else {
                console.warn(`[Queens] Cell ${idx} not found!`);
            }
        }
        console.log('[Queens] Done clicking!');
    }

    (async function run() {
        console.log('[Queens] Script starting...');
        const board = await waitForBoard();
        await sleep(300); // let React settle

        const { size, regions } = parseBoard(board);
        console.log('[Queens] Solving...');
        const solution = solveQueens(size, regions);
        console.log('[Queens] Solution (cell indices):', solution);

        // Visualize solution
        const grid = [];
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                row.push(solution.includes(r * size + c) ? 'Q' : '.');
            }
            grid.push(row.join(' '));
        }
        console.log('[Queens] Solution grid:\n' + grid.join('\n'));

        await clickSolution(solution);
    })();
})();
