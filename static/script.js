document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = '';
    // Elements
    const boardElement = document.getElementById('sudoku-board');
    const newGameBtn = document.getElementById('new-game');
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

    let history = [];
    let historyPointer = -1;
    const MAX_HISTORY_SIZE = 20; // As discussed, 20 steps

    let isLoading = false; // New: Loading state
    let previousBoard = []; // New: Store previous board state for optimized rendering
    let previousPencilMarks = []; // New: Store previous pencil marks for optimized rendering

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

    // New: Check for real-time conflicts
    function checkConflicts(row, col, num) {
        conflictCells = [];
        if (num === 0) return; // No conflict if cell is empty

        // Check row
        for (let c = 0; c < GRID_SIZE; c++) {
            if (c !== col && board[row][c] === num) {
                conflictCells.push([row, c]);
            }
        }

        // Check column
        for (let r = 0; r < GRID_SIZE; r++) {
            if (r !== row && board[r][col] === num) {
                conflictCells.push([r, col]);
            }
        }

        // Check 3x3 block
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let r = startRow; r < startRow + 3; r++) {
            for (let c = startCol; c < startCol + 3; c++) {
                if (r !== row && c !== col && board[r][c] === num) {
                    conflictCells.push([r, c]);
                }
            }
        }

        // Add the current cell if it's part of a conflict
        if (conflictCells.length > 0) {
            conflictCells.push([row, col]);
        }
    }


    function initPencilMarks() {
        pencilMarks = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0).map(() => new Set()));
    }

    function initManualRemovals() {
        manualRemovals = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0).map(() => new Set()));
    }

    function saveState() {
        // If we are not at the end of history, truncate the future history
        if (historyPointer < history.length - 1) {
            history = history.slice(0, historyPointer + 1);
        }

        // Deep copy board, pencilMarks, and manualRemovals
        const currentBoard = board.map(row => [...row]);
        const currentPencilMarks = pencilMarks.map(row => row.map(set => new Set(set)));
        const currentManualRemovals = manualRemovals.map(row => row.map(set => new Set(set)));

        history.push({
            board: currentBoard,
            pencilMarks: currentPencilMarks,
            manualRemovals: currentManualRemovals
        });

        // Limit history size
        if (history.length > MAX_HISTORY_SIZE) {
            history.shift(); // Remove the oldest state
        }
        historyPointer = history.length - 1;
        updateUndoRedoButtons();
    }

    function drawBoard() {
        console.time('drawBoard_total');
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

        console.time('drawBoard_cell_loop');
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
                console.time('drawBoard_content_check');
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
                console.timeEnd('drawBoard_content_check');

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

                // Compare current classes with newClasses
                console.time('drawBoard_class_check');
                const currentClasses = new Set(cellElement.classList);
                if (currentClasses.size !== newClasses.size || ![...currentClasses].every(cls => newClasses.has(cls))) {
                    cellElement.className = ''; // Clear all existing classes
                    newClasses.forEach(cls => cellElement.classList.add(cls));
                    classesChanged = true;
                }
                console.timeEnd('drawBoard_class_check');

                // Update previous state for next render
                previousBoard[r][c] = currentVal;
                previousPencilMarks[r][c] = new Set(currentPencilMarks); // Deep copy Set
            }
        }
        console.timeEnd('drawBoard_cell_loop');

        // Handle selected cell and highlights
        console.time('drawBoard_selection_highlight');
        if (selectedCell) {
            const reselectedCell = boardElement.querySelector(`[data-row='${boardState.selectedRow}'][data-col='${boardState.selectedCol}']`);
            if (reselectedCell) {
                selectedCell.classList.remove('selected'); // Remove from old selected
                selectedCell = reselectedCell;
                selectedCell.classList.add('selected');
                const num = board[boardState.selectedRow][boardState.selectedCol] || originalBoard[boardState.selectedRow][boardState.selectedCol];
                updateHighlights(num);
            }
        } else {
            // If no cell is selected, ensure no cells are highlighted
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('selected', 'highlighted'));
        }
        console.timeEnd('drawBoard_selection_highlight');
        console.timeEnd('drawBoard_total');
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
        if (selectedCell) {
            selectedCell.classList.remove('selected');
        }
        selectedCell = cell;
        selectedCell.classList.add('selected');

        const num = board[r][c] || originalBoard[r][c];
        updateHighlights(num);
    }

    async function newGame(difficulty) {
        difficultyModal.style.display = 'none';
        setLoading(true); // Set loading state
        setStatusMessage(`Generating ${difficulty} puzzle...`, 'info');
        selectedCell = null;
        updateHighlights(null);
        errorCells = []; // Clear errors on new game
        conflictCells = []; // Clear conflicts on new game
        console.time('newGame_total');
        try {
            console.time('newGame_fetch');
            const response = await fetch(`${BASE_URL}/api/new-game?difficulty=${difficulty}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.timeEnd('newGame_fetch');

            board = data.board;
            originalBoard = data.original_board;
            solution = data.solution;
            initPencilMarks();
            initManualRemovals();

            console.time('newGame_drawBoard');
            drawBoard();
            console.timeEnd('newGame_drawBoard');

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
            console.timeEnd('newGame_total');
        }
    }

    function restartGame() {
        board = originalBoard.map(row => [...row]);
        initPencilMarks();
        initManualRemovals();
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
            saveState(); // Save state after hints are loaded
            setStatusMessage('Hints loaded.', 'info');
        } catch (error) {
            console.error('Error getting hints:', error);
            setStatusMessage(`Failed to get hints: ${error.message}`, 'error');
        } finally {
            setLoading(false); // Clear loading state
        }
    }

    function checkSolution() {
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
        if (!selectedCell) return;
        const r = parseInt(selectedCell.dataset.row);
        const c = parseInt(selectedCell.dataset.col);
        if (originalBoard[r][c] !== 0) return;
        errorCells = [];
        conflictCells = []; // Clear conflicts before re-evaluating

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

        // Check for conflicts after input
        if (board[r][c] !== 0 && errorCheckMode) {
            checkConflicts(r, c, board[r][c]);
        }

        if (autoUpdatePencilEntries) {
            updatePencilMarks(r, c, board[r][c]);
        }

        checkErrors(); // Still check against solution for 'error' class
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
        conflictCells = []; // Clear conflicts on undo/redo
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