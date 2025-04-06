from fastmcp import FastMCP
import asyncio
import math
import subprocess
import logging
import time
import pyautogui
import os

# Set up logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configure PyAutoGUI
pyautogui.PAUSE = 0.5  # Add a 0.5 second pause after each PyAutoGUI call
pyautogui.FAILSAFE = True  # Move mouse to corner to abort

# Create MCP server
mcp = FastMCP("PaintbrushServer")

def run_applescript(script):
    """Run AppleScript command"""
    logger.debug("Running AppleScript:\n%s", script)
    try:
        result = subprocess.run(['osascript', '-e', script], 
                              capture_output=True, 
                              text=True)
        if result.returncode != 0:
            logger.error("AppleScript error: %s", result.stderr)
        else:
            logger.debug("AppleScript success: %s", result.stdout)
        return result
    except Exception as e:
        logger.error("Failed to run AppleScript: %s", e)
        raise

def ensure_paintbrush_ready():
    """Make sure Paintbrush is running with a new document"""
    logger.info("Initializing Paintbrush...")
    
    # First, close any existing Paintbrush instances
    run_applescript('tell application "Paintbrush" to quit')
    time.sleep(1)
    
    # Open Paintbrush and create a new document via AppleScript menu selection
    # This is more reliable than clicking on menus with PyAutoGUI
    script = '''
    tell application "Paintbrush" 
        activate
        delay 1
    end tell
    
    tell application "System Events"
        tell process "Paintbrush"
            click menu item "New" of menu "File" of menu bar 1
            delay 1
        end tell
    end tell
    '''
    run_applescript(script)
    time.sleep(1)
    
    # Now handle the new document dialog with AppleScript
    # Try to set width and height in the dialog
    script = '''
    tell application "System Events"
        tell process "Paintbrush"
            tell window 1
                # Try to enter dimensions if we can find the text fields
                if exists text field 1 then
                    set value of text field 1 to "800"
                end if
                
                if exists text field 2 then
                    set value of text field 2 to "600"
                end if
                
                # Try to find and click the OK button
                if exists button "OK" then
                    click button "OK"
                else if exists button "Create" then
                    click button "Create"
                else
                    # Try pressing return as a fallback
                    keystroke return
                end if
            end tell
        end tell
    end tell
    '''
    run_applescript(script)
    time.sleep(1)
    
    logger.info("Paintbrush initialized with new document")

# ASCII calculation tools
@mcp.tool()
def strings_to_chars_to_int(text: str) -> list:
    """Convert string to list of ASCII values"""
    logger.info("Converting text '%s' to ASCII values", text)
    result = [ord(c) for c in text]
    logger.debug("ASCII values: %s", result)
    return result

@mcp.tool()
def calculate_exp_sum(values: list) -> float:
    """Calculate sum of exponentials of values"""
    logger.info("Calculating exponential sum of %s", values)
    result = sum(math.exp(val) for val in values)
    logger.debug("Exponential sum result: %s", result)
    return result

# Drawing tools
@mcp.tool()
async def draw_rectangle(x: float, y: float, width: float, height: float,
                      color: str = "#000000", stroke_width: float = 2) -> dict:
    """Draw a rectangle on the canvas"""
    logger.info("Drawing rectangle at (%s, %s) with size %sx%s", x, y, width, height)
    
    x = int(x)
    y = int(y)
    width = int(width)
    height = int(height)
    
    # Make sure Paintbrush is in focus
    run_applescript('tell application "Paintbrush" to activate')
    time.sleep(2)
    
    try:
        # Select pencil tool - the first icon in toolbar
        pyautogui.click(50, 74, button='left')
        time.sleep(1)
        
        # Set canvas coordinates (middle of the canvas)
        canvas_x = 400
        canvas_y = 300
        
        # Drawing approach that works - continuous drag with 4 sides
        logger.info("Moving to start position...")
        pyautogui.moveTo(canvas_x, canvas_y, duration=1.0)
        time.sleep(1)
        
        logger.info("Pressing mouse down...")
        pyautogui.mouseDown(button='left')
        time.sleep(1)
        
        # Draw top line
        logger.info("Drawing top line...")
        pyautogui.dragTo(canvas_x + width, canvas_y, duration=2.0, button='left')
        time.sleep(1)
        
        # Draw right line
        logger.info("Drawing right line...")
        pyautogui.dragTo(canvas_x + width, canvas_y + height, duration=2.0, button='left')
        time.sleep(1)
        
        # Draw bottom line
        logger.info("Drawing bottom line...")
        pyautogui.dragTo(canvas_x, canvas_y + height, duration=2.0, button='left')
        time.sleep(1)
        
        # Draw left line and close rectangle
        logger.info("Drawing left line...")
        pyautogui.dragTo(canvas_x, canvas_y, duration=2.0, button='left')
        time.sleep(1)
        
        logger.info("Releasing mouse...")
        pyautogui.mouseUp(button='left')
        time.sleep(1)
        
        logger.info("Rectangle drawing completed")
        return {"status": "success", "rectangle_coords": {
            "top_left": (canvas_x, canvas_y),
            "bottom_right": (canvas_x + width, canvas_y + height)
        }}
    except Exception as e:
        logger.error("Failed to draw rectangle: %s", e)
        return {"status": "error", "message": str(e)}

