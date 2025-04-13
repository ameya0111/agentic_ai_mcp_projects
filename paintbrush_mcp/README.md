# Paint MCP

A Python-based drawing application that uses Paintbrush on macOS to create drawings based on natural language commands. The system uses FastMCP for communication between components.

## Components

1. **MCP Server** (`paintbrush_mcp.py`)
   - Handles communication with the LLM
   - Provides drawing tools (rectangle, text)
   - Manages Paintbrush application

2. **LLM Communication** (`talk2mcp-2.py`)
   - Communicates with the LLM
   - Processes natural language commands
   - Coordinates drawing operations

3. **Test Scripts**
   - `test_centered_text.py`: Tests text placement in rectangles
   - `grid_click_test.py`: Tests button clicking functionality
   - `test_rectangle.py`: Tests rectangle drawing

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Install Paintbrush (macOS):
   ```bash
   brew install paintbrush
   ```

## Usage

1. Start the MCP server:
   ```bash
   python paintbrush_mcp.py
   ```

2. Run the LLM communication script:
   ```bash
   python talk2mcp-2.py
   ```

3. Test individual components:
   ```bash
   # Test text placement
   python test_centered_text.py
   
   # Test rectangle drawing
   python test_rectangle.py
   ```

## Drawing Tools

### Rectangle
- Draws a rectangle at specified coordinates
- Parameters: x, y, width, height, color, stroke_width
- Example: `draw_rectangle(0, 0, 200, 150)`

### Text
- Adds text to the canvas
- Parameters: x, y, text, color, font_size
- Example: `add_text(0, 0, "Hello World")`

## Notes

- The application uses Paintbrush's native tools
- Text placement requires clicking the "Place" button and then clicking inside the rectangle
- All coordinates are relative to the canvas (400, 300 is center)
- Backup text files are created on the Desktop in case of errors

## Troubleshooting

1. If Paintbrush doesn't respond:
   - Check if Paintbrush is installed
   - Ensure the application has focus
   - Try restarting the MCP server

2. If text placement fails:
   - Check the coordinates in the logs
   - Verify the Place button is being clicked
   - Ensure the text is being placed inside the rectangle

3. If rectangle drawing fails:
   - Check the canvas coordinates
   - Verify the pencil tool is selected
   - Ensure the mouse movements are being tracked 