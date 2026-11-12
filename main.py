from fastapi import FastAPI, Request, HTTPException, Body
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
from typing import List, Dict, Any
from enum import Enum
import logging

# Configure logging once at the application startup
logging.basicConfig(level=logging.INFO)

from game import SudokuGame
from sudokutools.sudoku import Sudoku
from sudokutools.solve import init_candidates


class Difficulty(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"

app = FastAPI()

@app.middleware("http")
async def add_cache_control(request: Request, call_next):
    """Adds Cache-Control header to static files to prevent caching."""
    response = await call_next(request)
    if request.url.path.startswith("/static"):
        response.headers["Cache-Control"] = "no-store"
    return response

templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

GRID_SIZE = 9


def _validate_board_grid(board: List[List[int]]) -> List[List[int]]:
    if len(board) != GRID_SIZE or any(len(row) != GRID_SIZE for row in board):
        raise ValueError("Board must be a 9x9 grid.")
    for row in board:
        for val in row:
            if not isinstance(val, int) or isinstance(val, bool) or not (0 <= val <= 9):
                raise ValueError("Board cell values must be integers between 0 and 9.")
    return board


class HintRequest(BaseModel):
    board: List[List[int]]
    manual_removals: List[List[List[int]]]

    @field_validator("board")
    @classmethod
    def validate_board(cls, v: List[List[int]]) -> List[List[int]]:
        return _validate_board_grid(v)

    @field_validator("manual_removals")
    @classmethod
    def validate_manual_removals(cls, v: List[List[List[int]]]) -> List[List[List[int]]]:
        if len(v) != GRID_SIZE or any(len(row) != GRID_SIZE for row in v):
            raise ValueError("manual_removals must be a 9x9 grid of lists.")
        for row in v:
            for cell_removals in row:
                for val in cell_removals:
                    if not isinstance(val, int) or isinstance(val, bool) or not (1 <= val <= 9):
                        raise ValueError("manual_removals values must be integers between 1 and 9.")
        return v

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request) -> HTMLResponse:
    """Serves the main HTML page for the Sudoku game."""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/new-game")
def new_game(difficulty: Difficulty = Difficulty.hard) -> Dict[str, List[List[int]]]:
    """Generates a new Sudoku puzzle based on the specified difficulty.

    Args:
        difficulty: The desired difficulty level (easy, medium, or hard).

    Returns:
        A dictionary containing the generated board, original board, and solution.
    """
    try:
        logging.info(f"Generating new game with difficulty: {difficulty.value}")
        game = SudokuGame(difficulty=difficulty.value)
        logging.info("New game generated successfully")
    except Exception as e:
        logging.error(f"Error generating new game: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate new Sudoku puzzle.")
    return {
        "board": game.board.tolist(),
        "original_board": game.original_board.tolist(),
        "solution": game.solution.tolist() # For checking on the client side
    }

@app.post("/api/get-hints")
def get_hints(hint_request: HintRequest) -> Dict[str, List[List[List[int]]]]:
    """Provides possible candidates for empty cells on the Sudoku board.

    Args:
        hint_request: A HintRequest object containing the current board and manual removals.

    Returns:
        A dictionary containing a list of possible candidates for each cell.
    """
    try:
        logging.info("Getting hints using sudokutools...")
        
        
        # Convert the board to a string format that sudokutools can understand
        board_str = "\n".join(["".join(map(str, row)) for row in hint_request.board])
        board = Sudoku.decode(board_str)
        
        # Initialize candidates
        init_candidates(board)

        # Create a 2D list of candidates by iterating through each cell
        GRID_SIZE = 9
        candidates = [[board.get_candidates(r, c) for c in range(GRID_SIZE)] for r in range(GRID_SIZE)]

        # Remove manual removals from hints
        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE):
                candidates[r][c] -= set(hint_request.manual_removals[r][c])

        # Convert sets to lists for JSON serialization
        serializable_hints = [[list(s) for s in row] for row in candidates]
        logging.info("Hints generated successfully.")
        return {"hints": serializable_hints}
    except Exception as e:
        logging.error(f"Error getting hints: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get hints.")


@app.post("/api/check-solution")
def check_solution(current_board: List[List[int]]) -> Dict[str, bool]:
    """Checks if the current Sudoku board is correctly solved.

    Args:
        current_board: A list of lists representing the current state of the Sudoku board.

    Returns:
        A dictionary with a boolean indicating whether the board is correctly solved.
    """
    try:
        _validate_board_grid(current_board)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        logging.info("Checking solution using sudokutools...")
        # Convert the board to a string format that sudokutools can understand
        board_str = "\n".join(["".join(map(str, row)) for row in current_board])
        board = Sudoku.decode(board_str)
        is_correct = board.is_solved()
        logging.info(f"Solution check result: {is_correct}")
        return {"is_correct": is_correct}
    except Exception as e:
        logging.error(f"Error checking solution: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to check solution.")