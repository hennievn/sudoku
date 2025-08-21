import random
import time
import numpy as np
import logging
from typing import Optional, Tuple, List, Set, Dict
from sudokutools import generate
from sudokutools.solve import bruteforce


class SudokuGame:
    """Handles the core logic of a Sudoku game.

    Attributes:
        GRID_SIZE (int): The size of the Sudoku grid (9 for standard Sudoku).
        BLOCK_SIZE (int): The size of each block within the Sudoku grid (3 for standard Sudoku).
        board (np.ndarray): The current state of the Sudoku board.
        original_board (np.ndarray): The initial state of the Sudoku puzzle (with empty cells).
        solution (np.ndarray): The solved state of the Sudoku board.
    """

    GRID_SIZE: int = 9
    BLOCK_SIZE: int = 3
    

    board: np.ndarray
    original_board: np.ndarray
    solution: np.ndarray

    def __init__(self, difficulty: str = "hard"):
        """Initializes a new Sudoku game.

        Args:
            difficulty (str): The difficulty level of the puzzle (e.g., "easy", "medium", "hard").
        """
        logging.info(f"Creating new game with difficulty: {difficulty}")
        self.difficulty = difficulty
        self.original_board, self.solution = self.generate_puzzle()
        self.board = self.original_board.copy()
        logging.info("Game created successfully")

    def generate_puzzle(self) -> Tuple[np.ndarray, np.ndarray]:
        """Generates a new Sudoku puzzle and its solution using sudokutools.

        The difficulty of the puzzle is determined by the 'difficulty' attribute of the game instance.
        If sudokutools fails, it falls back to a simplified version of the original generation method.

        Returns:
            Tuple[np.ndarray, np.ndarray]: A tuple containing the generated puzzle board and its solution.
        """
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
            puzzle = generate.generate(min_count=min_clues)
            solution = list(bruteforce(puzzle))[0]

            logging.info("Puzzle generated successfully with sudokutools.")
            return self._convert_sudoku_to_numpy(puzzle), self._convert_sudoku_to_numpy(solution)
        except Exception as e:
            logging.error(f"Error generating puzzle with sudokutools: {e}", exc_info=True)
            # Fallback to original generation if sudokutools fails
            logging.warning("Falling back to original puzzle generation method.")
            return self._original_generate_puzzle()

    def _original_generate_puzzle(self) -> Tuple[np.ndarray, np.ndarray]:
        """Generates a Sudoku puzzle using the original backtracking method (fallback).

        This method is used as a fallback if sudokutools-based generation fails.

        Returns:
            Tuple[np.ndarray, np.ndarray]: A tuple containing the generated puzzle board and its solution.
        """
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
        """Generates a complete and solved Sudoku board using the original backtracking method.

        This method is part of the fallback puzzle generation.

        Returns:
            np.ndarray: A completely filled and valid Sudoku board.
        """
        board: np.ndarray = np.zeros((self.GRID_SIZE, self.GRID_SIZE), dtype=int)
        self._original_solve_sudoku(board, randomize=True)
        return board

    def _original_has_unique_solution(self, board: np.ndarray) -> bool:
        """Checks if a given Sudoku board has a unique solution using the original solver.

        This method is part of the fallback puzzle generation.

        Args:
            board (np.ndarray): The Sudoku board to check.

        Returns:
            bool: True if the board has a unique solution, False otherwise.
        """
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
        """Solves a Sudoku board using a backtracking algorithm (original solver).

        This method is part of the fallback puzzle generation.

        Args:
            board (np.ndarray): The Sudoku board to solve.
            randomize (bool): If True, shuffles the numbers to try, leading to different solutions.
            find_all (bool): If True, finds all possible solutions up to 'solution_limit'.
            solutions_list (Optional[List[np.ndarray]]): A list to store found solutions when 'find_all' is True.
            solution_limit (Optional[int]): The maximum number of solutions to find when 'find_all' is True.

        Returns:
            bool: True if a solution is found, False otherwise.
        """
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
        """Finds the next empty cell (0) in the Sudoku board (original solver).

        This method is part of the fallback puzzle generation.

        Args:
            board (np.ndarray): The Sudoku board to search.

        Returns:
            Optional[Tuple[int, int]]: A tuple (row, col) of the empty cell, or None if no empty cells are found.
        """
        empty_cells = np.where(board == 0)
        if len(empty_cells[0]) > 0:
            return int(empty_cells[0][0]), int(empty_cells[1][0])
        return None

    def _original_is_valid_move(self, board: np.ndarray, row: int, col: int, num: int) -> bool:
        """Checks if placing a number in a cell is a valid move according to Sudoku rules (original solver).

        This method is part of the fallback puzzle generation.

        Args:
            board (np.ndarray): The current Sudoku board.
            row (int): The row index.
            col (int): The column index.
            num (int): The number to place.

        Returns:
            bool: True if the move is valid, False otherwise.
        """
        if num in board[row, :]:
            return False
        if num in board[:, col]:
            return False
        start_row, start_col = self.BLOCK_SIZE * (row // self.BLOCK_SIZE), self.BLOCK_SIZE * (col // self.BLOCK_SIZE)
        if num in board[start_row : start_row + self.BLOCK_SIZE, start_col : start_col + self.BLOCK_SIZE]:
            return False
        return True

    def is_solved(self) -> bool:
        """Checks if the current board matches the solution.

        Returns:
            bool: True if the board is solved, False otherwise.
        """
        return np.array_equal(self.board, self.solution)

    def _convert_sudoku_to_numpy(self, sudoku_obj) -> np.ndarray:
        np_array = np.zeros((self.GRID_SIZE, self.GRID_SIZE), dtype=int)
        for r in range(self.GRID_SIZE):
            for c in range(self.GRID_SIZE):
                np_array[r, c] = sudoku_obj[r, c]
        return np_array