document.addEventListener('DOMContentLoaded', () => {
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

    // Game state
    let board = [];
    let originalBoard = [];
    let solution = [];
    let pencilMarks = [];
    let manualRemovals = [];
    let selectedCell = null;
    let pencilMode = false;
    let timerInterval;
    let startTime;
    let errorCells = [];

    let history = [];
    let historyPointer = -1;
    const MAX_HISTORY_SIZE = 20; // As discussed, 20 steps

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
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (originalBoard[r][c] === 0 && board[r][c] !== 0) {
                    if (board[r][c] !== solution[r][c]) {
                        errorCells.push([r, c]);
                    }
                }
            }
        }
        drawBoard();
    }

    function initPencilMarks() {
        pencilMarks = Array(9).fill(0).map(() => Array(9).fill(0).map(() => new Set()));
    }

    function initManualRemovals() {
        manualRemovals = Array(9).fill(0).map(() => Array(9).fill(0).map(() => new Set()));
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
        const boardState = {
            selectedRow: selectedCell ? parseInt(selectedCell.dataset.row) : -1,
            selectedCol: selectedCell ? parseInt(selectedCell.dataset.col) : -1,
        };

        boardElement.innerHTML = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r;
                cell.dataset.col = c;

                if (errorCells.some(err => err[0] === r && err[1] === c)) {
                    cell.classList.add('error');
                }

                if (originalBoard[r][c] !== 0) {
                    cell.textContent = originalBoard[r][c];
                    cell.classList.add('original');
                } else if (board[r][c] !== 0) {
                    cell.textContent = board[r][c];
                    cell.classList.add('user-entered');
                } else if (pencilMarks[r][c].size > 0) {
                    const pencilContainer = document.createElement('div');
                    pencilContainer.classList.add('pencil-grid');
                    for (let i = 1; i <= 9; i++) {
                        const mark = document.createElement('div');
                        mark.classList.add('pencil-mark');
                        if (pencilMarks[r][c].has(i)) {
                            mark.textContent = i;
                        }
                        pencilContainer.appendChild(mark);
                    }
                    cell.appendChild(pencilContainer);
                }

                cell.addEventListener('click', () => selectCell(cell, r, c));
                boardElement.appendChild(cell);
            }
        }

        if (boardState.selectedRow !== -1) {
            const reselectedCell = boardElement.querySelector(`[data-row='${boardState.selectedRow}'][data-col='${boardState.selectedCol}']`);
            if (reselectedCell) {
                selectedCell = reselectedCell;
                selectedCell.classList.add('selected');
                const num = board[boardState.selectedRow][boardState.selectedCol] || originalBoard[boardState.selectedRow][boardState.selectedCol];
                updateHighlights(num);
            }
        }
    }

    function updateHighlights(number) {
        document.querySelectorAll('.cell').forEach(c => c.classList.remove('highlighted'));

        if (number && number !== 0) {
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
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
        setStatusMessage(`Generating ${difficulty} puzzle...`, 'info');
        selectedCell = null;
        updateHighlights(null);
        try {
            const response = await fetch(`/api/new-game?difficulty=${difficulty}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            board = data.board;
            originalBoard = data.original_board;
            solution = data.solution;
            initPencilMarks();
            initManualRemovals();
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
        }
    }

    function restartGame() {
        board = originalBoard.map(row => [...row]);
        initPencilMarks();
        initManualRemovals();
        selectedCell = null;
        updateHighlights(null);
        drawBoard();
        saveState(); // Save state after restart
        setStatusMessage('Game restarted.', 'info');
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

    async function getHints() {
        const removalsAsArrays = manualRemovals.map(row => row.map(s => Array.from(s)));
        const response = await fetch('/api/get-hints', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ board: board, manual_removals: removalsAsArrays }),
        });
        const data = await response.json();
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0) {
                    pencilMarks[r][c] = new Set(data.hints[r][c]);
                }
            }
        }
        drawBoard();
        saveState(); // Save state after hints are loaded
        setStatusMessage('Hints loaded.', 'info');
    }

    function checkSolution() {
        let isCorrect = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
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
        if (e.key >= '1' && e.key <= '9') {
            handleCellInput(parseInt(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            handleCellInput(0, true);
        }
    }

    function handleCellInput(value, isBackspace = false) {
        if (!selectedCell) return;
        const r = parseInt(selectedCell.dataset.row);
        const c = parseInt(selectedCell.dataset.col);
        if (originalBoard[r][c] !== 0) return;
        errorCells = [];

        if (isBackspace) {
            board[r][c] = 0;
            pencilMarks[r][c].clear();
            manualRemovals[r][c].clear();
        } else {
            if (pencilMode) {
                if (pencilMarks[r][c].has(value)) {
                    pencilMarks[r][c].delete(value);
                    manualRemovals[r][c].add(value);
                } else {
                    pencilMarks[r][c].add(value);
                    manualRemovals[r][c].delete(value);
                }
                board[r][c] = 0;
            } else {
                board[r][c] = value;
                pencilMarks[r][c].clear();
            }
        }
        checkErrors();
        drawBoard();
        updateHighlights(board[r][c]);
        saveState();
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
            undoButton.disabled = historyPointer <= 0;
        }
        if (redoButton) {
            redoButton.disabled = historyPointer >= history.length - 1;
        }
    }

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

    document.addEventListener('keydown', (e) => {
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
            if (!selectedCell) return;
            const numEntered = parseInt(button.textContent);
            handleCellInput(numEntered);
        });
    });

    pencilIcon.addEventListener('click', (e) => {
        e.preventDefault();
        togglePencilMode();
    });

    penIcon.addEventListener('click', (e) => {
        e.preventDefault();
        if (pencilMode) {
            togglePencilMode();
        }
    });

    backspaceIcon.addEventListener('click', (e) => {
        e.preventDefault();
        if (!selectedCell) return;
        handleCellInput(0, true);
    });

    newGameBtn.addEventListener('click', () => {
        difficultyModal.style.display = 'block';
    });

    easyDifficultyBtn.addEventListener('click', () => newGame('easy'));
    mediumDifficultyBtn.addEventListener('click', () => newGame('medium'));
    hardDifficultyBtn.addEventListener('click', () => newGame('hard'));

    restartBtn.addEventListener('click', restartGame);
    hintBtn.addEventListener('click', getHints);
    checkSolutionBtn.addEventListener('click', checkSolution);
    helpBtn.addEventListener('click', showHelp);
    closeModalBtn.addEventListener('click', hideHelp);

    window.addEventListener('click', (event) => {
        if (event.target == helpModal) {
            hideHelp();
        }
        if (event.target == solvedModal) {
            solvedModal.style.display = 'none';
            difficultyModal.style.display = 'block';
        }
    });

    newGameSolvedBtn.addEventListener('click', () => {
        solvedModal.style.display = 'none';
        difficultyModal.style.display = 'block';
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
});