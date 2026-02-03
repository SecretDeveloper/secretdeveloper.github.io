const gridEl = document.getElementById("grid");
const statusEl = document.getElementById("status");
const stepLogEl = document.getElementById("stepLog");
const solveBtn = document.getElementById("solveBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const loadBtn = document.getElementById("loadBtn");
const stepBtn = document.getElementById("stepBtn");
const resetBtn = document.getElementById("resetBtn");
const undoBtn = document.getElementById("undoBtn");
const generateBtn = document.getElementById("generateBtn");
const difficultySelect = document.getElementById("difficultySelect");
const hintBtn = document.getElementById("hintBtn");
const hintText = document.getElementById("hintText");
const candidatesToggle = document.getElementById("candidatesToggle");
const modeInputs = document.querySelectorAll('input[name="editMode"]');

const SIZE = 9;
const state = {
  inputs: [],
  cellGrid: [],
  candidateMap: new Map(),
  manualCandidates: new Map(),
  autoEliminations: new Map(),
  prefilled: new Set(),
  editMode: "number",
  baseStepSnapshot: null,
  stepHistory: [],
  undoStack: [],
  pendingHint: null,
  activeInput: null,
};


const solver = {
  isValid(board, row, col, value) {
    for (let i = 0; i < SIZE; i += 1) {
      if (board[row][i] === value || board[i][col] === value) {
        return false;
      }
    }

    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = startRow; r < startRow + 3; r += 1) {
      for (let c = startCol; c < startCol + 3; c += 1) {
        if (board[r][c] === value) return false;
      }
    }

    return true;
  },

  solve(board) {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] === 0) {
          for (let num = 1; num <= 9; num += 1) {
            if (solver.isValid(board, row, col, num)) {
              board[row][col] = num;
              if (solver.solve(board)) return true;
              board[row][col] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  },

  getAutoCandidates(board, autoElims) {
    const map = new Map();
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] !== 0) continue;
        const options = [];
        const eliminated = autoElims.get(`${row},${col}`) || new Set();
        for (let num = 1; num <= 9; num += 1) {
          if (eliminated.has(num)) continue;
          if (solver.isValid(board, row, col, num)) options.push(num);
        }
        map.set(`${row},${col}`, options);
      }
    }
    return map;
  },

  findStep(board, autoElims) {
    const candidates = solver.getAutoCandidates(board, autoElims);

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] !== 0) continue;
        const key = `${row},${col}`;
        const options = candidates.get(key) || [];
        if (options.length === 1) {
          const evidence = `Only candidate for R${row + 1}C${col + 1} is ${options[0]}.`;
          return {
            row,
            col,
            value: options[0],
            tactic: "Naked single",
            evidence,
          };
        }
      }
    }

    for (let row = 0; row < SIZE; row += 1) {
      const found = solver.findHiddenSingle(board, candidates, { row });
      if (found) return found;
    }
    for (let col = 0; col < SIZE; col += 1) {
      const found = solver.findHiddenSingle(board, candidates, { col });
      if (found) return found;
    }
    for (let boxRow = 0; boxRow < 3; boxRow += 1) {
      for (let boxCol = 0; boxCol < 3; boxCol += 1) {
        const found = solver.findHiddenSingle(board, candidates, { boxRow, boxCol });
        if (found) return found;
      }
    }

    for (let size = 2; size <= 4; size += 1) {
      const found = solver.findNakedSet(board, candidates, size);
      if (found) return found;
    }

    for (let size = 2; size <= 4; size += 1) {
      const found = solver.findHiddenSet(board, candidates, size);
      if (found) return found;
    }

    const pointing = solver.findPointingPair(board, candidates);
    if (pointing) return pointing;

    const claiming = solver.findClaimingPair(board, candidates);
    if (claiming) return claiming;

    const xwing = solver.findFish(board, candidates, 2);
    if (xwing) return xwing;

    const swordfish = solver.findFish(board, candidates, 3);
    if (swordfish) return swordfish;

    const jellyfish = solver.findFish(board, candidates, 4);
    if (jellyfish) return jellyfish;

    const xywing = solver.findXYWing(board, candidates);
    if (xywing) return xywing;

    const xyzwing = solver.findXYZWing(board, candidates);
    if (xyzwing) return xyzwing;

    const wwing = solver.findWWing(board, candidates);
    if (wwing) return wwing;

    const skyscraper = solver.findSkyscraper(board, candidates);
    if (skyscraper) return skyscraper;

    return null;
  },

  findHiddenSingle(board, candidates, scope) {
    for (let num = 1; num <= 9; num += 1) {
      const positions = [];
      for (let row = 0; row < SIZE; row += 1) {
        for (let col = 0; col < SIZE; col += 1) {
          if (board[row][col] !== 0) continue;
          if (scope.row !== undefined && scope.row !== row) continue;
          if (scope.col !== undefined && scope.col !== col) continue;
          if (
            scope.boxRow !== undefined &&
            (Math.floor(row / 3) !== scope.boxRow || Math.floor(col / 3) !== scope.boxCol)
          ) {
            continue;
          }
          const key = `${row},${col}`;
          const options = candidates.get(key) || [];
          if (options.includes(num)) positions.push({ row, col });
        }
      }
      if (positions.length === 1) {
        const unit =
          scope.row !== undefined
            ? `row ${scope.row + 1}`
            : scope.col !== undefined
              ? `column ${scope.col + 1}`
              : `box ${scope.boxRow + 1},${scope.boxCol + 1}`;
        const evidence = `In ${unit}, only R${positions[0].row + 1}C${
          positions[0].col + 1
        } can take ${num}.`;
        return {
          row: positions[0].row,
          col: positions[0].col,
          value: num,
          tactic: scope.row !== undefined
            ? "Hidden single (row)"
            : scope.col !== undefined
              ? "Hidden single (column)"
              : "Hidden single (box)",
          evidence,
        };
      }
    }
    return null;
  },

  findNakedSet(board, candidates, size) {
    const units = solver.getUnits();
    for (const unit of units) {
      const buckets = new Map();
      unit.forEach(({ row, col }) => {
        if (board[row][col] !== 0) return;
        const options = candidates.get(`${row},${col}`) || [];
        if (options.length !== size) return;
        const key = options.join(",");
        const list = buckets.get(key) || [];
        list.push({ row, col });
        buckets.set(key, list);
      });

      for (const [key, cells] of buckets.entries()) {
        const nums = key.split(",").map(Number);
        if (cells.length !== size) continue;
        const eliminations = [];
        unit.forEach(({ row, col }) => {
          if (cells.find((cell) => cell.row === row && cell.col === col)) return;
          if (board[row][col] !== 0) return;
          const options = candidates.get(`${row},${col}`) || [];
          nums.forEach((num) => {
            if (options.includes(num)) eliminations.push({ row, col, num });
          });
        });
        if (eliminations.length > 0) {
          const scope = solver.describeUnit(unit);
          return {
            tactic: `Naked set (${size})`,
            evidence: `In ${scope}, cells ${cells
              .map((cell) => `R${cell.row + 1}C${cell.col + 1}`)
              .join(", ")} only contain {${nums.join(", ")}}. Removed these numbers from other cells in ${scope}.`,
            eliminations,
          };
        }
      }
    }
    return null;
  },

  findHiddenSet(board, candidates, size) {
    const units = solver.getUnits();
    for (const unit of units) {
      const numberToCells = new Map();
      for (let num = 1; num <= 9; num += 1) {
        numberToCells.set(num, []);
      }
      unit.forEach(({ row, col }) => {
        if (board[row][col] !== 0) return;
        const options = candidates.get(`${row},${col}`) || [];
        options.forEach((num) => {
          numberToCells.get(num).push({ row, col });
        });
      });

      const nums = Array.from({ length: 9 }, (_, i) => i + 1);
      const combos = solver.combinations(nums, size);
      for (const combo of combos) {
        const cells = [];
        let validCombo = true;
        combo.forEach((num) => {
          const hits = numberToCells.get(num);
          if (!hits || hits.length === 0) {
            validCombo = false;
            return;
          }
          hits.forEach((cell) => {
            if (!cells.find((c) => c.row === cell.row && c.col === cell.col)) {
              cells.push(cell);
            }
          });
        });
        if (!validCombo) continue;
        if (cells.length !== size) continue;
        const eliminations = [];
        cells.forEach(({ row, col }) => {
          const options = candidates.get(`${row},${col}`) || [];
          options.forEach((num) => {
            if (!combo.includes(num)) eliminations.push({ row, col, num });
          });
        });
        if (eliminations.length > 0) {
          const scope = solver.describeUnit(unit);
          const perNumber = combo
            .map((num) => {
              const hits = numberToCells.get(num) || [];
              const cellsText = hits
                .map((cell) => `R${cell.row + 1}C${cell.col + 1}`)
                .join(", ");
              return `${num} in ${cellsText}`;
            })
            .join("; ");
          return {
            tactic: `Hidden set (${size})`,
            evidence: `In ${scope}, candidates {${combo.join(", ")}} are confined to cells ${cells
              .map((cell) => `R${cell.row + 1}C${cell.col + 1}`)
              .join(", ")}. (${perNumber}) Removed other candidates from those cells.`,
            eliminations,
          };
        }
      }
    }
    return null;
  },

  findPointingPair(board, candidates) {
    for (let boxRow = 0; boxRow < 3; boxRow += 1) {
      for (let boxCol = 0; boxCol < 3; boxCol += 1) {
        const cells = [];
        for (let r = boxRow * 3; r < boxRow * 3 + 3; r += 1) {
          for (let c = boxCol * 3; c < boxCol * 3 + 3; c += 1) {
            if (board[r][c] === 0) cells.push({ row: r, col: c });
          }
        }
        for (let num = 1; num <= 9; num += 1) {
          const hits = cells.filter(({ row, col }) =>
            (candidates.get(`${row},${col}`) || []).includes(num)
          );
          if (hits.length < 2 || hits.length > 3) continue;
          const sameRow = hits.every((cell) => cell.row === hits[0].row);
          const sameCol = hits.every((cell) => cell.col === hits[0].col);
          const eliminations = [];
          if (sameRow) {
            const row = hits[0].row;
            for (let col = 0; col < SIZE; col += 1) {
              if (Math.floor(col / 3) === boxCol) continue;
              if (board[row][col] !== 0) continue;
              const options = candidates.get(`${row},${col}`) || [];
              if (options.includes(num)) eliminations.push({ row, col, num });
            }
          } else if (sameCol) {
            const col = hits[0].col;
            for (let row = 0; row < SIZE; row += 1) {
              if (Math.floor(row / 3) === boxRow) continue;
              if (board[row][col] !== 0) continue;
              const options = candidates.get(`${row},${col}`) || [];
              if (options.includes(num)) eliminations.push({ row, col, num });
            }
          }
          if (eliminations.length > 0) {
            const scope = `box ${boxRow + 1},${boxCol + 1}`;
            const line = sameRow
              ? `row ${hits[0].row + 1}`
              : `column ${hits[0].col + 1}`;
            const hitCells = hits
              .map((cell) => `R${cell.row + 1}C${cell.col + 1}`)
              .join(", ");
            const eliminationCells = Array.from(
              new Set(eliminations.map(({ row, col }) => `R${row + 1}C${col + 1}`))
            ).join(", ");
            return {
              tactic: "Pointing pair/triple",
              evidence: `In ${scope}, candidate ${num} appears only in ${hitCells} (${line}). Removed ${num} from ${eliminationCells} in ${line}.`,
              eliminations,
            };
          }
        }
      }
    }
    return null;
  },

  findClaimingPair(board, candidates) {
    // Row-based claiming
    for (let row = 0; row < SIZE; row += 1) {
      for (let num = 1; num <= 9; num += 1) {
        const hits = [];
        for (let col = 0; col < SIZE; col += 1) {
          if (board[row][col] !== 0) continue;
          const options = candidates.get(`${row},${col}`) || [];
          if (options.includes(num)) hits.push({ row, col });
        }
        if (hits.length < 2) continue;
        const boxRow = Math.floor(hits[0].row / 3);
        const boxCol = Math.floor(hits[0].col / 3);
        const sameBox = hits.every(
          (cell) =>
            Math.floor(cell.row / 3) === boxRow &&
            Math.floor(cell.col / 3) === boxCol
        );
        if (!sameBox) continue;
        const eliminations = [];
        for (let r = boxRow * 3; r < boxRow * 3 + 3; r += 1) {
          for (let c = boxCol * 3; c < boxCol * 3 + 3; c += 1) {
            if (r === row) continue;
            if (board[r][c] !== 0) continue;
            const options = candidates.get(`${r},${c}`) || [];
            if (options.includes(num)) eliminations.push({ row: r, col: c, num });
          }
        }
        if (eliminations.length > 0) {
          const hitCells = hits.map((cell) => `R${cell.row + 1}C${cell.col + 1}`).join(", ");
          return {
            tactic: "Claiming pair/triple (row)",
            evidence: `In row ${row + 1}, candidate ${num} is confined to ${hitCells} in box ${
              boxRow + 1
            },${boxCol + 1}. Removed ${num} from other cells in that box.`,
            eliminations,
          };
        }
      }
    }

    // Column-based claiming
    for (let col = 0; col < SIZE; col += 1) {
      for (let num = 1; num <= 9; num += 1) {
        const hits = [];
        for (let row = 0; row < SIZE; row += 1) {
          if (board[row][col] !== 0) continue;
          const options = candidates.get(`${row},${col}`) || [];
          if (options.includes(num)) hits.push({ row, col });
        }
        if (hits.length < 2) continue;
        const boxRow = Math.floor(hits[0].row / 3);
        const boxCol = Math.floor(hits[0].col / 3);
        const sameBox = hits.every(
          (cell) =>
            Math.floor(cell.row / 3) === boxRow &&
            Math.floor(cell.col / 3) === boxCol
        );
        if (!sameBox) continue;
        const eliminations = [];
        for (let r = boxRow * 3; r < boxRow * 3 + 3; r += 1) {
          for (let c = boxCol * 3; c < boxCol * 3 + 3; c += 1) {
            if (c === col) continue;
            if (board[r][c] !== 0) continue;
            const options = candidates.get(`${r},${c}`) || [];
            if (options.includes(num)) eliminations.push({ row: r, col: c, num });
          }
        }
        if (eliminations.length > 0) {
          const hitCells = hits.map((cell) => `R${cell.row + 1}C${cell.col + 1}`).join(", ");
          return {
            tactic: "Claiming pair/triple (column)",
            evidence: `In column ${col + 1}, candidate ${num} is confined to ${hitCells} in box ${
              boxRow + 1
            },${boxCol + 1}. Removed ${num} from other cells in that box.`,
            eliminations,
          };
        }
      }
    }
    return null;
  },

  findFish(board, candidates, size) {
    const numToRows = Array.from({ length: 9 }, () => []);
    for (let num = 1; num <= 9; num += 1) {
      numToRows[num - 1] = [];
      for (let row = 0; row < SIZE; row += 1) {
        const cols = [];
        for (let col = 0; col < SIZE; col += 1) {
          if (board[row][col] !== 0) continue;
          const options = candidates.get(`${row},${col}`) || [];
          if (options.includes(num)) cols.push(col);
        }
        if (cols.length > 0 && cols.length <= size) {
          numToRows[num - 1].push({ row, cols });
        }
      }
    }

    for (let num = 1; num <= 9; num += 1) {
      const rows = numToRows[num - 1];
      const combos = solver.combinations(rows, size);
      for (const combo of combos) {
        const cols = new Set();
        combo.forEach((entry) => entry.cols.forEach((c) => cols.add(c)));
        if (cols.size !== size) continue;
        const eliminations = [];
        cols.forEach((col) => {
          for (let row = 0; row < SIZE; row += 1) {
            if (combo.find((entry) => entry.row === row)) continue;
            if (board[row][col] !== 0) continue;
            const options = candidates.get(`${row},${col}`) || [];
            if (options.includes(num)) eliminations.push({ row, col, num });
          }
        });
        if (eliminations.length > 0) {
          const fishName = size === 2 ? "X-Wing" : size === 3 ? "Swordfish" : "Jellyfish";
          const rowList = combo.map((entry) => entry.row + 1).join(", ");
          const colList = Array.from(cols).map((c) => c + 1).join(", ");
          return {
            tactic: fishName,
            evidence: `${fishName} on ${num}: rows ${rowList} align on columns ${colList}. Removed ${num} from other cells in those columns.`,
            eliminations,
          };
        }
      }
    }

    // Column-based fish
    const numToCols = Array.from({ length: 9 }, () => []);
    for (let num = 1; num <= 9; num += 1) {
      numToCols[num - 1] = [];
      for (let col = 0; col < SIZE; col += 1) {
        const rows = [];
        for (let row = 0; row < SIZE; row += 1) {
          if (board[row][col] !== 0) continue;
          const options = candidates.get(`${row},${col}`) || [];
          if (options.includes(num)) rows.push(row);
        }
        if (rows.length > 0 && rows.length <= size) {
          numToCols[num - 1].push({ col, rows });
        }
      }
    }

    for (let num = 1; num <= 9; num += 1) {
      const cols = numToCols[num - 1];
      const combos = solver.combinations(cols, size);
      for (const combo of combos) {
        const rows = new Set();
        combo.forEach((entry) => entry.rows.forEach((r) => rows.add(r)));
        if (rows.size !== size) continue;
        const eliminations = [];
        rows.forEach((row) => {
          for (let col = 0; col < SIZE; col += 1) {
            if (combo.find((entry) => entry.col === col)) continue;
            if (board[row][col] !== 0) continue;
            const options = candidates.get(`${row},${col}`) || [];
            if (options.includes(num)) eliminations.push({ row, col, num });
          }
        });
        if (eliminations.length > 0) {
          const fishName = size === 2 ? "X-Wing" : size === 3 ? "Swordfish" : "Jellyfish";
          const colList = combo.map((entry) => entry.col + 1).join(", ");
          const rowList = Array.from(rows).map((r) => r + 1).join(", ");
          return {
            tactic: fishName,
            evidence: `${fishName} on ${num}: columns ${colList} align on rows ${rowList}. Removed ${num} from other cells in those rows.`,
            eliminations,
          };
        }
      }
    }

    return null;
  },

  findXYWing(board, candidates) {
    const bivalueCells = [];
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] !== 0) continue;
        const options = candidates.get(`${row},${col}`) || [];
        if (options.length === 2) {
          bivalueCells.push({ row, col, options });
        }
      }
    }

    for (const pivot of bivalueCells) {
      const [x, y] = pivot.options;
      const wingsX = bivalueCells.filter(
        (cell) =>
          cell !== pivot &&
          solver.sees(pivot, cell) &&
          cell.options.includes(x) &&
          !cell.options.includes(y)
      );
      const wingsY = bivalueCells.filter(
        (cell) =>
          cell !== pivot &&
          solver.sees(pivot, cell) &&
          cell.options.includes(y) &&
          !cell.options.includes(x)
      );

      for (const wingX of wingsX) {
        const z = wingX.options.find((n) => n !== x);
        for (const wingY of wingsY) {
          const z2 = wingY.options.find((n) => n !== y);
          if (z !== z2) continue;
          if (wingX.row === wingY.row && wingX.col === wingY.col) continue;
          const eliminations = [];
          for (let row = 0; row < SIZE; row += 1) {
            for (let col = 0; col < SIZE; col += 1) {
              if (board[row][col] !== 0) continue;
              const options = candidates.get(`${row},${col}`) || [];
              if (!options.includes(z)) continue;
              const cell = { row, col };
              if (solver.sees(cell, wingX) && solver.sees(cell, wingY)) {
                eliminations.push({ row, col, num: z });
              }
            }
          }
          if (eliminations.length > 0) {
            return {
              tactic: "XY-Wing",
              evidence: `XY-Wing with pivot R${pivot.row + 1}C${pivot.col + 1} (${x}/${y}) and wings R${wingX.row + 1}C${wingX.col + 1} (${x}/${z}) and R${wingY.row + 1}C${wingY.col + 1} (${y}/${z}). Removed ${z} from cells seeing both wings.`,
              eliminations,
            };
          }
        }
      }
    }
    return null;
  },

  findXYZWing(board, candidates) {
    const pivotCells = [];
    const bivalueCells = [];
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] !== 0) continue;
        const options = candidates.get(`${row},${col}`) || [];
        if (options.length === 3) {
          pivotCells.push({ row, col, options });
        } else if (options.length === 2) {
          bivalueCells.push({ row, col, options });
        }
      }
    }

    for (const pivot of pivotCells) {
      const [a, b, c] = pivot.options;
      const wingPairs = [
        { x: a, y: b, z: c },
        { x: a, y: c, z: b },
        { x: b, y: c, z: a },
      ];
      for (const { x, y, z } of wingPairs) {
        const wingX = bivalueCells.filter(
          (cell) =>
            solver.sees(pivot, cell) &&
            cell.options.includes(x) &&
            cell.options.includes(z)
        );
        const wingY = bivalueCells.filter(
          (cell) =>
            solver.sees(pivot, cell) &&
            cell.options.includes(y) &&
            cell.options.includes(z)
        );
        for (const w1 of wingX) {
          for (const w2 of wingY) {
            if (w1.row === w2.row && w1.col === w2.col) continue;
            const eliminations = [];
            for (let row = 0; row < SIZE; row += 1) {
              for (let col = 0; col < SIZE; col += 1) {
                if (board[row][col] !== 0) continue;
                const options = candidates.get(`${row},${col}`) || [];
                if (!options.includes(z)) continue;
                const cell = { row, col };
                if (
                  solver.sees(cell, pivot) &&
                  solver.sees(cell, w1) &&
                  solver.sees(cell, w2)
                ) {
                  eliminations.push({ row, col, num: z });
                }
              }
            }
            if (eliminations.length > 0) {
              return {
                tactic: "XYZ-Wing",
                evidence: `XYZ-Wing with pivot R${pivot.row + 1}C${pivot.col + 1} (${a}/${b}/${c}) and wings R${w1.row + 1}C${w1.col + 1} (${x}/${z}) and R${w2.row + 1}C${w2.col + 1} (${y}/${z}). Removed ${z} from cells seeing all three.`,
                eliminations,
              };
            }
          }
        }
      }
    }
    return null;
  },

  findWWing(board, candidates) {
    const bivalueCells = [];
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] !== 0) continue;
        const options = candidates.get(`${row},${col}`) || [];
        if (options.length === 2) {
          bivalueCells.push({ row, col, options });
        }
      }
    }

    for (let i = 0; i < bivalueCells.length; i += 1) {
      for (let j = i + 1; j < bivalueCells.length; j += 1) {
        const a = bivalueCells[i];
        const b = bivalueCells[j];
        if (
          a.options[0] !== b.options[0] ||
          a.options[1] !== b.options[1]
        ) {
          continue;
        }
        const [x, y] = a.options;
        const strong = solver.findStrongLink(board, candidates, x, a, b);
        if (!strong) continue;
        const eliminations = [];
        for (let row = 0; row < SIZE; row += 1) {
          for (let col = 0; col < SIZE; col += 1) {
            if (board[row][col] !== 0) continue;
            const options = candidates.get(`${row},${col}`) || [];
            if (!options.includes(y)) continue;
            const cell = { row, col };
            if (solver.sees(cell, a) && solver.sees(cell, b)) {
              eliminations.push({ row, col, num: y });
            }
          }
        }
        if (eliminations.length > 0) {
          return {
            tactic: "W-Wing",
            evidence: `W-Wing with bivalue cells R${a.row + 1}C${a.col + 1} and R${b.row + 1}C${b.col + 1} on {${x}, ${y}} using a strong link on ${x}. Removed ${y} from cells seeing both.`,
            eliminations,
          };
        }
      }
    }
    return null;
  },

  findSkyscraper(board, candidates) {
    // Row-based skyscraper
    for (let num = 1; num <= 9; num += 1) {
      const rows = [];
      for (let row = 0; row < SIZE; row += 1) {
        const cols = [];
        for (let col = 0; col < SIZE; col += 1) {
          if (board[row][col] !== 0) continue;
          const options = candidates.get(`${row},${col}`) || [];
          if (options.includes(num)) cols.push(col);
        }
        if (cols.length === 2) rows.push({ row, cols });
      }
      for (let i = 0; i < rows.length; i += 1) {
        for (let j = i + 1; j < rows.length; j += 1) {
          const a = rows[i];
          const b = rows[j];
          const shared = a.cols.filter((c) => b.cols.includes(c));
          if (shared.length !== 1) continue;
          const roofA = a.cols.find((c) => c !== shared[0]);
          const roofB = b.cols.find((c) => c !== shared[0]);
          const roofCellA = { row: a.row, col: roofA };
          const roofCellB = { row: b.row, col: roofB };
          const eliminations = [];
          for (let row = 0; row < SIZE; row += 1) {
            for (let col = 0; col < SIZE; col += 1) {
              if (board[row][col] !== 0) continue;
              const options = candidates.get(`${row},${col}`) || [];
              if (!options.includes(num)) continue;
              const cell = { row, col };
              if (solver.sees(cell, roofCellA) && solver.sees(cell, roofCellB)) {
                eliminations.push({ row, col, num });
              }
            }
          }
          if (eliminations.length > 0) {
            return {
              tactic: "Skyscraper",
              evidence: `Skyscraper on ${num} using rows ${a.row + 1} and ${b.row + 1}. Removed ${num} from cells seeing both roofs.`,
              eliminations,
            };
          }
        }
      }
    }

    // Column-based skyscraper
    for (let num = 1; num <= 9; num += 1) {
      const cols = [];
      for (let col = 0; col < SIZE; col += 1) {
        const rows = [];
        for (let row = 0; row < SIZE; row += 1) {
          if (board[row][col] !== 0) continue;
          const options = candidates.get(`${row},${col}`) || [];
          if (options.includes(num)) rows.push(row);
        }
        if (rows.length === 2) cols.push({ col, rows });
      }
      for (let i = 0; i < cols.length; i += 1) {
        for (let j = i + 1; j < cols.length; j += 1) {
          const a = cols[i];
          const b = cols[j];
          const shared = a.rows.filter((r) => b.rows.includes(r));
          if (shared.length !== 1) continue;
          const roofA = a.rows.find((r) => r !== shared[0]);
          const roofB = b.rows.find((r) => r !== shared[0]);
          const roofCellA = { row: roofA, col: a.col };
          const roofCellB = { row: roofB, col: b.col };
          const eliminations = [];
          for (let row = 0; row < SIZE; row += 1) {
            for (let col = 0; col < SIZE; col += 1) {
              if (board[row][col] !== 0) continue;
              const options = candidates.get(`${row},${col}`) || [];
              if (!options.includes(num)) continue;
              const cell = { row, col };
              if (solver.sees(cell, roofCellA) && solver.sees(cell, roofCellB)) {
                eliminations.push({ row, col, num });
              }
            }
          }
          if (eliminations.length > 0) {
            return {
              tactic: "Skyscraper",
              evidence: `Skyscraper on ${num} using columns ${a.col + 1} and ${b.col + 1}. Removed ${num} from cells seeing both roofs.`,
              eliminations,
            };
          }
        }
      }
    }

    return null;
  },

  findStrongLink(board, candidates, num, cellA, cellB) {
    if (cellA.row === cellB.row) {
      const row = cellA.row;
      const hits = [];
      for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] !== 0) continue;
        const options = candidates.get(`${row},${col}`) || [];
        if (options.includes(num)) hits.push({ row, col });
      }
      if (hits.length === 2) {
        return hits.some((c) => c.row === cellA.row && c.col === cellA.col) &&
          hits.some((c) => c.row === cellB.row && c.col === cellB.col);
      }
    }
    if (cellA.col === cellB.col) {
      const col = cellA.col;
      const hits = [];
      for (let row = 0; row < SIZE; row += 1) {
        if (board[row][col] !== 0) continue;
        const options = candidates.get(`${row},${col}`) || [];
        if (options.includes(num)) hits.push({ row, col });
      }
      if (hits.length === 2) {
        return hits.some((c) => c.row === cellA.row && c.col === cellA.col) &&
          hits.some((c) => c.row === cellB.row && c.col === cellB.col);
      }
    }
    const sameBox =
      Math.floor(cellA.row / 3) === Math.floor(cellB.row / 3) &&
      Math.floor(cellA.col / 3) === Math.floor(cellB.col / 3);
    if (sameBox) {
      const boxRow = Math.floor(cellA.row / 3);
      const boxCol = Math.floor(cellA.col / 3);
      const hits = [];
      for (let r = boxRow * 3; r < boxRow * 3 + 3; r += 1) {
        for (let c = boxCol * 3; c < boxCol * 3 + 3; c += 1) {
          if (board[r][c] !== 0) continue;
          const options = candidates.get(`${r},${c}`) || [];
          if (options.includes(num)) hits.push({ row: r, col: c });
        }
      }
      if (hits.length === 2) {
        return hits.some((c) => c.row === cellA.row && c.col === cellA.col) &&
          hits.some((c) => c.row === cellB.row && c.col === cellB.col);
      }
    }
    return false;
  },

  sees(a, b) {
    return (
      a.row === b.row ||
      a.col === b.col ||
      (Math.floor(a.row / 3) === Math.floor(b.row / 3) &&
        Math.floor(a.col / 3) === Math.floor(b.col / 3))
    );
  },

  getUnits() {
    return getAllUnits();
  },

  describeUnit(unit) {
    const rows = new Set(unit.map((cell) => cell.row));
    const cols = new Set(unit.map((cell) => cell.col));
    if (rows.size === 1) return `row ${[...rows][0] + 1}`;
    if (cols.size === 1) return `column ${[...cols][0] + 1}`;
    const row = unit[0].row;
    const col = unit[0].col;
    return `box ${Math.floor(row / 3) + 1},${Math.floor(col / 3) + 1}`;
  },

  combinations(items, size) {
    if (size === 1) return items.map((item) => [item]);
    const result = [];
    for (let i = 0; i <= items.length - size; i += 1) {
      const head = items[i];
      const tailCombos = solver.combinations(items.slice(i + 1), size - 1);
      tailCombos.forEach((combo) => result.push([head, ...combo]));
    }
    return result;
  },
};

