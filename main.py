from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any
from enum import Enum
import logging

# Configure logging once at the application startup
logging.basicConfig(level=logging.INFO)

from game import SudokuGame

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
app.mount("/sudoku/static", StaticFiles(directory="static"), name="static")

class HintRequest(BaseModel):
    board: List[List[int]]
    manual_removals: List[List[List[int]]]

@app.get("/sudoku", response_class=HTMLResponse)
async def read_root(request: Request) -> HTMLResponse:
    """Serves the main HTML page for the Sudoku game."""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/sudoku/api/new-game")
async def new_game(difficulty: Difficulty = Difficulty.hard) -> Dict[str, List[List[int]]]:
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
        raise HTTPException(status_code=500, detail=f"Failed to generate new Sudoku puzzle: {e}")
    return {
        "board": game.board.tolist(),
        "original_board": game.original_board.tolist(),
        "solution": game.solution.tolist() # For checking on the client side
    }

@app.post("/sudoku/api/get-hints")
async def get_hints(hint_request: HintRequest) -> Dict[str, List[List[List[int]]]]:
    """Provides possible candidates for empty cells on the Sudoku board.

    Args:
        hint_request: A HintRequest object containing the current board and manual removals.

    Returns:
        A dictionary containing a list of possible candidates for each cell.
    """
    try:
        logging.info("Getting hints using sudokutools...")
        from sudokutools.sudoku import Sudoku
        from sudokutools.solve import init_candidates
        
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
        raise HTTPException(status_code=500, detail=f"Failed to get hints: {e}")


@app.post("/sudoku/api/check-solution")
async def check_solution(current_board: List[List[int]]) -> Dict[str, bool]:
    """Checks if the current Sudoku board is correctly solved.

    Args:
        current_board: A list of lists representing the current state of the Sudoku board.

    Returns:
        A dictionary with a boolean indicating whether the board is correctly solved.
    """
    try:
        logging.info("Checking solution using sudokutools...")
        from sudokutools.sudoku import Sudoku
        # Convert the board to a string format that sudokutools can understand
        board_str = "\n".join(["".join(map(str, row)) for row in current_board])
        board = Sudoku.decode(board_str)
        is_correct = board.is_solved()
        logging.info(f"Solution check result: {is_correct}")
        return {"is_correct": is_correct}
    except Exception as e:
        logging.error(f"Error checking solution: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to check solution: {e}")