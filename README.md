# Sudoku Game

A simple, fast Sudoku game designed to run on a local machine or a remote VPS.

This application uses the custom Python solver library `sudokutools` ([github.com/messersm/sudokutools](https://github.com/messersm/sudokutools)) for difficulty validation and hint processing, alongside a modern, optimized double-buffered Vanilla JS and CSS frontend.

* **Fonts**: Premium Roboto font family.
* **Layouts**: Fully responsive layouts optimized for both Portrait and Landscape viewports (with auto-rearranging palettes).
* **Controls**: Fully interactive number palette, custom settings, live conflict detection, multi-step undo/redo, and direct export to [SudokuWiki.org](https://www.sudokuwiki.org/).
* **Keyboard Navigation**: Select cells using your mouse or focus the board and navigate smoothly using the standard **Arrow Keys** (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`).

---

## Local Development & Setup

### 1. Requirements
Ensure you have Python 3.10+ and the `uv` tool installed (or standard `pip`). Using `uv` is highly recommended for speed and reproducibility.

### 2. Environment Setup
Create a virtual environment and install the required libraries:

```bash
# Create a virtual environment
uv venv

# Activate the virtual environment
# On Linux/macOS:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

# Install locked dependencies
uv pip install -r requirements.txt
```

### 3. Running the Server Locally
Launch the FastAPI server in development reload mode:

```bash
uvicorn main:app --reload
```

Open your browser and navigate to `http://127.0.0.1:8000` to play the game.

---

## Production Deployment (VPS Guide)

This application is optimized to run behind a reverse proxy like **Caddy** and managed as a service using **Systemd**.

### 1. Caddy Server Setup
Add a reverse-proxy entry in your `/etc/caddy/Caddyfile` to securely map your domain name and forward requests:

```caddy
sudoku.vanniekerks.net {
    # Reverse proxy requests to the local Uvicorn application server
    reverse_proxy 127.0.0.1:8000
    
    # Enable standard compression
    encode gzip zstd
    
    # Optional security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy no-referrer-when-downgrade
    }
}
```

Restart Caddy to apply changes:
```bash
sudo systemctl restart caddy
```

### 2. Systemd Service Configuration
To ensure the backend application runs continuously and restarts automatically if the VPS reboots, create a Systemd service file.

Create a new file: `/etc/systemd/system/sudoku.service` with the following configuration (adjusting paths to match your project path and username):

```ini
[Unit]
Description=Sudoku FastAPI Application Service
After=network.target

[Service]
User=hennie
WorkingDirectory=/home/hennie/Play/sudoku
# Use the python executable inside the local uv virtual environment
ExecStart=/home/hennie/Play/sudoku/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

Reload the systemd daemon, enable the service to start at boot, and run the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sudoku.service
sudo systemctl start sudoku.service
```

To monitor application logs, run:
```bash
sudo journalctl -u sudoku.service -f
```

---

*Feel free to use and modify. The visual client features optimized rendering checks and a responsive layout for mobile and desktop screens.*
