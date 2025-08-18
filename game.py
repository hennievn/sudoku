import random
import time
import numpy as np
import logging
from typing import Optional, Tuple, List, Set, Dict


class SudokuGame:
    """Handles the core logic of a Sudoku game."""

    GRID_SIZE: int = 9
    BLOCK_SIZE: int = 3
    DIFFICULTY_LEVELS: Dict[str, int] = {"easy": 43, "medium": 51, "hard": 62}  # Moved to class constant

    board: np.ndarray
    original_board: np.ndarray
    solution: np.ndarray

    def __init__(self, difficulty: str = "hard"):
        self.difficulty = difficulty
        self.original_board = self.generate_puzzle()
        self.board = self.original_board.copy()
        solution_board: np.ndarray = self.original_board.copy()
        self.solve_sudoku(solution_board)
        self.solution = solution_board

    def generate_puzzle(self) -> np.ndarray:
        board: np.ndarray = self.generate_solved_board()
        squares_to_remove: int = self.DIFFICULTY_LEVELS.get(self.difficulty, 51)

        cells: List[Tuple[int, int]] = [(r, c) for r in range(self.GRID_SIZE) for c in range(self.GRID_SIZE)]
        random.shuffle(cells)

        # --- Timeout logic ---
        start_time: float = time.time()
        timeout: float = 20.0  # seconds

        squares_removed: int = 0
        for r, c in cells:
            if squares_removed >= squares_to_remove:
                break

            if self.difficulty == 'hard' and (time.time() - start_time > timeout):
                logging.warning(f"Puzzle generation for '{self.difficulty}' timed out after {timeout} seconds. "
                                f"Resulting puzzle may be easier.")
                break

            backup: int = board[r, c]
            board[r, c] = 0

            board_copy: np.ndarray = board.copy()
            if not self.has_unique_solution(board_copy):
                board[r, c] = backup
            else:
                squares_removed += 1

        return board

    def generate_solved_board(self) -> np.ndarray:
        board: np.ndarray = np.zeros((self.GRID_SIZE, self.GRID_SIZE), dtype=int)
        self.solve_sudoku(board, randomize=True)
        return board

    def has_unique_solution(self, board: np.ndarray) -> bool:
        solutions: List[np.ndarray] = []
        self.solve_sudoku(board.copy(), find_all=True, solutions_list=solutions, solution_limit=2)
        return len(solutions) == 1

    def solve_sudoku(
        self, 
        board: np.ndarray,
        randomize: bool = False,
        find_all: bool = False,
        solutions_list: Optional[List[np.ndarray]] = None,
        solution_limit: Optional[int] = None
    ) -> bool:
        empty: Optional[Tuple[int, int]] = self.find_empty_cell(board)
        if not empty:
            if find_all and solutions_list is not None:
                solutions_list.append(board.copy())
            return True
        row, col = empty
        nums: List[int] = list(range(1, self.GRID_SIZE + 1))
        if randomize:
            random.shuffle(nums)
        for num in nums:
            if self.is_valid_move(board, row, col, num):
                board[row, col] = num
                if self.solve_sudoku(board, randomize, find_all, solutions_list, solution_limit):
                    if not find_all:
                        return True

                if find_all and solution_limit and solutions_list is not None and len(solutions_list) >= solution_limit:
                    board[row, col] = 0
                    return True

                board[row, col] = 0
        return False

    def find_empty_cell(self, board: np.ndarray) -> Optional[Tuple[int, int]]:
        empty_cells = np.where(board == 0)
        if len(empty_cells[0]) > 0:
            return int(empty_cells[0][0]), int(empty_cells[1][0])
        return None

    def is_valid_move(self, board: np.ndarray, row: int, col: int, num: int) -> bool:
        if num in board[row, :]:
            return False
        if num in board[:, col]:
            return False
        start_row, start_col = self.BLOCK_SIZE * (row // self.BLOCK_SIZE), self.BLOCK_SIZE * (col // self.BLOCK_SIZE)
        if num in board[start_row : start_row + self.BLOCK_SIZE, start_col : start_col + self.BLOCK_SIZE]:
            return False
        return True

    def is_solved(self) -> bool:
        return np.array_equal(self.board, self.solution)

    @staticmethod
    def get_all_possible_marks(board: np.ndarray) -> List[List[Set[int]]]:
        all_marks: List[List[Set[int]]] = [[set() for _ in range(SudokuGame.GRID_SIZE)] for _ in range(SudokuGame.GRID_SIZE)]
        for r in range(SudokuGame.GRID_SIZE):
            for c in range(SudokuGame.GRID_SIZE):
                if board[r, c] == 0:
                    possible: Set[int] = set(range(1, SudokuGame.GRID_SIZE + 1))
                    possible -= set(board[r, :])
                    possible -= set(board[:, c])
                    start_r, start_c = SudokuGame.BLOCK_SIZE * (r // SudokuGame.BLOCK_SIZE), SudokuGame.BLOCK_SIZE * (c // SudokuGame.BLOCK_SIZE)
                    possible -= set(board[start_r:start_r+SudokuGame.BLOCK_SIZE, start_c:start_c+SudokuGame.BLOCK_SIZE].flatten())
                    all_marks[r][c] = possible
        return all_marks