const DIFFICULTY_TARGETS = {
  easy: { minClues: 36, maxClues: 45 },
  medium: { minClues: 30, maxClues: 35 },
  hard: { minClues: 24, maxClues: 31 },
};

function getRowUnit(row) {
  return Array.from({ length: SIZE }, (_, col) => ({ row, col }));
}

function getColUnit(col) {
  return Array.from({ length: SIZE }, (_, row) => ({ row, col }));
}

function getBoxUnit(boxRow, boxCol) {
  const unit = [];
  for (let r = boxRow * 3; r < boxRow * 3 + 3; r += 1) {
    for (let c = boxCol * 3; c < boxCol * 3 + 3; c += 1) {
      unit.push({ row: r, col: c });
    }
  }
  return unit;
}

function getAllUnits() {
  const units = [];
  for (let row = 0; row < SIZE; row += 1) {
    units.push(getRowUnit(row));
  }
  for (let col = 0; col < SIZE; col += 1) {
    units.push(getColUnit(col));
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      units.push(getBoxUnit(boxRow, boxCol));
    }
  }
  return units;
}

function buildGrid() {
  gridEl.innerHTML = "";
  state.inputs = [];
  state.cellGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  state.candidateMap.clear();
  state.manualCandidates.clear();
  state.autoEliminations.clear();
  state.prefilled.clear();
  resetStepHistory();
  clearCandidateChanges();
  clearHighlights();
  resetUndoHistory();
  let delay = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.animationDelay = `${delay}ms`;

      const input = document.createElement("input");
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("maxlength", "1");
      input.dataset.row = row;
      input.dataset.col = col;

      input.addEventListener("input", handleInput);
      input.addEventListener("blur", validateGrid);
      input.addEventListener("focus", handleFocus);
      input.addEventListener("blur", clearHighlights);
      input.addEventListener("keydown", handleKeydown);

      const candidates = document.createElement("div");
      candidates.className = "candidates";
      for (let i = 1; i <= 9; i += 1) {
        const span = document.createElement("span");
        span.textContent = "";
        candidates.appendChild(span);
      }

      cell.appendChild(input);
      cell.appendChild(candidates);
      gridEl.appendChild(cell);
      state.inputs.push(input);
      state.cellGrid[row][col] = input;
      state.candidateMap.set(input, candidates);
      state.manualCandidates.set(input, new Set());
      delay += 4;
    }
  }
}

