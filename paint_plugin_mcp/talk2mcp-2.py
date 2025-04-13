import os
import json
import re
import sys
import asyncio
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters, types
from mcp.client.stdio import stdio_client
from google import genai
from concurrent.futures import TimeoutError

# Load environment variables
load_dotenv()

def read_gemini_config():
    try:
        with open('config.js', 'r') as f:
            config_text = f.read()
            api_key_match = re.search(r'GEMINI_API_KEY:\s*"([^"]+)"', config_text)
            if not api_key_match:
                raise ValueError("Could not find Gemini API key in config.js")
            return api_key_match.group(1)
    except Exception as e:
        raise RuntimeError(f"Error reading config.js: {e}")

api_key = read_gemini_config()
client = genai.Client(api_key=api_key)

max_iterations = 5
last_response = None
iteration = 0
iteration_response = []

def reset_state():
    global last_response, iteration, iteration_response
    last_response = None
    iteration = 0
    iteration_response = []

async def generate_with_timeout(client, prompt, timeout=10):
    try:
        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt
                )
            ),
            timeout=timeout
        )
        return response
    except (TimeoutError, Exception) as e:
        raise RuntimeError(f"LLM generation failed: {e}")

async def main():
    reset_state()
    try:
        server_params = StdioServerParameters(
            command=sys.executable,
            args=["paintbrush_mcp.py"]
        )

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools_result = await session.list_tools()
                tools = tools_result.tools

                tools_description = []
                for i, tool in enumerate(tools):
                    try:
                        params = tool.inputSchema
                        desc = getattr(tool, 'description', 'No description available')
                        name = getattr(tool, 'name', f'tool_{i}')
                        if 'properties' in params:
                            param_details = [
                                f"{k}: {v.get('type', 'unknown')}"
                                for k, v in params['properties'].items()
                            ]
                            params_str = ', '.join(param_details)
                        else:
                            params_str = 'no parameters'
                        tools_description.append(f"{i+1}. {name}({params_str}) - {desc}")
                    except Exception as e:
                        tools_description.append(f"{i+1}. Error processing tool")

                tools_description = "\n".join(tools_description)

                system_prompt = f"""You are a math agent solving problems. You have access to various tools.

Available tools:
{tools_description}

You must respond with EXACTLY ONE line in one of these formats (no additional text):
1. For function calls:
   FUNCTION_CALL: function_name|param1|param2|...
   
2. For final answers:
   FINAL_ANSWER: [number]

Important:
- When a function returns multiple values, you need to process all of them
- Only give FINAL_ANSWER when you have completed all necessary calculations AND displayed them
- Do not repeat function calls with the same parameters
- After calculating a result, you must:
  1. Draw a rectangle using draw_rectangle
  2. Display the result inside the rectangle using add_text
  3. Then give FINAL_ANSWER

Examples:
- FUNCTION_CALL: strings_to_chars_to_int|HELLO
- FUNCTION_CALL: calculate_exp_sum|[1,2,3]
- FUNCTION_CALL: draw_rectangle|100|100|400|100|#000000|2
- FUNCTION_CALL: add_text|120|150|Result: 42|#000000|24px
- FINAL_ANSWER: [42]

DO NOT include any explanations or additional text.
Your entire response should be a single line starting with either FUNCTION_CALL: or FINAL_ANSWER:"""

                query = """Find the ASCII values of characters in INDIA, calculate the sum of exponentials of those values, then draw a rectangle and display the result inside it."""

                global iteration, last_response
                while iteration < max_iterations:
                    print(f"\n--- Iteration {iteration + 1} ---")
                    current_query = query if last_response is None else build_context(query)

                    prompt = f"{system_prompt}\n\nQuery: {current_query}"
                    response = await generate_with_timeout(client, prompt)
                    response_text = extract_single_response_line(response.text)

                    if response_text.startswith("FUNCTION_CALL:"):
                        await handle_function_call(response_text, tools, session)
                    elif response_text.startswith("FINAL_ANSWER:"):
                        print(f"Final Answer: {response_text}")
                        if all_steps_completed():
                            break

                    iteration += 1

    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        reset_state()

def build_context(query):
    steps, calc_result = [], None
    for op in iteration_response:
        if "strings_to_chars_to_int" in op:
            steps.append("1. Got ASCII values")
        elif "calculate_exp_sum" in op:
            steps.append("2. Calculated exponential sum")
            calc_result = re.search(r'returned \[(.*?)\]', op)
            calc_result = calc_result.group(1) if calc_result else None
        elif "draw_rectangle" in op:
            steps.append("3. Drew rectangle")
        elif "add_text" in op:
            steps.append("4. Added text")
    context = f"{query}\nCompleted steps:\n{chr(10).join(steps)}"
    if calc_result:
        context += f"\nCalculated result: {calc_result}"
    if iteration_response:
        context += f"\nLast operation: {iteration_response[-1]}"
    if len(steps) == 4:
        context += "\nAll steps completed. Please provide FINAL_ANSWER with the calculated result."
    return context

def extract_single_response_line(text):
    for line in text.strip().split('\n'):
        if line.startswith("FUNCTION_CALL:") or line.startswith("FINAL_ANSWER:"):
            return line.strip()
    return text.strip()

async def handle_function_call(line, tools, session):
    global iteration_response, last_response
    _, function_info = line.split(":", 1)
    parts = [p.strip() for p in function_info.split("|")]
    func_name, params = parts[0], parts[1:]

    tool = next((t for t in tools if t.name == func_name), None)
    if not tool:
        raise ValueError(f"Unknown tool: {func_name}")

    schema_properties = tool.inputSchema.get('properties', {})
    arguments = {}
    for param_name, param_info in schema_properties.items():
        if not params:
            raise ValueError(f"Not enough parameters for {func_name}")
        value = params.pop(0)
        param_type = param_info.get('type', 'string')
        if param_type == 'integer':
            arguments[param_name] = int(value)
        elif param_type == 'number':
            arguments[param_name] = float(value)
        elif param_type == 'array':
            value = value.strip('[]').split(',') if isinstance(value, str) else value
            arguments[param_name] = [int(x.strip()) for x in value]
        else:
            arguments[param_name] = str(value)

    result = await session.call_tool(func_name, arguments=arguments)
    content = result.content if hasattr(result, 'content') else result
    content = content if isinstance(content, list) else [str(content)]
    result_str = f"[{', '.join(map(str, content))}]"
    operation_str = f"{func_name} returned {result_str}"
    iteration_response.append(operation_str)
    last_response = content

def all_steps_completed():
    return len([step for step in iteration_response if any(s in step for s in ["strings_to_chars_to_int", "calculate_exp_sum", "draw_rectangle", "add_text"])]) >= 4

if __name__ == "__main__":
    asyncio.run(main())
