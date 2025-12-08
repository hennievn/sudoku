
import sys
import logging
from game import SudokuGame
import numpy as np

# Configure logging to show generated puzzles
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def test_hard_difficulty_generation():
    print("Testing Hard difficulty generation...")
    game = SudokuGame(difficulty="hard")
    
    board = game.original_board
    clues = np.count_nonzero(board)
    print(f"Generated Board with {clues} clues.")
    
    # Check if it was solved by basic methods (it should NOT be)
    is_basic, steps = game._solve_basic(board)
    
    if is_basic:
        print(f"FAILURE: Generated 'Hard' puzzle was solvable by basic methods in {steps} steps.")
        sys.exit(1)
    else:
        print(f"SUCCESS: Generated 'Hard' puzzle was NOT solvable by basic methods (stuck after {steps} steps).")
        sys.exit(0)

if __name__ == "__main__":
    test_hard_difficulty_generation()