function refreshUI({ validate = true, highlight = true, candidates = true } = {}) {
  if (validate) validateGrid();
  if (highlight) {
    const active = document.activeElement;
    if (active && active.tagName === "INPUT") {
      highlightForInput(active);
    }
  }
  if (candidates) updateCandidates();
}

function clearHint() {
  state.pendingHint = null;
  hintText.textContent = "";
  state.inputs.forEach((input) => {
    input.parentElement.classList.remove("hint-target");
  });
}

function generatePuzzle(difficulty) {
  const target = DIFFICULTY_TARGETS[difficulty] || DIFFICULTY_TARGETS.medium;
  const maxAttempts = 50;
  let best = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const solution = generateFullSolution();
    const puzzle = carvePuzzle(solution, target);
    const rating = ratePuzzle(puzzle);
    const clues = countClues(puzzle);
    const inRange = clues >= target.minClues && clues <= target.maxClues;
    const score = (rating === difficulty ? 2 : 0) + (inRange ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = puzzle;
    }
    if (score === 3) return puzzle;
  }
  return best;
}

function generateFullSolution() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  if (!solveRandom(board)) return null;
  return board;
}

function solveRandom(board) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] === 0) {
        const nums = shuffle(Array.from({ length: 9 }, (_, i) => i + 1));
        for (const num of nums) {
          if (solver.isValid(board, row, col, num)) {
            board[row][col] = num;
            if (solveRandom(board)) return true;
            board[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function carvePuzzle(solution, target) {
  if (!solution) return null;
  const board = solution.map((row) => row.slice());
  const cells = shuffle(
    Array.from({ length: SIZE * SIZE }, (_, i) => ({
      row: Math.floor(i / 9),
      col: i % 9,
    }))
  );
  let clues = 81;

  for (const { row, col } of cells) {
    if (clues <= target.minClues) break;
    const backup = board[row][col];
    board[row][col] = 0;
    if (countSolutions(board, 2) !== 1) {
      board[row][col] = backup;
      continue;
    }
    clues -= 1;
  }

  return board;
}

function countClues(puzzle) {
  return puzzle.flat().filter((value) => value !== 0).length;
}

function countSolutions(board, limit = 2) {
  let count = 0;
  function search() {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] === 0) {
          for (let num = 1; num <= 9; num += 1) {
            if (solver.isValid(board, row, col, num)) {
              board[row][col] = num;
              search();
              if (count >= limit) {
                board[row][col] = 0;
                return;
              }
              board[row][col] = 0;
            }
          }
          return;
        }
      }
    }
    count += 1;
  }
  search();
  return count;
}

