# LightAgentIDE - Agentic LLM Plugin

A Chrome extension that transforms your browser into a lightweight IDE with agentic capabilities powered by Gemini AI and Python Tutor.

## Overview

This plugin brings the power of agentic AI to your browser, allowing you to:
- Write and execute Python code with AI assistance
- Get real-time code analysis and suggestions
- Have natural conversations about your code
- Execute code in a secure environment
- Maintain context across multiple interactions

## Core Features

### 1. Agentic Code Execution
- **Python Execution**: Run Python code using Python Tutor's secure execution environment
- **Real-time Analysis**: Get immediate feedback on code execution results
- **Error Handling**: Automatic error detection and suggestions for fixes
- **Context Preservation**: Maintain execution context across multiple runs

### 2. AI-Powered Development
- **Code Generation**: Create new Python files with AI assistance
- **Code Analysis**: Get detailed analysis of code execution results
- **Debugging Help**: AI-assisted debugging with step-by-step guidance
- **Learning Support**: Explanations of code behavior and suggestions for improvement

### 3. Integrated Development Environment
- **File Management**: Create, edit, and manage Python files
- **Terminal Integration**: Execute code directly from the terminal
- **Persistent Storage**: Save your work between sessions
- **Export/Import**: Share your work with others

## Getting Started

### Prerequisites
1. Chrome browser (version 114 or newer)
2. Gemini API key

### Installation
1. Clone this repository
2. Open Chrome Extensions (chrome://extensions/)
3. Enable Developer Mode
4. Click "Load Unpacked" and select the repository directory
5. Configure your Gemini API key in `config.js`:
   ```javascript
   const CONFIG = {
     GEMINI_API_KEY: "your-gemini-api-key"
   };
   ```

## Usage Guide

### Basic Commands
```bash
# Create a new Python file
edit hello.py

# Run a Python file
run hello.py

# Get AI analysis of execution results
analyze hello.py
```

### AI Interaction Examples

1. **Code Generation**
   ```
   "Create a Python function that calculates Fibonacci numbers"
   ```

2. **Code Execution**
   ```
   "Run the Fibonacci function with n=10"
   ```

3. **Result Analysis**
   ```
   "Analyze the execution results and suggest optimizations"
   ```

4. **Debugging**
   ```
   "The code is giving an error. Can you help fix it?"
   ```

### Python Execution Features

- **Secure Execution**: Code runs in Python Tutor's isolated environment
- **Real-time Output**: See execution results immediately
- **Error Handling**: Get detailed error messages and suggestions
- **Resource Limits**: 
  - Execution time limit: 30 seconds
  - Memory limit: 512MB
  - File size limit: 1MB
  - No network access
  - Limited standard library support

## Advanced Features

### 1. Conditional Execution
The plugin supports conditional execution based on code output:
```python
# Example of conditional execution
if number % 2 == 0:
    print("EXECUTE: heap_sort.py")
else:
    print("EXECUTE: merge_sort.py")
```

### 2. Multi-step Operations
Chain multiple operations together:
```python
# Example of multi-step operation
print("STEP 1: Generate data")
print("STEP 2: Process data")
print("STEP 3: Analyze results")
```

### 3. Context Preservation
The AI maintains context across multiple interactions:
- Previous code execution results
- File system state
- Terminal history
- Conversation context

## Security and Limitations

### Security Features
- Code execution in isolated environment
- API key protection
- Input validation
- Resource limits

### Current Limitations
- Python 3.x only
- Limited standard library support
- No network access
- No file system access
- Execution time limits

## Troubleshooting

### Common Issues

1. **API Key Errors**
   - Verify your Gemini API key in `config.js`
   - Check for typos or extra spaces
   - Ensure key is properly quoted

2. **Execution Errors**
   - Check code for syntax errors
   - Verify resource limits aren't exceeded
   - Ensure all required imports are available

3. **Connection Issues**
   - Check internet connection
   - Verify Python Tutor service is accessible
   - Try running the code again

### Getting Help
- Check the console for detailed error messages
- Review the execution logs
- Use the `help` command in the terminal
- Contact support with specific error messages

## Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request
4. Include tests for new features
5. Update documentation as needed

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Gemini AI for the language model
- Python Tutor for the execution environment
- Chrome Extension API
- All contributors and users 