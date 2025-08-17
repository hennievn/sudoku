from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any
import numpy as np
from enum import Enum

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
    game = SudokuGame(difficulty=difficulty.value)
    return {
        "board": game.board.tolist(),
        "original_board": game.original_board.tolist(),
        "solution": game.solution.tolist() # For checking on the client side
    }

@app.post("/api/get-hints")
async def get_hints(hint_request: HintRequest) -> Dict[str, List[List[List[int]]]]:
    board = np.array(hint_request.board)
    all_marks: List[List[set]] = SudokuGame.get_all_possible_marks(board)

    # Remove manual removals from hints
    for r in range(9):
        for c in range(9):
            all_marks[r][c] -= set(hint_request.manual_removals[r][c])

    # Convert sets to lists for JSON serialization
    serializable_hints = [[list(s) for s in row] for row in all_marks]
            
    return {"hints": serializable_hints}