function ratePuzzle(puzzle) {
  const board = puzzle.map((row) => row.slice());
  const autoElims = new Map();
  let hardest = "easy";
  let progressed = true;
  let guard = 0;

  while (progressed && guard < 500) {
    guard += 1;
    progressed = false;
    const step = solver.findStep(board, autoElims);
    if (!step) break;
    progressed = true;
    if (step.tactic.startsWith("Naked single") || step.tactic.startsWith("Hidden single")) {
      // easy
    } else if (
      step.tactic.startsWith("Naked set") ||
      step.tactic.startsWith("Hidden set") ||
      step.tactic.startsWith("Pointing pair")
    ) {
      hardest = hardest === "hard" ? "hard" : "medium";
    }

    if (step.eliminations) {
      step.eliminations.forEach(({ row, col, num }) => {
        const key = `${row},${col}`;
        const set = autoElims.get(key) || new Set();
        set.add(num);
        autoElims.set(key, set);
      });
    } else if (step.row !== undefined && step.col !== undefined && step.value !== undefined) {
      board[step.row][step.col] = step.value;
    }
  }

  const solved = board.every((row) => row.every((value) => value !== 0));
  if (!solved) return "hard";
  return hardest;
}

function shuffle(items) {
  const array = items.slice();
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function snapshotFullState() {
  return {
    board: getBoard(),
    autoEliminations: serializeAutoEliminations(),
    manualCandidates: serializeManualCandidates(),
    prefilled: Array.from(state.prefilled),
    baseStepSnapshot: state.baseStepSnapshot
      ? cloneSnapshot(state.baseStepSnapshot)
      : null,
    stepHistory: state.stepHistory.map((entry) => ({
      tactic: entry.tactic,
      evidence: entry.evidence,
      snapshot: cloneSnapshot(entry.snapshot),
    })),
  };
}

function restoreFullState(snapshot) {
  state.prefilled = new Set(snapshot.prefilled);
  setBoard(snapshot.board, false);
  restoreAutoEliminations(snapshot.autoEliminations);
  restoreManualCandidates(snapshot.manualCandidates);
  state.baseStepSnapshot = snapshot.baseStepSnapshot
    ? cloneSnapshot(snapshot.baseStepSnapshot)
    : null;
  state.stepHistory = snapshot.stepHistory.map((entry) => ({
    tactic: entry.tactic,
    evidence: entry.evidence,
    snapshot: cloneSnapshot(entry.snapshot),
  }));
  renderStepLog();
  clearCandidateChanges();
  refreshUI({ validate: false, highlight: false });
}

function pushUndo() {
  const snapshot = snapshotFullState();
  state.undoStack.push(snapshot);
  if (state.undoStack.length > 100) {
    state.undoStack.shift();
  }
}

function handleUndo() {
  if (state.undoStack.length === 0) return;
  const snapshot = state.undoStack.pop();
  restoreFullState(snapshot);
}

function serializeManualCandidates() {
  const data = [];
  state.manualCandidates.forEach((set, input) => {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    if (Number.isNaN(row) || Number.isNaN(col)) return;
    data.push([`${row},${col}`, Array.from(set)]);
  });
  return data;
}

function restoreManualCandidates(data) {
  const lookup = new Map(data);
  state.manualCandidates.clear();
  state.inputs.forEach((input) => {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    const key = `${row},${col}`;
    const items = lookup.get(key) || [];
    state.manualCandidates.set(input, new Set(items));
  });
}

function handleInput(event) {
  if (state.editMode === "candidate") {
    const value = event.target.value.replace(/[^1-9]/g, "");
    if (value) {
      pushUndo();
      toggleManualCandidate(event.target, Number(value));
    }
    event.target.value = "";
    clearHint();
    refreshUI({ validate: false, highlight: false });
    return;
  }

  pushUndo();
  const value = event.target.value.replace(/[^1-9]/g, "");
  event.target.value = value;
  event.target.parentElement.classList.remove("invalid");
  event.target.parentElement.classList.remove("step-solved");
  event.target.parentElement.classList.toggle("user-filled", value !== "");
  clearAutoEliminations();
  clearManualCandidates(event.target);
  resetStepHistory();
  clearCandidateChanges();
  clearHint();
  refreshUI();
}

function handleFocus(event) {
  highlightForInput(event.target);
  setSelected(event.target);
  state.activeInput = event.target;
}

function handleKeydown(event) {
  if (handleArrowNavigation(event)) return;
  if (state.editMode !== "candidate") return;
  const key = event.key;
  if (key >= "1" && key <= "9") {
    event.preventDefault();
    pushUndo();
    toggleManualCandidate(event.target, Number(key));
    clearHint();
    refreshUI({ validate: false, highlight: false });
    return;
  }
  if (key === "Backspace" || key === "Delete") {
    event.preventDefault();
    pushUndo();
    clearManualCandidates(event.target);
    clearHint();
    refreshUI({ validate: false, highlight: false });
  }
}

function handleKeypadClick(event) {
  const button = event.target.closest(".keypad__btn");
  if (!button) return;
  const num = Number(button.dataset.num);
  if (!num || Number.isNaN(num)) return;
  const input = state.activeInput;
  if (!input) return;
  input.focus();
  input.value = String(num);
  handleInput({ target: input });
}

function highlightForInput(input) {
  clearHighlights();
  const row = Number(input.dataset.row);
  const col = Number(input.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return;

  const boxRow = Math.floor(row / 3);
  const boxCol = Math.floor(col / 3);
  const value = input.value;

  state.inputs.forEach((cell) => {
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    const sameRow = r === row;
    const sameCol = c === col;
    const sameBox = Math.floor(r / 3) === boxRow && Math.floor(c / 3) === boxCol;
    if (sameRow || sameCol || sameBox) {
      cell.parentElement.classList.add("highlight");
    }
    if (value && cell.value === value) {
      cell.parentElement.classList.add("match");
    }
  });
}

function clearHighlights() {
  state.inputs.forEach((cell) => {
    cell.parentElement.classList.remove("highlight", "match");
  });
}

function clearCandidateChanges() {
  state.inputs.forEach((cell) => {
    cell.parentElement.classList.remove("candidate-changed");
  });
}

function clearAutoEliminations() {
  state.autoEliminations.clear();
}

function resetStepHistory() {
  state.baseStepSnapshot = null;
  state.stepHistory.length = 0;
  stepLogEl.innerHTML = "";
}

function resetUndoHistory() {
  state.undoStack.length = 0;
}

function setSelected(input) {
  state.inputs.forEach((cell) => cell.parentElement.classList.remove("selected"));
  input.parentElement.classList.add("selected");
}

function handleArrowNavigation(event) {
  const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  if (!arrows.includes(event.key)) return false;

  event.preventDefault();
  const row = Number(event.target.dataset.row);
  const col = Number(event.target.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return false;

  let nextRow = row;
  let nextCol = col;
  if (event.key === "ArrowUp") nextRow -= 1;
  if (event.key === "ArrowDown") nextRow += 1;
  if (event.key === "ArrowLeft") nextCol -= 1;
  if (event.key === "ArrowRight") nextCol += 1;

  if (nextRow < 0 || nextRow >= SIZE || nextCol < 0 || nextCol >= SIZE) return true;

  const nextInput = state.cellGrid[nextRow][nextCol];
  if (nextInput) nextInput.focus();
  return true;
}

function clearManualCandidates(input) {
  const manual = state.manualCandidates.get(input);
  if (manual) manual.clear();
}

function toggleManualCandidate(input, num) {
  if (input.value) return;
  const manual = state.manualCandidates.get(input);
  if (!manual) return;
  if (manual.has(num)) {
    manual.delete(num);
  } else {
    manual.add(num);
  }
}

function updateCandidates() {
  const board = getBoard();
  const autoCandidates = candidatesToggle.checked
    ? solver.getAutoCandidates(board, state.autoEliminations)
    : null;
  state.inputs.forEach((input) => {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    const candidates = state.candidateMap.get(input);
    if (!candidates) return;
    const spans = candidates.querySelectorAll("span");
    const manual = state.manualCandidates.get(input) || new Set();

    applyCandidateDisplay({
      input,
      spans,
      candidates,
      manual,
      auto: autoCandidates?.get(`${row},${col}`) || [],
      showAuto: candidatesToggle.checked,
    });
  });
}

function applyCandidateDisplay({ input, spans, candidates, manual, auto, showAuto }) {
  if (input.value) {
    spans.forEach((span) => {
      span.textContent = "";
      span.classList.remove("manual");
    });
    candidates.classList.remove("manual-visible");
    return;
  }

  if (showAuto) {
    for (let num = 1; num <= 9; num += 1) {
      const visible = auto.includes(num);
      spans[num - 1].textContent = visible ? String(num) : "";
      spans[num - 1].classList.remove("manual");
    }
    candidates.classList.remove("manual-visible");
    return;
  }

  for (let num = 1; num <= 9; num += 1) {
    const hasManual = manual.has(num);
    spans[num - 1].textContent = hasManual ? String(num) : "";
    spans[num - 1].classList.toggle("manual", hasManual);
  }
  candidates.classList.toggle("manual-visible", manual.size > 0);
}

function getBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  state.inputs.forEach((input) => {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    const value = Number(input.value);
    board[row][col] = Number.isNaN(value) ? 0 : value;
  });
  return board;
}

function setBoard(board, lockPrefilled = false) {
  if (lockPrefilled) {
    state.prefilled.clear();
  }
  state.inputs.forEach((input) => {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    const value = board[row][col];
    const key = `${row},${col}`;
    input.value = value === 0 ? "" : String(value);
    if (lockPrefilled && value !== 0) {
      state.prefilled.add(key);
    }
    const isPrefilled = state.prefilled.has(key);
    input.readOnly = isPrefilled;
    input.parentElement.classList.toggle("prefilled", isPrefilled);
    input.parentElement.classList.toggle(
      "user-filled",
      value !== 0 && !isPrefilled
    );
    input.parentElement.classList.remove("step-solved");
    input.parentElement.classList.remove("invalid");
  });
}

function validateGrid() {
  const board = getBoard();
  let valid = true;

  state.inputs.forEach((input) => input.parentElement.classList.remove("invalid"));

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = board[row][col];
      if (value === 0) continue;
      board[row][col] = 0;
      if (!solver.isValid(board, row, col, value)) {
        markInvalid(row, col);
        valid = false;
      }
      board[row][col] = value;
    }
  }

  statusEl.textContent = valid ? "Ready." : "Fix conflicts before solving.";
  return valid;
}

