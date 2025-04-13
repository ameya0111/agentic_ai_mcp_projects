/**
 * Service for executing Python code using an online API
 */
class PythonService {
  constructor() {
    // We'll use the Replit API for Python execution
    this.apiEndpoint = 'https://replit.com/api/v1/repls/exec';
    this.fallbackEndpoint = 'https://api.replit.com/v1/replrun/python';
    this.backupEndpoint = 'https://api.jdoodle.com/v1/execute';
  }

  /**
   * Execute Python code and return the result
   * @param {string} code - Python code to execute
   * @returns {Promise<{output: string, error: string}>} - Execution result
   */
  async executeCode(code) {
    try {
      console.log('Executing Python code:', code.substring(0, 100) + (code.length > 100 ? '...' : ''));
      
      // First try using Python Tutor's API (which doesn't require API keys)
      const result = await this.executePythonTutor(code);
      
      // Log execution details
      this.logExecutionDetails('Python Tutor', code, result);
      
      return result;
    } catch (error) {
      console.error('Python execution error:', error);
      const errorResult = {
        output: '',
        error: `Failed to execute Python code: ${error.message}. Please try again later or with a different code snippet.`
      };
      
      // Log execution error
      this.logExecutionDetails('Failed', code, errorResult);
      
      return errorResult;
    }
  }
  
  /**
   * Execute Python code using Python Tutor's API
   * This is a free service with limitations but doesn't require API keys
   */
  async executePythonTutor(code) {
    try {
      const response = await fetch('https://pythontutor.com/web_exec_py3.py', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          user_script: code,
          raw_input_json: '[]',
          options_json: JSON.stringify({
            cumulative_mode: false,
            heap_primitives: false,
            show_only_outputs: true,
            py_versions: '3'
          })
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract the output from the response
      let output = '';
      let error = '';
      
      if (data.trace && data.trace.length > 0) {
        // Get the last step in the execution trace
        const lastStep = data.trace[data.trace.length - 1];
        
        // Extract stdout if available
        if (lastStep.stdout) {
          output = lastStep.stdout;
        }
        
        // Check for exceptions
        if (lastStep.exception_msg) {
          error = lastStep.exception_msg;
        }
      }
      
      return { output, error };
    } catch (error) {
      console.error('Python Tutor execution error:', error);
      throw error;
    }
  }
  
  /**
   * Analyze code execution result using Gemini
   * @param {string} code - The original Python code
   * @param {object} result - The execution result {output, error}
   * @returns {Promise<string>} - Analysis from Gemini
   */
  async analyzeResult(code, result) {
    try {
      // Generate context with the execution details
      const context = {
        python_code: code,
        execution_result: result.output,
        execution_error: result.error
      };
      
      // Prepare a detailed prompt for code analysis
      const prompt = `Please analyze this Python code and its execution results. 
      
Code:
\`\`\`python
${code}
\`\`\`

${result.output ? `Execution Output:\n\`\`\`\n${result.output}\n\`\`\`` : ''}
${result.error ? `Execution Error:\n\`\`\`\n${result.error}\n\`\`\`` : ''}

Provide the following in your analysis:
1. A summary of what the code does
2. Key observations about the execution results
3. Any issues or bugs you identify
4. Suggestions for improvements or optimizations
5. Explanations of any complex or interesting code patterns

If there were errors, explain what caused them and how to fix them.`;
      
      // Call Gemini API with this specific context
      const response = await gemini.callAPI([{ role: 'user', content: prompt }], context);
      
      return response.message;
    } catch (error) {
      console.error('Result analysis error:', error);
      return `I couldn't analyze the result due to an error: ${error.message}`;
    }
  }

  /**
   * Log execution details to console and chat log if available
   */
  logExecutionDetails(provider, code, result) {
    // Always log to console
    console.group('Python Execution Details');
    console.log('Provider:', provider);
    console.log('Code size:', code.length, 'bytes');
    console.log('Output size:', result.output?.length || 0, 'bytes');
    console.log('Error:', result.error ? result.error : 'None');
    console.groupEnd();
    
    // Log detailed execution info independently (in addition to what Gemini logs)
    if (window.chat && chat.logFileName) {
      try {
        const logFile = fs.readFile(chat.logFileName);
        
        const executionLog = `## Python Service Execution (${provider})\n\n` +
          `**Execution Timestamp:** ${new Date().toISOString()}\n\n` +
          `**Python Code:**\n\`\`\`python\n${code}\n\`\`\`\n\n` +
          `**Raw Output:**\n\`\`\`\n${result.output || 'No output'}\n\`\`\`\n\n` +
          `**Raw Error:**\n\`\`\`\n${result.error || 'No errors'}\n\`\`\`\n\n` +
          `**Service Provider:** ${provider}\n\n` +
          `---\n\n`;
        
        fs.writeFile(chat.logFileName, logFile.content + executionLog);
      } catch (error) {
        console.error('Error logging Python execution details:', error);
      }
    }
  }
}

// Create global Python service instance
const pythonService = new PythonService(); 