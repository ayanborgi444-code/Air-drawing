# Air Hand Drawer

A professional Computer Vision project that allows you to draw in the air using hand gestures captured through your webcam.

## Features
- **Virtual Color Palette**: Select colors (Red, Green, Blue, Yellow, White) or use the Eraser.
- **Gesture Control**:
  - **Drawing Mode**: Index finger up, Middle finger down.
  - **Selection Mode**: Both Index and Middle fingers up.
- **Clear Canvas**: Reset your drawing instantly.
- **Real-time Performance**: Optimized tracking using MediaPipe.

## Installation

1. Clone this repository or download the source files.
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

Run the main script:
```bash
python main.py
```

### Controls
- **Hover** over the top palette to select a color or tool.
- **Draw** by raising only your index finger.
- **Select/Move** by raising both index and middle fingers.
- **Press 'c'** to clear the canvas.
- **Press 's'** to save the current drawing.
- **Press 'q'** to quit.

## Project Structure
- `main.py`: The entry point of the application.
- `hand_tracker.py`: Contains the `HandTracker` class for landmark detection.
- `drawing_utils.py`: Handles the drawing canvas and UI overlays.
- `requirements.txt`: List of Python dependencies.