function markInvalid(row, col) {
  const input = state.cellGrid[row][col];
  if (input) input.parentElement.classList.add("invalid");
}

function handleSolve() {
  if (!validateGrid()) return;
  pushUndo();
  clearHint();
  const board = getBoard();
  const snapshot = board.map((row) => row.slice());
  const solved = solver.solve(board);
  if (solved) {
    setBoard(board, false);
    statusEl.textContent = "Solved!";
  } else {
    setBoard(snapshot, false);
    statusEl.textContent = "No solution found.";
  }
  refreshUI({ validate: false, highlight: false });
  resetStepHistory();
  clearCandidateChanges();
}

function handleGenerate() {
  const difficulty = difficultySelect.value;
  statusEl.textContent = `Generating ${difficulty} puzzle...`;
  setTimeout(() => {
    const puzzle = generatePuzzle(difficulty);
    if (!puzzle) {
      statusEl.textContent = "Generator failed. Try again.";
      return;
    }
    pushUndo();
    clearHint();
    setBoard(puzzle, true);
    state.inputs.forEach((input) => clearManualCandidates(input));
    clearAutoEliminations();
    resetStepHistory();
    clearCandidateChanges();
    refreshUI({ validate: false, highlight: false });
    statusEl.textContent = `Generated ${difficulty} puzzle.`;
  }, 20);
}

