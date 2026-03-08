import cv2
import numpy as np

def create_canvas(width, height):
    """Creates a blank black canvas for drawing."""
    return np.zeros((height, width, 3), np.uint8)

def draw_header(img, draw_color):
    """Draws the color palette header on the image."""
    # Define colors (B, G, R)
    colors = {
        "Red": (0, 0, 255),
        "Green": (0, 255, 0),
        "Blue": (255, 0, 0),
        "Yellow": (0, 255, 255),
        "White": (255, 255, 255),
        "Eraser": (0, 0, 0)
    }
    
    h, w, _ = img.shape
    header_h = 100
    section_w = w // 6
    
    # Draw background for header
    cv2.rectangle(img, (0, 0), (w, header_h), (50, 50, 50), cv2.FILLED)
    
    for i, (name, color) in enumerate(colors.items()):
        start_x = i * section_w
        end_x = (i + 1) * section_w
        
        # Highlight selected color
        thickness = cv2.FILLED
        if color == draw_color:
            cv2.rectangle(img, (start_x + 5, 5), (end_x - 5, header_h - 5), (255, 255, 255), 2)
            
        cv2.rectangle(img, (start_x + 10, 10), (end_x - 10, header_h - 10), color, thickness)
        cv2.putText(img, name, (start_x + 20, header_h - 20), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
    
    return img

def overlay_canvas(img, canvas):
    """Overlays the drawing canvas onto the webcam image."""
    img_gray = cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY)
    _, img_inv = cv2.threshold(img_gray, 50, 255, cv2.THRESH_BINARY_INV)
    img_inv = cv2.cvtColor(img_inv, cv2.COLOR_GRAY2BGR)
    img = cv2.bitwise_and(img, img_inv)
    img = cv2.bitwise_or(img, canvas)
    return img
