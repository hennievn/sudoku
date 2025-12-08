
import numpy as np

def decode_sudoku_string(s):
    if s.startswith('S9B'):
        s = s[3:]
    
    board = np.zeros((9, 9), dtype=int)
    
    # Split into pairs
    chunks = [s[i:i+2] for i in range(0, len(s), 2)]
    
    for idx, chunk in enumerate(chunks):
        if idx >= 81: break
        r, c = idx // 9, idx % 9
        
        val = int(chunk, 36)
        
        # Check standard definitions
        if val <= 9:
            # Clue (1-9)
            board[r, c] = val
        elif val <= 18:
            # Solved cell (10-18) -> 1-9
            board[r, c] = val - 9
        else:
            # Candidates (19+) -> Empty for our solver purposes
            board[r, c] = 0
            
    return board

def get_candidates(board, r, c):
    if board[r, c] != 0:
        return set()
    
    candidates = set(range(1, 10))
    # Row
    candidates -= set(board[r, :])
    # Col
    candidates -= set(board[:, c])
    # Box
    br, bc = (r // 3) * 3, (c // 3) * 3
    candidates -= set(board[br:br+3, bc:bc+3].flatten())
    
    return candidates

def solve_basic(board):
    """
    Tries to solve the board using ONLY Naked Singles and Hidden Singles.
    Returns (is_solved, steps_taken)
    """
    board = board.copy()
    changed = True
    steps = 0
    
    while changed:
        changed = False
        
        # 1. Naked Singles
        # For each cell, check candidates. If count == 1, fill it.
        for r in range(9):
            for c in range(9):
                if board[r, c] == 0:
                    cands = get_candidates(board, r, c)
                    if len(cands) == 1:
                        val = cands.pop()
                        board[r, c] = val
                        changed = True
                        steps += 1
                        continue # Restart loop or continue? Better to continue but flag changed
        
        if changed: continue
        
        # 2. Hidden Singles
        # For each number 1-9, check rows, cols, boxes.
        # If a number can only go in one spot, fill it.
        for num in range(1, 10):
            # Rows
            for r in range(9):
                possible_cols = []
                for c in range(9):
                    if board[r, c] == 0 and num in get_candidates(board, r, c):
                        possible_cols.append(c)
                if len(possible_cols) == 1:
                    c = possible_cols[0]
                    board[r, c] = num
                    changed = True
                    steps += 1
            
            if changed: break # Restart mainly to update candidates

            # Cols
            for c in range(9):
                possible_rows = []
                for r in range(9):
                    if board[r, c] == 0 and num in get_candidates(board, r, c):
                        possible_rows.append(r)
                if len(possible_rows) == 1:
                    r = possible_rows[0]
                    board[r, c] = num
                    changed = True
                    steps += 1
            
            if changed: break

            # Boxes
            for br in range(0, 9, 3):
                for bc in range(0, 9, 3):
                    possible_cells = []
                    for r in range(br, br+3):
                        for c in range(bc, bc+3):
                            if board[r, c] == 0 and num in get_candidates(board, r, c):
                                possible_cells.append((r, c))
                    if len(possible_cells) == 1:
                        r, c = possible_cells[0]
                        board[r, c] = num
                        changed = True
                        steps += 1
            
            if changed: break
            
    return np.count_nonzero(board) == 81, steps

# User's string
s = "S9Bepepep010406ep09ep0602epep09epep05ep0103epepep02ep08ep03epep05epep0807epepepep040603epepepepepepepepepepepepep08epep03epepepepep05epepepep09ep01epepepepep09epepep"
board = decode_sudoku_string(s)
print("Initial Clues:", np.count_nonzero(board))
solved, steps = solve_basic(board)
print(f"Solved by Basic Methods: {solved}")
print(f"Steps taken: {steps}")