function handleClear() {
  pushUndo();
  clearHint();
  state.inputs.forEach((input) => {
    input.value = "";
    input.readOnly = false;
    input.parentElement.classList.remove(
      "invalid",
      "prefilled",
      "user-filled",
      "step-solved"
    );
    clearManualCandidates(input);
  });
  state.prefilled.clear();
  clearAutoEliminations();
  clearHighlights();
  refreshUI({ validate: false, highlight: false });
  statusEl.textContent = "Cleared.";
  resetStepHistory();
  clearCandidateChanges();
}

function handleReset() {
  pushUndo();
  clearHint();
  const board = getBoard();
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const key = `${row},${col}`;
      if (!state.prefilled.has(key)) {
        board[row][col] = 0;
      }
    }
  }
  setBoard(board, false);
  state.inputs.forEach((input) => clearManualCandidates(input));
  clearAutoEliminations();
  resetStepHistory();
  clearCandidateChanges();
  refreshUI({ validate: false, highlight: false });
  statusEl.textContent = "Reset to starting clues.";
}


function handleCopy() {
  const board = getBoard();
  const flat = board.flat().map((value) => (value === 0 ? "-" : String(value)));
  const text = flat.join("");
  const done = () => {
    statusEl.textContent = "Copied puzzle string.";
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      window.prompt("Copy puzzle string:", text);
    });
    return;
  }

  window.prompt("Copy puzzle string:", text);
}

