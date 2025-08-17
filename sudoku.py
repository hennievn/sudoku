import random
import time

import pygame
import numpy as np


class SudokuGame:
    """Handles the core logic of a Sudoku game."""

    def __init__(self, difficulty="hard"):
        self.difficulty = difficulty
        self.original_board = self.generate_puzzle()
        self.board = self.original_board.copy()
        solution_board = self.original_board.copy()
        self.solve_sudoku(solution_board)
        self.solution = solution_board

    def generate_puzzle(self):
        board = self.generate_solved_board()
        levels = {"easy": 43, "medium": 51, "hard": 62}  # Increased difficulty
        squares_to_remove = levels.get(self.difficulty, 51)

        cells = [(r, c) for r in range(9) for c in range(9)]
        random.shuffle(cells)

        # --- Timeout logic ---
        start_time = time.time()
        timeout = 4.0  # seconds

        squares_removed = 0
        for r, c in cells:
            if squares_removed >= squares_to_remove:
                break

            # Check for timeout only for hard puzzles as they are the slow ones
            if self.difficulty == 'hard' and (time.time() - start_time > timeout):
                print(f"Puzzle generation for '{self.difficulty}' timed out after {timeout} seconds. "
                      f"Resulting puzzle may be easier.")
                break

            backup = board[r, c]
            board[r, c] = 0

            board_copy = board.copy()
            if not self.has_unique_solution(board_copy):
                board[r, c] = backup
            else:
                squares_removed += 1

        return board

    def generate_solved_board(self):
        board = np.zeros((9, 9), dtype=int)
        self.solve_sudoku(board, randomize=True)
        return board

    def has_unique_solution(self, board):
        solutions = []
        self.solve_sudoku(board.copy(), find_all=True, solutions_list=solutions, solution_limit=2)
        return len(solutions) == 1

    def solve_sudoku(
        self, board, randomize=False, find_all=False, solutions_list=None, solution_limit=None
    ):
        empty = self.find_empty_cell(board)
        if not empty:
            if find_all:
                solutions_list.append(board.copy())
            return True
        row, col = empty
        nums = list(range(1, 10))
        if randomize:
            random.shuffle(nums)
        for num in nums:
            if self.is_valid_move(board, row, col, num):
                board[row, col] = num
                if self.solve_sudoku(board, randomize, find_all, solutions_list, solution_limit):
                    if not find_all:
                        return True

                if find_all and solution_limit and len(solutions_list) >= solution_limit:
                    board[row, col] = 0
                    return True

                board[row, col] = 0
        return False

    def find_empty_cell(self, board):
        empty_cells = np.where(board == 0)
        if len(empty_cells[0]) > 0:
            return empty_cells[0][0], empty_cells[1][0]
        return None

    def is_valid_move(self, board, row, col, num):
        if num in board[row, :]:
            return False
        if num in board[:, col]:
            return False
        start_row, start_col = 3 * (row // 3), 3 * (col // 3)
        if num in board[start_row : start_row + 3, start_col : start_col + 3]:
            return False
        return True

    def is_solved(self):
        return np.array_equal(self.board, self.solution)

    def get_all_possible_marks(self):
        all_marks = [[set() for _ in range(9)] for _ in range(9)]
        for r in range(9):
            for c in range(9):
                if self.board[r, c] == 0:
                    possible = set(range(1, 10))
                    possible -= set(self.board[r, :])
                    possible -= set(self.board[:, c])
                    start_r, start_c = 3 * (r // 3), 3 * (c // 3)
                    possible -= set(self.board[start_r:start_r+3, start_c:start_c+3].flatten())
                    all_marks[r][c] = possible
        return all_marks


class SudokuPygame:
    def __init__(self):
        pygame.init()
        # --- Constants ---
        self.GRID_SIZE = 810
        self.CELL_SIZE = self.GRID_SIZE // 9
        self.SIDEBAR_WIDTH = 275
        self.BOTTOM_MARGIN = 50
        self.SCREEN_WIDTH = self.GRID_SIZE + self.SIDEBAR_WIDTH
        self.SCREEN_HEIGHT = self.GRID_SIZE + self.BOTTOM_MARGIN

        # --- Selenized Dark Color Scheme ---
        self.COLORS = {
            "bg": (16, 60, 72),
            "sidebar_bg": (10, 50, 60),
            "grid": (112, 128, 128),
            "original": (173, 188, 188),
            "user": (86, 182, 194),
            "selected": (250, 87, 80),
            "pencil": (112, 128, 128),
            "error": (250, 87, 80),
            "success": (120, 179, 77),
            "button": (24, 73, 86),
            "button_text": (173, 188, 188),
            "num_highlight": (81, 110, 118),
            "dialog_bg": (24, 73, 86),
            "dialog_border": (173, 188, 188),
        }

        # --- Screen & Fonts ---
        self.screen = pygame.display.set_mode((self.SCREEN_WIDTH, self.SCREEN_HEIGHT))
        pygame.display.set_caption("Sudoku")
        self.splash_font = pygame.font.SysFont("Helvetica", 48, bold=True)
        self.main_font = pygame.font.SysFont("Helvetica", 64, bold=False)
        self.pencil_font = pygame.font.SysFont("Helvetica", 18)
        self.ui_font = pygame.font.SysFont("Helvetica", 24)
        self.help_font = pygame.font.SysFont("Helvetica", 22)
        self.timer_font = pygame.font.SysFont("Helvetica", 32, bold=True)
        self.dialog_font = pygame.font.SysFont("Helvetica", 48, bold=True)

        # --- Splash Screen ---
        self.show_splash_screen("Initializing...")

        # --- Game State ---
        self.game_state = "playing"
        self.start_time = pygame.time.get_ticks()
        self.game = SudokuGame()
        self.user_pencil_marks = [[set() for _ in range(9)] for _ in range(9)]
        self.manual_removals = [[set() for _ in range(9)] for _ in range(9)]
        self.error_cells = []
        self.pencil_mode = False
        self.selected_row, self.selected_col, self.highlighted_number = None, None, None
        self.status_text = f"New '{self.game.difficulty}' game started."
        self.status_color = self.COLORS["original"]
        self.clock = pygame.time.Clock()

        # --- UI Elements ---
        self.buttons = self.setup_buttons()
        self.difficulty_buttons = self.setup_difficulty_buttons()

    def setup_buttons(self):
        btn_w, btn_h = 220, 56
        btn_x = self.GRID_SIZE + (self.SIDEBAR_WIDTH - btn_w) // 2
        y_start = 140
        y_step = 78
        return {
            "new": pygame.Rect(btn_x, y_start, btn_w, btn_h),
            "restart": pygame.Rect(btn_x, y_start + y_step, btn_w, btn_h),
            "pencil": pygame.Rect(btn_x, y_start + 2 * y_step, btn_w, btn_h),
            "hints": pygame.Rect(btn_x, y_start + 3 * y_step, btn_w, btn_h),
            "check": pygame.Rect(btn_x, y_start + 4 * y_step, btn_w, btn_h),
            "help": pygame.Rect(btn_x, y_start + 5 * y_step, btn_w, btn_h),
            "quit": pygame.Rect(btn_x, y_start + 6 * y_step, btn_w, btn_h),
        }

    def setup_difficulty_buttons(self):
        dialog_w, dialog_h = 440, 350
        dialog_x, dialog_y = (self.SCREEN_WIDTH - dialog_w) // 2, (
            self.SCREEN_HEIGHT - dialog_h
        ) // 2
        btn_w, btn_h = 330, 55
        btn_x = dialog_x + (dialog_w - btn_w) // 2
        return {
            "easy": pygame.Rect(btn_x, dialog_y + 80, btn_w, btn_h),
            "medium": pygame.Rect(btn_x, dialog_y + 145, btn_w, btn_h),
            "hard": pygame.Rect(btn_x, dialog_y + 210, btn_w, btn_h),
        }

    def run(self):
        while True:
            self.handle_events()
            self.draw()
            self.clock.tick(30)

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                exit()

            if self.game_state == "showing_help":
                if event.type == pygame.MOUSEBUTTONDOWN or event.type == pygame.KEYDOWN:
                    self.game_state = "playing"
                return

            if self.game_state == "selecting_difficulty":
                if event.type == pygame.MOUSEBUTTONDOWN:
                    self.handle_difficulty_click(event.pos)
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_e:
                        self.new_game("easy")
                    elif event.key == pygame.K_m:
                        self.new_game("medium")
                    elif event.key == pygame.K_h:
                        self.new_game("hard")
                    elif event.key == pygame.K_ESCAPE:
                        self.game_state = "playing"
                return

            if self.game_state == "solved":
                if event.type == pygame.MOUSEBUTTONDOWN or event.type == pygame.KEYDOWN:
                    self.game_state = "selecting_difficulty"
                return

            if event.type == pygame.MOUSEBUTTONDOWN:
                self.handle_mouse_click(event.pos)
            if event.type == pygame.KEYDOWN:
                self.handle_key_press(event.key)

    def handle_difficulty_click(self, pos):
        if self.difficulty_buttons["easy"].collidepoint(pos):
            self.new_game("easy")
        elif self.difficulty_buttons["medium"].collidepoint(pos):
            self.new_game("medium")
        elif self.difficulty_buttons["hard"].collidepoint(pos):
            self.new_game("hard")

    def handle_mouse_click(self, pos):
        mx, my = pos
        if self.buttons["new"].collidepoint(pos):
            self.game_state = "selecting_difficulty"
        elif self.buttons["restart"].collidepoint(pos):
            self.restart_game()
        elif self.buttons["pencil"].collidepoint(pos):
            self.toggle_pencil_mode()
        elif self.buttons["hints"].collidepoint(pos):
            self.fill_hint_pencils()
        elif self.buttons["check"].collidepoint(pos):
            self.check_board_completion()
        elif self.buttons["help"].collidepoint(pos):
            self.game_state = "showing_help"
        elif self.buttons["quit"].collidepoint(pos):
            pygame.quit()
            exit()
        elif mx < self.GRID_SIZE and my < self.GRID_SIZE:
            self.selected_col, self.selected_row = mx // self.CELL_SIZE, my // self.CELL_SIZE
            val = self.game.board[self.selected_row, self.selected_col]
            self.highlighted_number = val if val != 0 else None

    def handle_key_press(self, key):
        # Global shortcuts
        if key == pygame.K_q:
            pygame.quit()
            exit()
        if key == pygame.K_n:
            self.game_state = "selecting_difficulty"
            return
        elif key == pygame.K_s:
            self.restart_game()
            return
        elif key == pygame.K_p:
            self.toggle_pencil_mode()
            return
        elif key == pygame.K_h:
            self.fill_hint_pencils()
            return
        elif key == pygame.K_c:
            self.check_board_completion()
            return
        elif key == pygame.K_i:
            self.game_state = "showing_help"
            return

        # Cell-specific actions
        if self.selected_row is None:
            return

        r, c = self.selected_row, self.selected_col

        # Handle backspace to delete user-entered numbers
        if key == pygame.K_BACKSPACE:
            if self.game.original_board[r, c] == 0 and self.game.board[r, c] != 0:
                self.error_cells = []  # Clear errors when board is modified
                self.game.board[r, c] = 0
                self.user_pencil_marks[r][c].clear()
                self.highlighted_number = None
            return

        # Handle number input
        num = -1
        if pygame.K_1 <= key <= pygame.K_9:
            num = key - pygame.K_0
        elif pygame.K_KP1 <= key <= pygame.K_KP9:
            num = key - pygame.K_KP0

        if num != -1:
            if self.game.original_board[r, c] == 0:
                self.error_cells = []  # Clear errors when board is modified
                if self.pencil_mode:
                    if num in self.user_pencil_marks[r][c]:
                        self.user_pencil_marks[r][c].remove(num)
                        self.manual_removals[r][c].add(num)
                    else:
                        self.user_pencil_marks[r][c].add(num)
                        self.manual_removals[r][c].discard(num)
                    self.game.board[r, c] = 0
                    self.highlighted_number = None
                else:
                    self.game.board[r, c] = num
                    self.user_pencil_marks[r][c].clear()
                    self.highlighted_number = num
                    self.check_board_completion()

    def draw(self):
        self.screen.fill(self.COLORS["bg"])
        self.draw_sidebar()
        self.draw_grid()
        self.draw_number_highlights()
        self.draw_numbers()
        self.draw_errors()
        if self.selected_row is not None:
            self.highlight_selected()
        self.draw_status_message()

        # Dialogs / Overlays
        if self.game_state == "selecting_difficulty":
            self.draw_difficulty_dialog()
        if self.game_state == "solved":
            self.draw_solved_dialog()
        if self.game_state == "showing_help":
            self.draw_help_dialog()

        pygame.display.flip()

    def show_splash_screen(self, text):
        self.screen.fill(self.COLORS["bg"])
        text_surf = self.splash_font.render(text, True, self.COLORS["original"])
        text_rect = text_surf.get_rect(center=(self.SCREEN_WIDTH / 2, self.SCREEN_HEIGHT / 2))
        self.screen.blit(text_surf, text_rect)
        pygame.display.flip()
        pygame.time.wait(20)  # Give the OS time to draw the screen
        pygame.event.pump()

    def draw_sidebar(self):
        sidebar_rect = pygame.Rect(self.GRID_SIZE, 0, self.SIDEBAR_WIDTH, self.GRID_SIZE)
        self.screen.fill(self.COLORS["sidebar_bg"], sidebar_rect)
        self.draw_timer()
        self.draw_buttons()

    def draw_timer(self):
        elapsed_seconds = (pygame.time.get_ticks() - self.start_time) // 1000
        minutes, seconds = divmod(elapsed_seconds, 60)
        time_text = f"{minutes:02}:{seconds:02}"
        text_surf = self.timer_font.render(time_text, True, self.COLORS["original"])
        text_rect = text_surf.get_rect(center=(self.GRID_SIZE + self.SIDEBAR_WIDTH // 2, 80))
        self.screen.blit(text_surf, text_rect)

    def draw_difficulty_dialog(self):
        overlay = pygame.Surface((self.SCREEN_WIDTH, self.SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 180))
        self.screen.blit(overlay, (0, 0))
        dialog_w, dialog_h = 440, 350
        dialog_rect = pygame.Rect(
            (self.SCREEN_WIDTH - dialog_w) // 2,
            (self.SCREEN_HEIGHT - dialog_h) // 2,
            dialog_w,
            dialog_h,
        )
        pygame.draw.rect(self.screen, self.COLORS["dialog_bg"], dialog_rect, border_radius=10)
        pygame.draw.rect(
            self.screen, self.COLORS["dialog_border"], dialog_rect, width=3, border_radius=10
        )
        title_surf = self.dialog_font.render("Select Difficulty", True, self.COLORS["original"])
        self.screen.blit(
            title_surf, title_surf.get_rect(center=(dialog_rect.centerx, dialog_rect.y + 40))
        )
        for level, rect in self.difficulty_buttons.items():
            pygame.draw.rect(self.screen, self.COLORS["button"], rect, border_radius=8)
            text_surf = self.ui_font.render(level.capitalize(), True, self.COLORS["button_text"])
            self.screen.blit(text_surf, text_surf.get_rect(center=rect.center))

    def draw_solved_dialog(self):
        overlay = pygame.Surface((self.SCREEN_WIDTH, self.SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 180))
        self.screen.blit(overlay, (0, 0))
        dialog_w, dialog_h = 550, 300
        dialog_rect = pygame.Rect(
            (self.SCREEN_WIDTH - dialog_w) // 2,
            (self.SCREEN_HEIGHT - dialog_h) // 2,
            dialog_w,
            dialog_h,
        )
        pygame.draw.rect(self.screen, self.COLORS["dialog_bg"], dialog_rect, border_radius=10)
        pygame.draw.rect(
            self.screen, self.COLORS["success"], dialog_rect, width=4, border_radius=10
        )
        title_surf = self.dialog_font.render("Congratulations!", True, self.COLORS["success"])
        self.screen.blit(
            title_surf, title_surf.get_rect(center=(dialog_rect.centerx, dialog_rect.y + 80))
        )
        msg_surf = self.ui_font.render("You solved the puzzle!", True, self.COLORS["original"])
        self.screen.blit(
            msg_surf, msg_surf.get_rect(center=(dialog_rect.centerx, dialog_rect.y + 160))
        )
        click_surf = self.ui_font.render(
            "Click anywhere to start a new game", True, self.COLORS["button_text"]
        )
        self.screen.blit(
            click_surf, click_surf.get_rect(center=(dialog_rect.centerx, dialog_rect.y + 220))
        )

    def draw_help_dialog(self):
        overlay = pygame.Surface((self.SCREEN_WIDTH, self.SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((10, 50, 60, 240))
        self.screen.blit(overlay, (0, 0))

        dialog_w, dialog_h = 750, 650
        dialog_rect = pygame.Rect(
            (self.SCREEN_WIDTH - dialog_w) // 2,
            (self.SCREEN_HEIGHT - dialog_h) // 2,
            dialog_w,
            dialog_h,
        )
        pygame.draw.rect(self.screen, self.COLORS["dialog_bg"], dialog_rect, border_radius=10)
        pygame.draw.rect(
            self.screen, self.COLORS["dialog_border"], dialog_rect, width=3, border_radius=10
        )

        title_surf = self.dialog_font.render("Help & Strategy", True, self.COLORS["original"])
        self.screen.blit(
            title_surf, title_surf.get_rect(center=(dialog_rect.centerx, dialog_rect.y + 50))
        )

        help_text_lines = [
            ("Keyboard Shortcuts:", True),
            ("  Q - Quit Game", False),
            ("  N - New Game", False),
            ("  S - Start Over (Restart)", False),
            ("  P - Toggle Pencil Mode", False),
            ("  H - Fill Hint Pencils", False),
            ("  C - Check Solution", False),
            ("  I - Show this Help Screen", False),
            ("  1-9 - Enter/Pencil Number", False),
            ("  Backspace - Delete Number", False),
            ("", False),
            ("Basic Sudoku Strategy:", True),
            ("  1. Naked Singles: Find cells where only one number is possible.", False),
            ("     Use 'Hint Pencils' (H) to see all possible candidates.", False),
            ("  2. Hidden Singles: Find a number that is a candidate in only one", False),
            ("     cell within a row, column, or 3x3 box.", False),
            ("  3. Cross-Hatching: Scan rows and columns to eliminate where a", False),
            ("     number can be in a specific region.", False),
            ("", False),
            ("Click anywhere or press any key to close this window.", True),
        ]

        line_y = dialog_rect.y + 120
        for line, is_title in help_text_lines:
            font = self.ui_font if is_title else self.help_font
            line_surf = font.render(line, True, self.COLORS["button_text"])
            self.screen.blit(line_surf, (dialog_rect.x + 50, line_y))
            line_y += 35 if is_title else 30

    def draw_grid(self):
        for i in range(10):
            width = 3 if i % 3 == 0 else 1
            pygame.draw.line(
                self.screen,
                self.COLORS["grid"],
                (i * self.CELL_SIZE, 0),
                (i * self.CELL_SIZE, self.GRID_SIZE),
                width,
            )
            pygame.draw.line(
                self.screen,
                self.COLORS["grid"],
                (0, i * self.CELL_SIZE),
                (self.GRID_SIZE, i * self.CELL_SIZE),
                width,
            )

    def draw_number_highlights(self):
        if self.highlighted_number is None:
            return
        for r in range(9):
            for c in range(9):
                if self.game.board[r, c] == self.highlighted_number:
                    pygame.draw.rect(
                        self.screen,
                        self.COLORS["num_highlight"],
                        (c * self.CELL_SIZE, r * self.CELL_SIZE, self.CELL_SIZE, self.CELL_SIZE),
                    )

    def draw_numbers(self):
        for r in range(9):
            for c in range(9):
                val = self.game.board[r, c]
                if val != 0:
                    x, y = (
                        c * self.CELL_SIZE + self.CELL_SIZE // 2,
                        r * self.CELL_SIZE + self.CELL_SIZE // 2,
                    )
                    color = (
                        self.COLORS["original"]
                        if self.game.original_board[r, c] != 0
                        else self.COLORS["user"]
                    )
                    text_surf = self.main_font.render(str(val), True, color)
                    self.screen.blit(text_surf, text_surf.get_rect(center=(x, y)))
                elif self.user_pencil_marks[r][c]:
                    marks_in_cell = self.user_pencil_marks[r][c]
                    sub_cell_size = self.CELL_SIZE / 3.0
                    for num in range(1, 10):
                        if num in marks_in_cell:
                            i = num - 1
                            sub_r, sub_c = i // 3, i % 3
                            px = (
                                (c * self.CELL_SIZE) + (sub_c * sub_cell_size) + (sub_cell_size / 2)
                            )
                            py = (
                                (r * self.CELL_SIZE) + (sub_r * sub_cell_size) + (sub_cell_size / 2)
                            )
                            text_surf = self.pencil_font.render(
                                str(num), True, self.COLORS["pencil"]
                            )
                            self.screen.blit(text_surf, text_surf.get_rect(center=(px, py)))

    def draw_errors(self):
        for r, c in self.error_cells:
            x = c * self.CELL_SIZE
            y = r * self.CELL_SIZE
            pygame.draw.line(self.screen, self.COLORS["error"], (x + 10, y + 10),
                             (x + self.CELL_SIZE - 10, y + self.CELL_SIZE - 10), 4)

    def draw_buttons(self):
        for name, rect in self.buttons.items():
            text = {
                "new": "New Game (N)",
                "restart": "Start Over (S)",
                "pencil": f"Pencil: {'ON' if self.pencil_mode else 'OFF'} (P)",
                "hints": "Hint Pencils (H)",
                "check": "Check (C)",
                "help": "Help (I)",
                "quit": "Quit (Q)",
            }[name]
            pygame.draw.rect(self.screen, self.COLORS["button"], rect, border_radius=8)
            text_surf = self.ui_font.render(text, True, self.COLORS["button_text"])
            self.screen.blit(text_surf, text_surf.get_rect(center=rect.center))

    def draw_status_message(self):
        y_center = self.GRID_SIZE + self.BOTTOM_MARGIN // 2
        text_surf = self.ui_font.render(self.status_text, True, self.status_color)
        text_rect = text_surf.get_rect(center=(self.SCREEN_WIDTH // 2, y_center))
        self.screen.blit(text_surf, text_rect)

    def highlight_selected(self):
        x, y = self.selected_col * self.CELL_SIZE, self.selected_row * self.CELL_SIZE
        pygame.draw.rect(
            self.screen, self.COLORS["selected"], (x, y, self.CELL_SIZE, self.CELL_SIZE), 6
        )

    def new_game(self, difficulty="hard"):
        self.show_splash_screen(f"Generating '{difficulty}' puzzle...")
        self.game = SudokuGame(difficulty=difficulty)
        self.user_pencil_marks = [[set() for _ in range(9)] for _ in range(9)]
        self.manual_removals = [[set() for _ in range(9)] for _ in range(9)]
        self.error_cells = []
        self.status_text = f"New '{self.game.difficulty}' game started."
        self.status_color = self.COLORS["original"]
        self.selected_row, self.selected_col, self.highlighted_number = None, None, None
        self.game_state = "playing"
        self.start_time = pygame.time.get_ticks()

    def restart_game(self):
        self.game.board = self.game.original_board.copy()
        self.user_pencil_marks = [[set() for _ in range(9)] for _ in range(9)]
        self.manual_removals = [[set() for _ in range(9)] for _ in range(9)]
        self.error_cells = []
        self.selected_row, self.selected_col, self.highlighted_number = None, None, None
        self.status_text = "Game restarted. Good luck!"
        self.status_color = self.COLORS["original"]
        self.start_time = pygame.time.get_ticks()
        self.game_state = "playing"

    def toggle_pencil_mode(self):
        self.pencil_mode = not self.pencil_mode
        self.status_text = f"Pencil mode {'activated' if self.pencil_mode else 'deactivated'}."
        self.status_color = self.COLORS["original"]

    def check_board_completion(self):
        if np.count_nonzero(self.game.board) == 81:
            if self.game.is_solved():
                self.game_state = "solved"
                self.error_cells = []
            else:
                self.status_text = "Incorrect cells are marked in red."
                self.status_color = self.COLORS["error"]
                self.find_errors()
        else:
            # This case is for the manual "Check" button before the board is full
            self.status_text = "Board is not yet complete."
            self.status_color = self.COLORS["original"]

    def find_errors(self):
        self.error_cells = []
        for r in range(9):
            for c in range(9):
                if self.game.original_board[r, c] == 0 and self.game.board[r, c] != 0:
                    if self.game.board[r, c] != self.game.solution[r, c]:
                        self.error_cells.append((r, c))

    def fill_hint_pencils(self):
        logical_marks = self.game.get_all_possible_marks()
        for r in range(9):
            for c in range(9):
                logical_marks[r][c] -= self.manual_removals[r][c]
        self.user_pencil_marks = logical_marks
        self.status_text = "Filled in all possible pencil marks."
        self.status_color = self.COLORS["original"]


if __name__ == "__main__":
    SudokuPygame().run()
