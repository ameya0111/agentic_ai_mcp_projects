from fastmcp import FastMCP
import asyncio
import math
import aiohttp


# Create MCP server
mcp = FastMCP("ExampleServer")


async def send_to_node_server(command_data):
    """Send command to Node.js server"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                'http://localhost:3000/api/draw',
                json=command_data
            ) as response:
                return await response.json()
    except Exception as e:
        print(f"Error sending command to Node server: {e}")
        return None


# ASCII calculation tools
@mcp.tool()
def strings_to_chars_to_int(text: str) -> list:
    """Convert string to list of ASCII values"""
    return [ord(c) for c in text]


@mcp.tool()
def calculate_exp_sum(values: list) -> float:
    """Calculate sum of exponentials of values"""
    return sum(math.exp(val) for val in values)


# Paint tools
@mcp.tool()
async def draw_rectangle(x: float, y: float, width: float, height: float,
                      color: str = "#000000", stroke_width: float = 2) -> dict:
    """Draw a rectangle on the canvas"""
    command_data = {
        "command": "drawRectangle",
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "color": color,
        "strokeWidth": stroke_width
    }
    result = await send_to_node_server(command_data)
    return {"status": "success" if result else "error"}


@mcp.tool()
async def draw_line(start_x: float, start_y: float, end_x: float, end_y: float,
                  color: str = "#000000", width: float = 2) -> dict:
    """Draw a line on the canvas"""
    command_data = {
        "command": "drawLine",
        "startX": start_x,
        "startY": start_y,
        "endX": end_x,
        "endY": end_y,
        "color": color,
        "width": width
    }
    result = await send_to_node_server(command_data)
    return {"status": "success" if result else "error"}


@mcp.tool()
async def add_text(x: float, y: float, text: str,
                 color: str = "#000000", font_size: str = "16px") -> dict:
    """Add text to the canvas"""
    command_data = {
        "command": "addText",
        "x": x,
        "y": y,
        "text": text,
        "color": color,
        "fontSize": font_size
    }
    result = await send_to_node_server(command_data)
    return {"status": "success" if result else "error"}


if __name__ == "__main__":
    asyncio.run(mcp.run()) 