function handleLoad() {
  const raw = window.prompt("Paste puzzle string (81 chars, digits or -):");
  if (!raw) return;
  const cleaned = raw.trim().replace(/\s+/g, "");
  if (cleaned.length !== 81) {
    statusEl.textContent = "Load failed: need 81 characters.";
    return;
  }

  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (let i = 0; i < 81; i += 1) {
    const char = cleaned[i];
    if (char === "-") {
      board[Math.floor(i / 9)][i % 9] = 0;
      continue;
    }
    if (char < "1" || char > "9") {
      statusEl.textContent = "Load failed: only digits 1-9 or -.";
      return;
    }
    board[Math.floor(i / 9)][i % 9] = Number(char);
  }

  pushUndo();
  clearHint();
  setBoard(board, true);
  state.inputs.forEach((input) => clearManualCandidates(input));
  clearHighlights();
  clearAutoEliminations();
  refreshUI({ validate: false, highlight: false });
  statusEl.textContent = "Puzzle loaded.";
  resetStepHistory();
  clearCandidateChanges();
}

function handleStep() {
  if (!validateGrid()) return;
  clearCandidateChanges();
  clearHint();
  if (!candidatesToggle.checked) {
    candidatesToggle.checked = true;
    gridEl.classList.add("show-candidates");
  }
  const board = getBoard();
  ensureBaseSnapshot(board);
  const step = solver.findStep(board, state.autoEliminations);
  if (!step) {
    const item = document.createElement("li");
    item.textContent = "No further steps found with current tactics.";
    stepLogEl.prepend(item);
    statusEl.textContent = "No further steps found with current tactics.";
    return;
  }
  pushUndo();

  const { row, col, value, tactic, evidence, eliminations } = step;
  if (eliminations) {
    applyEliminations(eliminations);
    markCandidateChanges(eliminations.map(({ row: r, col: c }) => `${r},${c}`));
  } else if (row !== undefined && col !== undefined && value !== undefined) {
    board[row][col] = value;
    setBoard(board, false);
    const input = state.cellGrid[row][col];
    if (input) {
      input.parentElement.classList.add("step-solved");
      input.parentElement.classList.remove("user-filled");
    }
  }
  refreshUI({ validate: false, highlight: false });
  state.stepHistory.push({
    tactic,
    evidence,
    snapshot: snapshotState(getBoard()),
  });
  renderStepLog();
}

