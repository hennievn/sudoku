document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = '';
    // Elements
    const boardElement = document.getElementById('sudoku-board');
    const newGameBtn = document.getElementById('new-game');
    const saveGameBtn = document.getElementById('save-game-btn');
    const numberPalette = document.getElementById('number-palette');
    const checkSolutionBtn = document.getElementById('check-button');
    const statusElement = document.getElementById('status');
    const restartBtn = document.getElementById('restart-button');
    const hintBtn = document.getElementById('hint-button');
    const helpBtn = document.getElementById('help');
    const helpModal = document.getElementById('help-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const solvedModal = document.getElementById('solved-modal');
    const newGameSolvedBtn = document.getElementById('new-game-solved');
    const difficultyModal = document.getElementById('difficulty-modal');
    const easyDifficultyBtn = document.getElementById('easy-difficulty-btn');
    const mediumDifficultyBtn = document.getElementById('medium-difficulty-btn');
    const hardDifficultyBtn = document.getElementById('hard-difficulty-btn');
    const pencilIcon = document.getElementById('pencil-icon');
    const penIcon = document.getElementById('pen-icon');
    const backspaceIcon = document.getElementById('backspace-icon');
    const themeToggle = document.getElementById('theme-toggle');
    const loadingIndicator = document.getElementById('loading-indicator'); // New: Get loading indicator
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsModalCloseBtn = settingsModal.querySelector('.close-button');
    const errorCheckModeToggle = document.getElementById('error-check-mode-toggle');
    const autoUpdatePencilToggle = document.getElementById('auto-update-pencil-toggle');

    // Game state
    const GRID_SIZE = 9; // New constant
    let board = [];
    let originalBoard = [];
    let solution = [];
    let pencilMarks = [];
    let manualRemovals = [];
    let selectedCell = null;
    let pencilMode = false;
    let errorCheckMode = true;
    let autoUpdatePencilEntries = true;
    let timerInterval;
    let startTime;
    let errorCells = [];
    let conflictCells = []; // New: for real-time conflicts
    let currentDifficulty = 'hard'; // Default difficulty

    let history = [];
    let historyPointer = -1;
    const MAX_HISTORY_SIZE = 100; // Extended in-game history size

    let isLoading = false; // New: Loading state
    let previousBoard = []; // New: Store previous board state for optimized rendering
    let previousPencilMarks = []; // New: Store previous pencil marks for optimized rendering

    function isGameActive() {
        return Array.isArray(board) && board.length === GRID_SIZE;
    }

    // Helper to manage loading state
    function setLoading(loading) {
        isLoading = loading;
        newGameBtn.disabled = loading;
        hintBtn.disabled = loading;
        checkSolutionBtn.disabled = loading;
        restartBtn.disabled = loading;
        easyDifficultyBtn.disabled = loading;
        mediumDifficultyBtn.disabled = loading;
        hardDifficultyBtn.disabled = loading;
        updateUndoRedoButtons();
        // Add other buttons that should be disabled during loading
        if (loading) {
            loadingIndicator.style.display = 'flex'; // Show spinner
            setStatusMessage('Loading...', 'info');
        } else {
            loadingIndicator.style.display = 'none'; // Hide spinner
            // Clear loading message if not replaced by another status
            if (statusElement.textContent === 'Loading...') {
                setStatusMessage('');
            }
        }
    }

    // Functions
    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        themeToggle.textContent = isDarkMode ? 'dark_mode' : 'light_mode';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }

    function updateTimer() {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timerDisplay = document.getElementById('timer');
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function startTimer() {
        startTime = Date.now();
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function setStatusMessage(message, type = 'info') {
        statusElement.textContent = message;
        statusElement.className = '';
        statusElement.classList.add(type);
    }

    function checkErrors() {
        errorCells = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (originalBoard[r][c] === 0 && board[r][c] !== 0) {
                    if (board[r][c] !== solution[r][c]) {
                        errorCells.push([r, c]);
                    }
                }
            }
        }
        drawBoard();
    }

    // Check for real-time rule conflicts across the board
    function updateConflicts() {
        conflictCells = [];
        if (!errorCheckMode || !isGameActive()) return;

        const conflictSet = new Set();

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const num = board[r][c];
                if (num === 0) continue;

                // Check row
                for (let col = 0; col < GRID_SIZE; col++) {
                    if (col !== c && board[r][col] === num) {
                        conflictSet.add(`${r},${c}`);
                        conflictSet.add(`${r},${col}`);
                    }
                }

                // Check column
                for (let row = 0; row < GRID_SIZE; row++) {
                    if (row !== r && board[row][c] === num) {
                        conflictSet.add(`${r},${c}`);
                        conflictSet.add(`${row},${c}`);
                    }
                }

                // Check 3x3 block
                const startRow = Math.floor(r / 3) * 3;
                const startCol = Math.floor(c / 3) * 3;
                for (let row = startRow; row < startRow + 3; row++) {
                    for (let col = startCol; col < startCol + 3; col++) {
                        if ((row !== r || col !== c) && board[row][col] === num) {
                            conflictSet.add(`${r},${c}`);
                            conflictSet.add(`${row},${col}`);
                        }
                    }
                }
            }
        }

        conflictCells = Array.from(conflictSet).map(coord => coord.split(',').map(Number));
    }


    function initPencilMarks() {
        pencilMarks = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0).map(() => new Set()));
    }

    function initManualRemovals() {
        manualRemovals = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0).map(() => new Set()));
    }

    function resetHistory() {
        history = [];
        historyPointer = -1;
    }

    function cloneState() {
        return {
            board: board.map(row => [...row]),
            pencilMarks: pencilMarks.map(row => row.map(set => new Set(set))),
            manualRemovals: manualRemovals.map(row => row.map(set => new Set(set)))
        };
    }

    function statesEqual(a, b) {
        if (!a || !b) return false;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (a.board[r][c] !== b.board[r][c]) return false;

                const marksA = a.pencilMarks[r][c];
                const marksB = b.pencilMarks[r][c];
                if (marksA.size !== marksB.size) return false;
                for (const val of marksA) {
                    if (!marksB.has(val)) return false;
                }

                const remA = a.manualRemovals[r][c];
                const remB = b.manualRemovals[r][c];
                if (remA.size !== remB.size) return false;
                for (const val of remA) {
                    if (!remB.has(val)) return false;
                }
            }
        }
        return true;
    }

    function saveState() {
        const nextState = cloneState();

        // Avoid pushing duplicate consecutive states into history
        if (historyPointer >= 0 && statesEqual(history[historyPointer], nextState)) {
            return;
        }

        // If we are not at the end of history, truncate the future history
        if (historyPointer < history.length - 1) {
            history = history.slice(0, historyPointer + 1);
        }

        history.push(nextState);

        // Limit history size
        if (history.length > MAX_HISTORY_SIZE) {
            history.shift(); // Remove the oldest state
        }
        historyPointer = history.length - 1;
        updateUndoRedoButtons();
    }

    function generateSudokuString() {
        let s = 'S9B'; // S = Sudoku, 9 = size, B = version 2
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                let n;
                if (originalBoard[r][c] !== 0) {
                    // Clue: 1-9
                    n = originalBoard[r][c];
                } else if (board[r][c] !== 0) {
                    // Solved cell (user entered): 10-18
                    n = board[r][c] + 9;
                } else {
                    // Candidates
                    let mask = 0;
                    const marks = pencilMarks[r][c];
                    if (marks.size === 0) {
                        // If no marks and empty, assume all candidates (511)
                        mask = 511;
                    } else {
                        for (let k = 1; k <= 9; k++) {
                            if (marks.has(k)) {
                                mask |= (1 << (k - 1));
                            }
                        }
                    }
                    // Candidates: 19+ (18 is offset for 0 candidates, but logic says candidates > 0)
                    // The spec says: candidates + 18.
                    // If mask is 1 (candidate 1), n = 19.
                    // If mask is 511 (all), n = 529.
                    n = mask + 18;
                }

                let h = n.toString(36);
                if (h.length < 2) h = '0' + h;
                s += h;
            }
        }
        return s;
    }

    function openInSudokuWiki() {
        if (!isGameActive()) return;
        const sudokuString = generateSudokuString();
        const exportUrl = `https://www.sudokuwiki.org/sudoku.htm?bd=${sudokuString}`;
        window.open(exportUrl, '_blank');
    }

    function drawBoard() {
        const boardState = {
            selectedRow: selectedCell ? parseInt(selectedCell.dataset.row) : -1,
            selectedCol: selectedCell ? parseInt(selectedCell.dataset.col) : -1,
        };

        // Initialize previousBoard and previousPencilMarks if this is the first draw
        if (previousBoard.length === 0 || previousBoard[0].length === 0) { // Check for empty array or empty inner arrays
            for (let r = 0; r < GRID_SIZE; r++) {
                previousBoard.push(Array(GRID_SIZE).fill(0));
                previousPencilMarks.push(Array(GRID_SIZE).fill(0).map(() => new Set()));
            }
        }

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                let cellElement = boardElement.querySelector(`[data-row='${r}'][data-col='${c}']`);

                const currentVal = board[r][c];
                const originalVal = originalBoard[r][c];
                const currentPencilMarks = pencilMarks[r][c];

                const prevVal = previousBoard[r][c];
                const prevPencilMarks = previousPencilMarks[r][c];

                // Check if content needs update
                let contentChanged = false;
                if (originalVal !== 0) {
                    if (cellElement.textContent !== String(originalVal) || cellElement.classList.contains('user-entered')) {
                        cellElement.textContent = originalVal;
                        contentChanged = true;
                    }
                } else if (currentVal !== 0) {
                    if (cellElement.textContent !== String(currentVal) || cellElement.classList.contains('original') || cellElement.innerHTML.includes('div')) {
                        cellElement.innerHTML = ''; // Explicitly clear the cell
                        cellElement.textContent = currentVal;
                        contentChanged = true;
                    }
                } else {
                    // Check pencil marks
                    const currentMarksArray = Array.from(currentPencilMarks).sort().join('');
                    const prevMarksArray = Array.from(prevPencilMarks).sort().join('');

                    if (currentMarksArray !== prevMarksArray || cellElement.textContent !== '') {
                        cellElement.innerHTML = ''; // Clear existing content
                        if (currentPencilMarks.size > 0) {
                            const pencilContainer = document.createElement('div');
                            pencilContainer.classList.add('pencil-grid');
                            for (let i = 1; i <= GRID_SIZE; i++) {
                                const mark = document.createElement('div');
                                mark.classList.add('pencil-mark');
                                if (currentPencilMarks.has(i)) {
                                    mark.textContent = i;
                                }
                                pencilContainer.appendChild(mark);
                            }
                            cellElement.appendChild(pencilContainer);
                        }
                        contentChanged = true;
                    }
                }

                // Check if classes need update
                let classesChanged = false;
                const newClasses = new Set();
                newClasses.add('cell'); // Always has 'cell' class

                if (errorCells.some(err => err[0] === r && err[1] === c)) {
                    newClasses.add('error');
                }
                if (conflictCells.some(conf => conf[0] === r && conf[1] === c)) {
                    newClasses.add('conflict');
                }
                if (originalVal !== 0) {
                    newClasses.add('original');
                } else if (currentVal !== 0) {
                    newClasses.add('user-entered');
                }

                // Add selected class to newClasses if this is the selected cell
                if (r === boardState.selectedRow && c === boardState.selectedCol) {
                    newClasses.add('selected');
                }

                // Add cross-highlighted class if cell shares row, col, or box with selected cell
                if (boardState.selectedRow !== -1 && boardState.selectedCol !== -1) {
                    const isSameRow = (r === boardState.selectedRow);
                    const isSameCol = (c === boardState.selectedCol);
                    const isSameBox = (Math.floor(r / 3) === Math.floor(boardState.selectedRow / 3) &&
                                       Math.floor(c / 3) === Math.floor(boardState.selectedCol / 3));
                    const isSelf = (r === boardState.selectedRow && c === boardState.selectedCol);

                    if ((isSameRow || isSameCol || isSameBox) && !isSelf) {
                        newClasses.add('cross-highlighted');
                    }
                }

                // Compare current classes with newClasses
                const currentClasses = new Set(cellElement.classList);
                if (currentClasses.size !== newClasses.size || ![...currentClasses].every(cls => newClasses.has(cls))) {
                    cellElement.className = ''; // Clear all existing classes
                    newClasses.forEach(cls => cellElement.classList.add(cls));
                    classesChanged = true;
                }

                // Update previous state for next render
                previousBoard[r][c] = currentVal;
                previousPencilMarks[r][c] = new Set(currentPencilMarks); // Deep copy Set
            }
        }

        // Handle highlights based on selection
        document.querySelectorAll('.row-label').forEach(lbl => {
            lbl.classList.toggle('active-coord', parseInt(lbl.dataset.row) === boardState.selectedRow);
        });
        document.querySelectorAll('.col-label').forEach(lbl => {
            lbl.classList.toggle('active-coord', parseInt(lbl.dataset.col) === boardState.selectedCol);
        });

        if (selectedCell) {
            const num = board[boardState.selectedRow][boardState.selectedCol] || originalBoard[boardState.selectedRow][boardState.selectedCol];
            updateHighlights(num);
        } else {
            // If no cell is selected, ensure no cells are highlighted
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('highlighted'));
        }
    }

    function updateHighlights(number) {
        document.querySelectorAll('.cell').forEach(c => c.classList.remove('highlighted'));

        if (number && number !== 0) {
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    const currentNum = board[r][c] || originalBoard[r][c];
                    if (currentNum === number) {
                        boardElement.querySelector(`[data-row='${r}'][data-col='${c}']`).classList.add('highlighted');
                    }
                }
            }
        }
    }

    function selectCell(cell, r, c) {
        if (!isGameActive()) return;
        selectedCell = cell;
        drawBoard();
    }

    async function newGame(difficulty) {
        currentDifficulty = difficulty;
        difficultyModal.style.display = 'none';
        setLoading(true); // Set loading state
        setStatusMessage(`Generating ${difficulty} puzzle...`, 'info');
        selectedCell = null;
        updateHighlights(null);
        errorCells = []; // Clear errors on new game
        conflictCells = []; // Clear conflicts on new game
        try {
            const response = await fetch(`${BASE_URL}/api/new-game?difficulty=${difficulty}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            board = data.board;
            originalBoard = data.original_board;
            solution = data.solution;
            initPencilMarks();
            initManualRemovals();
            resetHistory();

            drawBoard();

            saveState();
            setStatusMessage('New game started.', 'info');
            startTimer();
            pencilMode = false;
            penIcon.classList.add('active-icon');
            pencilIcon.classList.remove('active-icon');
        } catch (error) {
            console.error('Error starting new game:', error);
            setStatusMessage(`Failed to start new game: ${error.message}`, 'error');
        } finally {
            setLoading(false); // Clear loading state
        }
    }

    function restartGame() {
        if (!isGameActive()) return;
        board = originalBoard.map(row => [...row]);
        initPencilMarks();
        initManualRemovals();
        resetHistory();
        selectedCell = null;
        updateHighlights(null);
        errorCells = []; // Clear errors on restart
        conflictCells = []; // Clear conflicts on restart
        drawBoard();
        saveState(); // Save state after restart
        setStatusMessage('Game restarted.', 'info');
        startTimer();
    }

    function togglePencilMode() {
        pencilMode = !pencilMode;
        if (pencilMode) {
            pencilIcon.classList.add('active-icon');
            penIcon.classList.remove('active-icon');
            setStatusMessage('Pencil mode', 'info');
        } else {
            penIcon.classList.add('active-icon');
            pencilIcon.classList.remove('active-icon');
            setStatusMessage('Pen mode', 'info');
        }
    }

    // New: Helper for pencil mark toggling
    function togglePencilMark(r, c, value) {
        if (pencilMarks[r][c].has(value)) {
            pencilMarks[r][c].delete(value);
            manualRemovals[r][c].add(value);
        } else {
            pencilMarks[r][c].add(value);
            manualRemovals[r][c].delete(value);
        }
        board[r][c] = 0; // Clear main value if pencil marking
    }

    async function getHints() {
        if (!isGameActive()) return;
        setLoading(true); // Set loading state
        const removalsAsArrays = manualRemovals.map(row => row.map(s => Array.from(s)));
        try {
            const response = await fetch(`${BASE_URL}/api/get-hints`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ board: board, manual_removals: removalsAsArrays }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !data.hints || !Array.isArray(data.hints)) {
                throw new Error('Invalid hints data received from server.');
            }

            for (let r = 0; r < GRID_SIZE; r++) {
                if (!Array.isArray(data.hints[r])) {
                    console.error(`hints[${r}] is not an array:`, data.hints[r]);
                    continue;
                }
                for (let c = 0; c < GRID_SIZE; c++) {
                    if (board[r][c] === 0) {
                        if (!Array.isArray(data.hints[r][c])) {
                            console.error(`hints[${r}][${c}] is not an array:`, data.hints[r][c]);
                            continue;
                        }
                        pencilMarks[r][c] = new Set(data.hints[r][c]);
                    }
                }
            }
            drawBoard();
            // Update current history frame in-place so recalculating hints does not consume undo slots
            if (historyPointer >= 0 && history[historyPointer]) {
                history[historyPointer] = cloneState();
            }
            setStatusMessage('Hints loaded.', 'info');
        } catch (error) {
            console.error('Error getting hints:', error);
            setStatusMessage(`Failed to get hints: ${error.message}`, 'error');
        } finally {
            setLoading(false); // Clear loading state
        }
    }

    function checkSolution() {
        if (!isGameActive()) return;
        let isCorrect = true;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (board[r][c] !== solution[r][c]) {
                    isCorrect = false;
                    break;
                }
            }
            if (!isCorrect) break;
        }

        if (isCorrect) {
            setStatusMessage('Congratulations! You solved it!', 'success');
            stopTimer();
            errorCells = [];
            conflictCells = []; // Clear conflicts on solved
            drawBoard();
            solvedModal.style.display = 'block';
        } else {
            checkErrors();
            if (errorCells.length > 0) {
                setStatusMessage('There are some mistakes. Incorrect cells are highlighted.', 'error');
            } else {
                setStatusMessage('There are some mistakes.', 'error');
            }
        }
    }

    function handleKeyPress(e) {
        if (!selectedCell) return;
        const r = parseInt(selectedCell.dataset.row);
        const c = parseInt(selectedCell.dataset.col);
        if (originalBoard[r][c] !== 0) return;
        errorCells = [];
        conflictCells = []; // Clear conflicts on key press
        if (e.key >= '1' && e.key <= '9') {
            handleCellInput(parseInt(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            handleCellInput(0, true);
        }
    }

    function isBoardComplete() {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (originalBoard[r][c] === 0 && board[r][c] === 0) {
                    return false; // Found an empty user-fillable cell
                }
            }
        }
        return true; // All user-fillable cells have a number
    }

    function handleCellInput(value, isBackspace = false) {
        if (!selectedCell || !isGameActive()) return;
        const r = parseInt(selectedCell.dataset.row);
        const c = parseInt(selectedCell.dataset.col);
        if (originalBoard[r][c] !== 0) return;
        errorCells = []; // Clear solution-check errors on user edit

        if (isBackspace) {
            board[r][c] = 0;
            pencilMarks[r][c].clear();
            manualRemovals[r][c].clear();
        } else {
            if (pencilMode) {
                togglePencilMark(r, c, value); // Use helper
            } else {
                board[r][c] = value;
                pencilMarks[r][c].clear();
            }
        }

        if (autoUpdatePencilEntries && board[r][c] !== 0) {
            updatePencilMarks(r, c, board[r][c]);
        }

        // Re-evaluate real-time rule conflicts if Error Check Mode is enabled
        updateConflicts();

        drawBoard();
        updateHighlights(board[r][c]);
        saveState();

        // Automatic solution check if board is complete
        if (isBoardComplete()) {
            checkSolution();
        }
    }

    function updatePencilMarks(row, col, value) {
        // Remove the entered number from pencil marks in the same row, column, and block
        for (let i = 0; i < GRID_SIZE; i++) {
            pencilMarks[row][i].delete(value);
            pencilMarks[i][col].delete(value);
        }
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let r = startRow; r < startRow + 3; r++) {
            for (let c = startCol; c < startCol + 3; c++) {
                pencilMarks[r][c].delete(value);
            }
        }
    }

    function showHelp() {
        helpModal.style.display = 'block';
    }

    function hideHelp() {
        helpModal.style.display = 'none';
    }

    function applyState(state) {
        board = state.board.map(row => [...row]);
        pencilMarks = state.pencilMarks.map(row => row.map(set => new Set(set)));
        manualRemovals = state.manualRemovals.map(row => row.map(set => new Set(set)));
        errorCells = []; // Clear errors on undo/redo
        updateConflicts(); // Re-evaluate rule conflicts on undo/redo
        drawBoard();
    }

    function undo() {
        if (historyPointer > 0) {
            historyPointer--;
            applyState(history[historyPointer]);
            updateUndoRedoButtons();
        }
    }

    function redo() {
        if (historyPointer < history.length - 1) {
            historyPointer++;
            applyState(history[historyPointer]);
            updateUndoRedoButtons();
        }
    }

    function updateUndoRedoButtons() {
        const undoButton = document.getElementById('undo-button');
        const redoButton = document.getElementById('redo-button');

        if (undoButton) {
            undoButton.disabled = historyPointer <= 0 || isLoading; // Disable if loading
        }
        if (redoButton) {
            redoButton.disabled = historyPointer >= history.length - 1 || isLoading; // Disable if loading
        }
    }

    const solvedModalCloseBtn = solvedModal.querySelector('.close-button');

    // Event Listeners
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = 'dark_mode';
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.textContent = 'light_mode';
    }
    themeToggle.addEventListener('click', toggleTheme);

    boardElement.querySelectorAll('.cell').forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        cell.addEventListener('click', () => selectCell(cell, r, c));
    });

    document.addEventListener('keydown', (e) => {
        if (isLoading) return; // Prevent input when loading
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        if (e.key === 'Escape') {
            helpModal.style.display = 'none';
            settingsModal.style.display = 'none';
            solvedModal.style.display = 'none';
            if (isGameActive()) {
                difficultyModal.style.display = 'none';
            }
            return;
        }

        // Handle Ctrl/Cmd+Z and Ctrl/Cmd+Y without hijacking other browser shortcuts like Ctrl+R
        if (e.ctrlKey || e.metaKey || e.altKey) {
            if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                const key = e.key.toLowerCase();
                if (key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                } else if (key === 'y') {
                    e.preventDefault();
                    redo();
                }
            }
            return;
        }

        // Arrow Key Grid Navigation
        let r = selectedCell ? parseInt(selectedCell.dataset.row) : 0;
        let c = selectedCell ? parseInt(selectedCell.dataset.col) : 0;
        let moved = false;

        switch (e.key) {
            case 'ArrowUp':
                r = selectedCell ? Math.max(0, r - 1) : 0;
                moved = true;
                break;
            case 'ArrowDown':
                r = selectedCell ? Math.min(GRID_SIZE - 1, r + 1) : 0;
                moved = true;
                break;
            case 'ArrowLeft':
                c = selectedCell ? Math.max(0, c - 1) : 0;
                moved = true;
                break;
            case 'ArrowRight':
                c = selectedCell ? Math.min(GRID_SIZE - 1, c + 1) : 0;
                moved = true;
                break;
        }

        if (moved) {
            e.preventDefault(); // Prevent browser scrolling
            const targetCell = boardElement.querySelector(`[data-row='${r}'][data-col='${c}']`);
            if (targetCell) {
                selectCell(targetCell, r, c);
            }
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'n': difficultyModal.style.display = 'block'; break;
            case 'r': restartGame(); break;
            case 'p': togglePencilMode(); break;
            case 'h': getHints(); break;
            case 'c': checkSolution(); break;
            case 'i': showHelp(); break;
            case 'y': redo(); break;
            case 'z': undo(); break;
            default: handleKeyPress(e); break;
        }
    });

    numberPalette.querySelectorAll('.palette-number').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (!selectedCell || isLoading) return; // Prevent input when loading
            const numEntered = parseInt(button.textContent);
            handleCellInput(numEntered);
        });
    });

    pencilIcon.addEventListener('click', (e) => {
        e.preventDefault();
        if (isLoading) return; // Prevent input when loading
        togglePencilMode();
    });

    penIcon.addEventListener('click', (e) => {
        e.preventDefault();
        if (isLoading) return; // Prevent input when loading
        if (pencilMode) {
            togglePencilMode();
        }
    });

    backspaceIcon.addEventListener('click', (e) => {
        e.preventDefault();
        if (!selectedCell || isLoading) return; // Prevent input when loading
        handleCellInput(0, true);
    });

    newGameBtn.addEventListener('click', () => {
        if (isLoading) return; // Prevent multiple clicks
        difficultyModal.style.display = 'block';
    });

    saveGameBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openInSudokuWiki();
    });

    easyDifficultyBtn.addEventListener('click', () => { if (!isLoading) newGame('easy'); });
    mediumDifficultyBtn.addEventListener('click', () => { if (!isLoading) newGame('medium'); });
    hardDifficultyBtn.addEventListener('click', () => { if (!isLoading) newGame('hard'); });

    restartBtn.addEventListener('click', () => { if (!isLoading) restartGame(); });
    hintBtn.addEventListener('click', () => { if (!isLoading) getHints(); });
    checkSolutionBtn.addEventListener('click', () => { if (!isLoading) checkSolution(); });
    helpBtn.addEventListener('click', showHelp);
    closeModalBtn.addEventListener('click', hideHelp);

    solvedModalCloseBtn.addEventListener('click', () => {
        solvedModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == helpModal) {
            hideHelp();
        }
        if (event.target == solvedModal) {
            solvedModal.style.display = 'none';
        }
        if (event.target == settingsModal) {
            settingsModal.style.display = 'none';
        }
        if (event.target == difficultyModal && isGameActive()) {
            difficultyModal.style.display = 'none';
        }
    });

    newGameSolvedBtn.addEventListener('click', () => {
        solvedModal.style.display = 'none';
        if (!isLoading) difficultyModal.style.display = 'block'; // Only show if not loading
    });

    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'block';
    });

    settingsModalCloseBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    errorCheckModeToggle.addEventListener('change', () => {
        errorCheckMode = errorCheckModeToggle.checked;
        updateConflicts();
        if (isGameActive()) {
            drawBoard();
        }
    });

    autoUpdatePencilToggle.addEventListener('change', () => {
        autoUpdatePencilEntries = autoUpdatePencilToggle.checked;
    });

    const undoButton = document.getElementById('undo-button');
    if (undoButton) {
        undoButton.addEventListener('click', undo);
    }

    const redoButton = document.getElementById('redo-button');
    if (redoButton) {
        redoButton.addEventListener('click', redo);
    }

    // Initial state
    difficultyModal.style.display = 'block';
    penIcon.classList.add('active-icon');
    pencilIcon.classList.remove('active-icon');
    updateUndoRedoButtons();
    setLoading(false); // Ensure initial state is not loading
});