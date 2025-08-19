from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any
import numpy as np
from enum import Enum
import logging

from game import SudokuGame

class Difficulty(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"

app = FastAPI()

@app.middleware("http")
async def add_cache_control(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static"):
        response.headers["Cache-Control"] = "no-store"
    return response

templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

class HintRequest(BaseModel):
    board: List[List[int]]
    manual_removals: List[List[List[int]]]

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/new-game")
async def new_game(difficulty: Difficulty = Difficulty.hard) -> Dict[str, List[List[int]]]:
    try:
        logging.basicConfig(level=logging.INFO)
        logging.info(f"Generating new game with difficulty: {difficulty.value}")
        game = SudokuGame(difficulty=difficulty.value)
        logging.info("New game generated successfully")
    # Consider refining this to catch more specific exceptions from SudokuGame if they are introduced.
    except Exception as e:
        logging.error(f"Error generating new game: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate new Sudoku puzzle: {e}")
    return {
        "board": game.board.tolist(),
        "original_board": game.original_board.tolist(),
        "solution": game.solution.tolist() # For checking on the client side
    }

@app.post("/api/get-hints")
async def get_hints(hint_request: HintRequest) -> Dict[str, List[List[List[int]]]]:
    try:
        logging.info("Getting hints using sudokutools...")
        from sudokutools.sudoku import Sudoku
        board = Sudoku(hint_request.board)
        candidates = board.get_candidates()

        # Remove manual removals from hints
        for r in range(board.size):
            for c in range(board.size):
                candidates[r][c] -= set(hint_request.manual_removals[r][c])

        # Convert sets to lists for JSON serialization
        serializable_hints = [[list(s) for s in row] for row in candidates]
        logging.info("Hints generated successfully.")
        return {"hints": serializable_hints}
    except Exception as e:
        logging.error(f"Error getting hints: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get hints: {e}")

@app.post("/api/check-solution")
async def check_solution(current_board: List[List[int]]) -> Dict[str, bool]:
    try:
        logging.info("Checking solution using sudokutools...")
        from sudokutools.sudoku import Sudoku
        board = Sudoku(current_board)
        is_correct = board.is_solved()
        logging.info(f"Solution check result: {is_correct}")
        return {"is_correct": is_correct}
    except Exception as e:
        logging.error(f"Error checking solution: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to check solution: {e}")