function applyHint(step) {
  const { row, col, value, tactic, evidence, eliminations } = step;
  if (eliminations) {
    applyEliminations(eliminations);
    markCandidateChanges(eliminations.map(({ row: r, col: c }) => `${r},${c}`));
  } else if (row !== undefined && col !== undefined && value !== undefined) {
    const board = getBoard();
    board[row][col] = value;
    setBoard(board, false);
    const input = state.cellGrid[row][col];
    if (input) {
      input.parentElement.classList.add("step-solved");
      input.parentElement.classList.remove("user-filled");
    }
  }
  refreshUI({ validate: false, highlight: false });
  state.stepHistory.push({
    tactic,
    evidence,
    snapshot: snapshotState(getBoard()),
  });
  renderStepLog();
}

function showHint(step) {
  clearHint();
  if (!candidatesToggle.checked) {
    candidatesToggle.checked = true;
    gridEl.classList.add("show-candidates");
  }
  const { row, col, evidence, eliminations } = step;
  if (eliminations && eliminations.length > 0) {
    const keys = eliminations.map(({ row: r, col: c }) => `${r},${c}`);
    markHintTargets(keys);
  } else if (row !== undefined && col !== undefined) {
    markHintTargets([`${row},${col}`]);
  }
  hintText.textContent = evidence;
  state.pendingHint = step;
}

function markHintTargets(keys) {
  const unique = new Set(keys);
  unique.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    const input = state.cellGrid[row][col];
    if (input) input.parentElement.classList.add("hint-target");
  });
}

function handleHint() {
  if (state.pendingHint) {
    pushUndo();
    applyHint(state.pendingHint);
    clearHint();
    return;
  }
  if (!validateGrid()) return;
  clearCandidateChanges();
  const board = getBoard();
  ensureBaseSnapshot(board);
  const step = solver.findStep(board, state.autoEliminations);
  if (!step) {
    const item = document.createElement("li");
    item.textContent = "No further steps found with current tactics.";
    stepLogEl.prepend(item);
    statusEl.textContent = "No further steps found with current tactics.";
    return;
  }
  showHint(step);
}

function getTacticId(tactic) {
  if (tactic.startsWith("Full house")) return "tactic-full-house";
  if (tactic.startsWith("Naked single")) return "tactic-naked-single";
  if (tactic.startsWith("Hidden single")) return "tactic-hidden-single";
  if (tactic.startsWith("Naked set")) return "tactic-naked-set";
  if (tactic.startsWith("Hidden set")) return "tactic-hidden-set";
  if (tactic.startsWith("Pointing pair")) return "tactic-pointing-pair";
  if (tactic.startsWith("Claiming pair")) return "tactic-claiming-pair";
  if (tactic.startsWith("X-Wing")) return "tactic-xwing";
  if (tactic.startsWith("Swordfish")) return "tactic-swordfish";
  if (tactic.startsWith("Jellyfish")) return "tactic-jellyfish";
  if (tactic.startsWith("XY-Wing")) return "tactic-xywing";
  if (tactic.startsWith("XYZ-Wing")) return "tactic-xyzwing";
  if (tactic.startsWith("W-Wing")) return "tactic-wwing";
  if (tactic.startsWith("Skyscraper")) return "tactic-skyscraper";
  return "tactics";
}

function snapshotState(board) {
  return {
    board: board.map((row) => row.slice()),
    autoEliminations: serializeAutoEliminations(),
  };
}

function ensureBaseSnapshot(board) {
  if (!state.baseStepSnapshot) {
    state.baseStepSnapshot = snapshotState(board);
  }
}

function restoreState(snapshot) {
  setBoard(snapshot.board, false);
  restoreAutoEliminations(snapshot.autoEliminations);
  refreshUI({ validate: false, highlight: false });
}

function applyStepSnapshot(snapshot) {
  if (!snapshot) return;
  restoreState(snapshot);
  refreshUI({ validate: false, highlight: false });
}

function serializeAutoEliminations() {
  const data = [];
  state.autoEliminations.forEach((set, key) => {
    data.push([key, Array.from(set)]);
  });
  return data;
}

function cloneSnapshot(snapshot) {
  return {
    board: snapshot.board.map((row) => row.slice()),
    autoEliminations: snapshot.autoEliminations.map(([key, nums]) => [key, nums.slice()]),
  };
}

function restoreAutoEliminations(data) {
  state.autoEliminations.clear();
  data.forEach(([key, nums]) => {
    state.autoEliminations.set(key, new Set(nums));
  });
}

function markCandidateChanges(keys) {
  const unique = new Set(keys);
  unique.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    const input = state.cellGrid[row][col];
    if (input) input.parentElement.classList.add("candidate-changed");
  });
}

function renderStepLog() {
  stepLogEl.innerHTML = "";
  for (let i = state.stepHistory.length - 1; i >= 0; i -= 1) {
    const entry = state.stepHistory[i];
    const number = i + 1;
    const item = document.createElement("li");
    const link = document.createElement("a");
    const tacticId = getTacticId(entry.tactic);
    link.href = `#${tacticId}`;
    link.textContent = entry.tactic;
    item.append(`Step ${number} — `);
    item.appendChild(link);
    item.append(`: ${entry.evidence}`);
    stepLogEl.appendChild(item);
  }
}

function applyEliminations(eliminations) {
  eliminations.forEach(({ row, col, num }) => {
    const key = `${row},${col}`;
    const set = state.autoEliminations.get(key) || new Set();
    set.add(num);
    state.autoEliminations.set(key, set);
  });
}


buildGrid();
refreshUI({ validate: false, highlight: false });

solveBtn.addEventListener("click", handleSolve);
clearBtn.addEventListener("click", handleClear);
resetBtn.addEventListener("click", handleReset);
copyBtn.addEventListener("click", handleCopy);
loadBtn.addEventListener("click", handleLoad);
generateBtn.addEventListener("click", handleGenerate);
stepBtn.addEventListener("click", handleStep);
undoBtn.addEventListener("click", handleUndo);
hintBtn.addEventListener("click", handleHint);
candidatesToggle.closest(".board").addEventListener("click", handleKeypadClick);
candidatesToggle.addEventListener("change", () => {
  gridEl.classList.toggle("show-candidates", candidatesToggle.checked);
  refreshUI({ validate: false, highlight: false });
});

modeInputs.forEach((input) => {
  input.addEventListener("change", (event) => {
    state.editMode = event.target.value;
    if (state.editMode === "candidate") {
      statusEl.textContent = "Candidate mode: add or remove notes.";
    } else {
      statusEl.textContent = "Number mode: fill a cell.";
    }
  });
});
