import random
import time
import numpy as np
import logging
from typing import Optional, Tuple, List, Set, Dict
import sudokutools


class SudokuGame:
    """Handles the core logic of a Sudoku game."""

    GRID_SIZE: int = 9
    BLOCK_SIZE: int = 3
    

    board: np.ndarray
    original_board: np.ndarray
    solution: np.ndarray

    def __init__(self, difficulty: str = "hard"):
        logging.basicConfig(level=logging.INFO)
        logging.info(f"Creating new game with difficulty: {difficulty}")
        self.difficulty = difficulty
        self.original_board, self.solution = self.generate_puzzle()
        self.board = self.original_board.copy()
        logging.info("Game created successfully")

    def generate_puzzle(self) -> Tuple[np.ndarray, np.ndarray]:
        try:
            logging.info("Attempting to generate puzzle using sudokutools...")
            # Map difficulty to min_count for sudokutools
            difficulty_mapping = {
                "easy": 35,
                "medium": 30,
                "hard": 25
            }
            min_clues = difficulty_mapping.get(self.difficulty, 30)
            
            # Generate the puzzle and its solution
            puzzle = sudokutools.generate.generate(min_count=min_clues)
            solution = puzzle.solve()

            logging.info("Puzzle generated successfully with sudokutools.")
            return np.array(puzzle.board), np.array(solution.board)
        except Exception as e:
            logging.error(f"Error generating puzzle with sudokutools: {e}", exc_info=True)
            # Fallback to original generation if sudokutools fails
            logging.warning("Falling back to original puzzle generation method.")
            return self._original_generate_puzzle()

    def _original_generate_puzzle(self) -> Tuple[np.ndarray, np.ndarray]:
        # This is a simplified version of the original generate_puzzle for fallback
        board: np.ndarray = self._original_generate_solved_board()
        squares_to_remove: int = {"easy": 43, "medium": 51, "hard": 62}.get(self.difficulty, 51)

        cells: List[Tuple[int, int]] = [(r, c) for r in range(self.GRID_SIZE) for c in range(self.GRID_SIZE)]
        random.shuffle(cells)

        squares_removed: int = 0
        for r, c in cells:
            if squares_removed >= squares_to_remove:
                break

            backup: int = board[r, c]
            board[r, c] = 0

            board_copy: np.ndarray = board.copy()
            if not self._original_has_unique_solution(board_copy):
                board[r, c] = backup
            else:
                squares_removed += 1
        
        solution_board: np.ndarray = board.copy()
        self._original_solve_sudoku(solution_board)
        return board, solution_board

    def _original_generate_solved_board(self) -> np.ndarray:
        board: np.ndarray = np.zeros((self.GRID_SIZE, self.GRID_SIZE), dtype=int)
        self._original_solve_sudoku(board, randomize=True)
        return board

    def _original_has_unique_solution(self, board: np.ndarray) -> bool:
        solutions: List[np.ndarray] = []
        self._original_solve_sudoku(board.copy(), find_all=True, solutions_list=solutions, solution_limit=2)
        return len(solutions) == 1

    def _original_solve_sudoku(
        self, 
        board: np.ndarray,
        randomize: bool = False,
        find_all: bool = False,
        solutions_list: Optional[List[np.ndarray]] = None,
        solution_limit: Optional[int] = None
    ) -> bool:
        empty: Optional[Tuple[int, int]] = self._original_find_empty_cell(board)
        if not empty:
            if find_all and solutions_list is not None:
                solutions_list.append(board.copy())
            return True
        row, col = empty
        nums: List[int] = list(range(1, self.GRID_SIZE + 1))
        if randomize:
            random.shuffle(nums)
        for num in nums:
            if self._original_is_valid_move(board, row, col, num):
                board[row, col] = num
                if self._original_solve_sudoku(board, randomize, find_all, solutions_list, solution_limit):
                    if not find_all:
                        return True

                if find_all and solution_limit and solutions_list is not None and len(solutions_list) >= solution_limit:
                    board[row, col] = 0
                    return True

                board[row, col] = 0
        return False

    def _original_find_empty_cell(self, board: np.ndarray) -> Optional[Tuple[int, int]]:
        empty_cells = np.where(board == 0)
        if len(empty_cells[0]) > 0:
            return int(empty_cells[0][0]), int(empty_cells[1][0])
        return None

    def _original_is_valid_move(self, board: np.ndarray, row: int, col: int, num: int) -> bool:
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