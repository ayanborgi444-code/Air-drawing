import cv2
import numpy as np
import time
import os
from hand_tracker import HandTracker
import drawing_utils as utils

def main():
    # Parameters
    width, height = 1280, 720
    header_h = 100
    brush_thickness = 15
    eraser_thickness = 50
    
    # Initialize Webcam
    cap = cv2.VideoCapture(0)
    cap.set(3, width)
    cap.set(4, height)
    
    # Initialize Tracker
    detector = HandTracker(detection_con=0.85)
    
    # Initialize Canvas
    canvas = utils.create_canvas(width, height)
    
    # State Variables
    draw_color = (255, 0, 255) # Default Purple
    xp, yp = 0, 0 # Previous points
    
    # Smoothing buffer
    points_buffer = []
    buffer_size = 5
    
    # Tap detection variables
    last_tap_time = 0
    tap_count = 0
    is_tapping = False
    
    print("Air Hand Drawer Started. Press 'q' to quit.")
    
    while True:
        # 1. Import Image
        success, img = cap.read()
        if not success:
            break
            
        img = cv2.flip(img, 1) # Mirror image
        
        # 2. Find Hand Landmarks
        img = detector.find_hands(img)
        lm_list = detector.find_position(img, draw=False)
        
        if len(lm_list) != 0:
            # Tip of index and middle fingers
            x1, y1 = lm_list[8][1:]
            x2, y2 = lm_list[12][1:]
            
            # 3. Check which fingers are up
            fingers = detector.fingers_up()
            
            # Tap Detection (Distance between index and middle tips)
            length, img, _ = detector.find_distance(8, 12, img, draw=False)
            is_tapping_now = length < 40
            
            if is_tapping_now and not is_tapping:
                now = time.time()
                if now - last_tap_time < 0.4:
                    tap_count += 1
                else:
                    tap_count = 1
                last_tap_time = now
                
                # Double Tap Action
                if tap_count == 2:
                    if y1 < header_h:
                        section_w = width // 6
                        if 0 < x1 < section_w:
                            draw_color = (0, 0, 255) # Red
                        elif section_w < x1 < 2 * section_w:
                            draw_color = (0, 255, 0) # Green
                        elif 2 * section_w < x1 < 3 * section_w:
                            draw_color = (255, 0, 0) # Blue
                        elif 3 * section_w < x1 < 4 * section_w:
                            draw_color = (0, 255, 255) # Yellow
                        elif 4 * section_w < x1 < 5 * section_w:
                            draw_color = (255, 255, 255) # White
                        elif 5 * section_w < x1 < 6 * section_w:
                            draw_color = (0, 0, 0) # Eraser
                    tap_count = 0
            is_tapping = is_tapping_now

            # 4. Selection Mode - Two fingers are up
            if fingers[1] and fingers[2]:
                xp, yp = 0, 0
                points_buffer = []
                cv2.rectangle(img, (x1, y1 - 25), (x2, y2 + 25), draw_color, cv2.FILLED)
                if is_tapping_now:
                    cv2.circle(img, (x1, y1), 30, (255, 255, 255), 2)
                
            # 5. Drawing Mode - Index finger is up
            elif fingers[1] and not fingers[2]:
                # Smoothing logic
                points_buffer.append((x1, y1))
                if len(points_buffer) > buffer_size:
                    points_buffer.pop(0)
                
                avg_x = sum(p[0] for p in points_buffer) // len(points_buffer)
                avg_y = sum(p[1] for p in points_buffer) // len(points_buffer)

                cv2.circle(img, (avg_x, avg_y), 15, draw_color, cv2.FILLED)
                
                if xp == 0 and yp == 0:
                    xp, yp = avg_x, avg_y
                
                thickness = eraser_thickness if draw_color == (0, 0, 0) else brush_thickness
                cv2.line(canvas, (xp, yp), (avg_x, avg_y), draw_color, thickness)
                
                xp, yp = avg_x, avg_y
            else:
                xp, yp = 0, 0
                points_buffer = []

        # 6. Overlay Canvas
        img = utils.draw_header(img, draw_color)
        img = utils.overlay_canvas(img, canvas)
        
        # Display
        cv2.imshow("Air Hand Drawer", img)
        
        key = cv2.waitKey(1)
        if key & 0xFF == ord('q'):
            break
        elif key & 0xFF == ord('c'):
            canvas = utils.create_canvas(width, height)
        elif key & 0xFF == ord('s'):
            cv2.imwrite("drawing.png", canvas)
            print("Saved drawing.png")

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