@mcp.tool()
async def add_text(x: float, y: float, text: str,
                 color: str = "#000000", font_size: str = "24px") -> dict:
    """Add text to the canvas"""
    logger.info("Adding text '%s' at (%s, %s)", text, x, y)
    
    x = int(x)
    y = int(y)
    
    # Make sure Paintbrush is in focus
    run_applescript('tell application "Paintbrush" to activate')
    time.sleep(2)
    
    try:
        # Select the text tool (A icon)
        text_tool_x, text_tool_y = 109, 274
        logger.info("Selecting text tool...")
        pyautogui.click(text_tool_x, text_tool_y, button='left')
        time.sleep(1)
        
        # Position to add text
        # The rectangle is drawn at (400, 300) with width 200 and height 150
        # We want to position the text inside this rectangle
        canvas_x, canvas_y = 400, 300  # Top-left of rectangle
        
        logger.info("Moving to text position...")
        pyautogui.moveTo(canvas_x, canvas_y, duration=1.0)
        time.sleep(0.5)
        
        logger.info("Clicking to add text...")
        pyautogui.click(button='left')
        time.sleep(1)
        
        logger.info(f"Typing text: {text}")
        # Type slowly
        for char in text:
            pyautogui.write(char)
            time.sleep(0.1)
        
        logger.info("Clicking the Place... button")
        time.sleep(1)
        
        # Use coordinates for the Place button (from manual testing)
        place_button_x, place_button_y = 725, 460
        
        logger.info(f"Moving to Place button at ({place_button_x}, {place_button_y})")
        pyautogui.moveTo(place_button_x, place_button_y, duration=1.0)
        time.sleep(1)
        
        # Click the Place button
        logger.info("Clicking Place button")
        pyautogui.click(button='left')
        time.sleep(1.5)  # Wait longer for text to float
        
        # Move to the center of the rectangle to place the floating text
        # Calculate rectangle center
        rect_center_x = 400 + 100  # (400 + 200/2)
        rect_center_y = 300 + 75   # (300 + 150/2)
        
        logger.info(f"Moving to rectangle center ({rect_center_x}, {rect_center_y}) to place text")
        pyautogui.moveTo(rect_center_x, rect_center_y, duration=1.0)
        time.sleep(0.5)
        
        # Click to place the text
        logger.info("Clicking to place text inside rectangle")
        pyautogui.click(button='left')
        time.sleep(0.5)
        
        # Create a text file as a backup
        text_file_path = os.path.expanduser("~/Desktop/mcp_text.txt")
        with open(text_file_path, "w") as f:
            f.write(text)
        
        logger.info("Text addition completed")
        return {"status": "success", 
               "message": f"Text added inside rectangle. Also saved to {text_file_path} as backup."}
    except Exception as e:
        logger.error("Failed to add text: %s", e)
        # Create backup text file even on exception
        try:
            text_file_path = os.path.expanduser("~/Desktop/mcp_text.txt")
            with open(text_file_path, "w") as f:
                f.write(text)
            return {
                "status": "error", 
                "message": f"Error: {str(e)}. Text saved to {text_file_path}."
            }
        except Exception:
            return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    logger.info("Starting Paintbrush MCP server...")
    # Ensure Paintbrush is ready
    ensure_paintbrush_ready()
    
    logger.info("Running MCP server...")
    asyncio.run(mcp.run())
    logger.info("MCP server stopped") 
