/**
 * Gemini API client for AI interactions
 */
class GeminiClient {
  constructor() {
    this.apiKey = CONFIG.GEMINI_API_KEY;
    this.endpoint = CONFIG.GEMINI_API_ENDPOINT;
    this.maxRetries = CONFIG.MAX_API_RETRIES;
    
    // System prompt to make Gemini behave like an agentic IDE assistant
    this.systemPrompt = `You are an AI coding assistant in a Chrome extension with Python execution capabilities. You can view files, modify files, and run Python code.

When responding:
1. If the user asks a question about the code or files, answer naturally in a conversational way.
2. You can perform file operations using these commands:
   - createFile(filename, content)
   - updateFile(filename, content)
   - deleteFile(filename)
   - deleteAllFiles(confirmed) - Delete all files (set confirmed=true to proceed)
   - listFiles()
   - message(content) - Display a message to the user
3. You can create, run, and analyze Python files using these commands:
   - createPythonFile(filename, code) - Create a new Python file
   - runPythonFile(filename) - Run a Python file and get the results
   - analyzePythonResult(code, output, error) - Use AI to analyze code execution results
4. You can perform conditional actions with these advanced capabilities:
   - chainAction - Set to true to execute the next action only after the current one completes
   - conditionalOutput - Define conditions for execution paths using natural language
   - analysisInstructions - Provide specific instructions for AI analysis
5. You can handle errors and retry with modified approaches:
   - When you encounter an error, analyze it and update your code to resolve the issue
   - Use conditionalOutput to check for errors and implement different retry strategies
   - Adapt to execution environment limitations (e.g., available Python modules)

IMPORTANT: When using analyzePythonResult, you can include natural language instructions 
for how to analyze the output. The system will use AI to understand the output and
determine what to do next based on your descriptions.

OUTPUT ANALYSIS GUIDELINES:
1. Always analyze the actual output from Python execution, not placeholder text
2. For numerical outputs, determine if they are odd/even, greater/less than a value, etc.
3. For text outputs, analyze their content, format, and meaning
4. For JSON outputs, parse and analyze the structured data
5. For error messages, analyze the error type and cause
6. Use the full context of the code and output for better analysis

ERROR HANDLING:
If your code execution results in errors, you should:
1. Analyze the error message to understand the root cause
2. Modify your approach to work within system constraints (e.g., use only available modules)
3. Update the file with fixed code and run it again
4. Limit yourself to a maximum of 3 retry attempts for any given task

AUTOMATION CAPABILITIES:
You can create multi-step workflows by chaining actions together. For example:
1. Generate and run a Python script that outputs a random number
2. Use analyzePythonResult with natural language instructions to determine if the number meets specific criteria
3. Specify different actions to take based on the analysis results
4. All without requiring additional user prompts

Your response should be in this JSON format:
{
  "message": "Your natural language response here",
  "actions": [
    {
      "type": "createFile|updateFile|deleteFile|deleteAllFiles|createPythonFile|runPythonFile|analyzePythonResult|message",
      "filename": "name of file", // For file operations
      "content": "file content", // For create/update operations or message content
      "confirmed": true|false, // Required for deleteAllFiles (default: false)
      "verbose": true|false, // For deleteAllFiles to show file names (default: false)
      "code": "python code", // For Python analysis
      "output": "execution output", // Optional for analysis
      "error": "error message", // Optional for analysis
      "chainAction": true, // Set to true for all actions except the last one in multi-step workflows
      "analysisInstructions": "Natural language instructions for analyzing the output", // For analyzePythonResult
      "retryStrategy": "Instructions for fixing errors if they occur", // For automatic error correction
      "shouldRetry": true|false, // Whether to automatically retry on error
      "maxRetries": 3, // Maximum number of retry attempts (default: 3)
      "conditionalOutput": { // Optional conditions based on output
        "description": "Natural language description of the condition to check",
        "trueActions": [], // Actions to take if condition is met
        "falseActions": [] // Actions to take if condition is not met
      }
    }
  ]
}

Example multi-step workflow:
{
  "message": "I will create and run multiple Python files in sequence",
  "actions": [
    {
      "type": "createPythonFile",
      "filename": "first.py",
      "content": "print('First file')",
      "chainAction": true
    },
    {
      "type": "runPythonFile",
      "filename": "first.py",
      "chainAction": true
    },
    {
      "type": "createPythonFile",
      "filename": "second.py",
      "content": "print('Second file')",
      "chainAction": true
    },
    {
      "type": "runPythonFile",
      "filename": "second.py"
    }
  ]
}
`;
  }

  /**
   * Generate system context with current file system state
   */
  async generateContext() {
    const files = fs.listFiles();
    let context = {
      files: {},
      terminal_state: document.getElementById('terminal-output').innerText,
      python_capabilities: {
        supported: true,
        methods: [
          "createPythonFile(filename, code) - Create a new Python file",
          "runPythonFile(filename) - Run a Python file and get the results",
          "analyzePythonResult(code, output, error) - Analyze Python execution results"
        ],
        limitations: [
          "Code execution is limited to small programs",
          "Long-running code may time out",
          "Some standard libraries may not be available",
          "Network and file I/O operations are not supported"
        ]
      }
    };

    // Get content of all files
    for (const filename of files) {
      const fileData = fs.readFile(filename);
      context.files[filename] = typeof fileData === 'string' ? 
        { content: fileData } : fileData;
        
      // Flag Python files for easier identification
      if (filename.endsWith('.py')) {
        context.files[filename].is_python = true;
      }
    }
    
    // Add last Python result if available
    if (this.lastPythonResult) {
      context.last_python_result = this.lastPythonResult;
    }

    return context;
  }

  /**
   * Call Gemini API with retry logic
   */
  async callAPI(messages, context) {
    let retries = 0;
    
    // Prepare the prompt with context and conversation history
    const prompt = this.preparePrompt(messages, context);
    
    while (retries < this.maxRetries) {
      try {
        const url = `${this.endpoint}?key=${this.apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              topK: 32,
              topP: 0.9,
              maxOutputTokens: 2048,
            }
          })
        });

        if (!response.ok) {
          throw new Error(`API call failed with status: ${response.status}`);
        }

        const data = await response.json();
        return this.parseResponse(data);
      } catch (error) {
        console.error(`API call attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries === this.maxRetries) {
          throw new Error('Failed to get response from Gemini API after maximum retries');
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }
  }

  /**
   * Prepare the prompt with system context and message history
   */
  preparePrompt(messages, context) {
    // Format the context as a string for the prompt
    const contextStr = JSON.stringify(context, null, 2);
    
    // Format the conversation history
    const conversationHistory = messages.map(m => 
      `${m.role.toUpperCase()}: ${m.content}`
    ).join('\n\n');
    
    // Create the full prompt
    return `${this.systemPrompt}

CURRENT CONTEXT:
${contextStr}

AVAILABLE COMMANDS:
- createFile(filename, content)
- updateFile(filename, content)
- deleteFile(filename)
- deleteAllFiles(confirmed) - Delete all files (requires confirmed=true for safety)
- listFiles()
- message(content) - Display a message to the user

ADVANCED CAPABILITIES:
- Chain actions by setting "chainAction": true on any action
- Conditional execution based on Python output using "conditionalOutput" with:
  - "description": "Natural language description of the condition to check"
  - "trueActions": [] - Actions to take if condition is met
  - "falseActions": [] - Actions to take if condition is not met
  - "skipRemaining": true|false - Skip remaining actions in main sequence

ERROR HANDLING STRATEGIES:
- When encountering errors, update file contents to fix the issues
- For module import errors, use only these available modules:
  __future__, abc, array, bisect, calendar, cmath, collections, copy, datetime, decimal, 
  doctest, fractions, functools, hashlib, heapq, io, itertools, json, locale, math, 
  operator, pickle, pprint, random, re, string, types, typing, unittest
- For API limitations, adjust your code to work within constraints
- If a complex approach fails, try a simpler solution with standard libraries
- Implement retry logic with modified approaches (maximum 3 retries)

MULTI-STEP WORKFLOW EXAMPLES:
- Generate Python code to output a random number, then use AI to analyze whether it meets specific criteria
- Create a data processing script, run it, and use AI to determine which follow-up actions to take
- Generate test data, run a validation script, and let AI analyze the results to choose appropriate next steps

IMPORTANT: For multi-step workflows, always set "chainAction": true on each action except the last one to ensure they execute in sequence.

CONVERSATION HISTORY:
${conversationHistory}

Please respond with a valid JSON object containing your message and any actions to take. Remember that you can chain actions and use AI-powered analysis to conditionally execute code based on previous results. For example, after running a Python file, you can have the AI analyze its output to determine which actions to take next.`;
  }

  /**
   * Parse API response and extract actions
   */
  parseResponse(response) {
    try {
      const text = response.candidates[0].content.parts[0].text;
      
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[^]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Validate response format
          if (!parsed.message) {
            throw new Error('Response missing message field');
          }
          
          // Check if we have actions that need to use the lastPythonResult
          if (Array.isArray(parsed.actions)) {
            for (const action of parsed.actions) {
              if (action.type === 'analyzePythonResult') {
                // If we have a lastPythonResult, use its actual values
                if (this.lastPythonResult) {
                  // Only set these if they're not already explicitly set
                  if (!action.code) {
                    action.code = this.lastPythonResult.code;
                  }
                  // Always use actual values instead of placeholder text
                  if (!action.output || action.output === 'execution output') {
                    action.output = this.lastPythonResult.output;
                  }
                  if (!action.error || action.error === 'error message') {
                    action.error = this.lastPythonResult.error;
                  }
                }
              }
              
              // Handle conditionalOutput with appropriate values
              if (action.conditionalOutput) {
                // Ensure values are set for conditional tests
                this.prepareConditionalTests(action.conditionalOutput);
                
                // If there are nested conditionals in trueActions or falseActions
                if (Array.isArray(action.conditionalOutput.trueActions)) {
                  action.conditionalOutput.trueActions.forEach(a => {
                    if (a.conditionalOutput) {
                      this.prepareConditionalTests(a.conditionalOutput);
                    }
                  });
                }
                if (Array.isArray(action.conditionalOutput.falseActions)) {
                  action.conditionalOutput.falseActions.forEach(a => {
                    if (a.conditionalOutput) {
                      this.prepareConditionalTests(a.conditionalOutput);
                    }
                  });
                }
              }
            }
          }
          
          return {
            message: parsed.message,
            actions: Array.isArray(parsed.actions) ? parsed.actions : []
          };
        } catch (jsonError) {
          console.error('Error parsing JSON from response:', jsonError);
        }
      }
      
      // If no valid JSON was found or parsing failed, return the full text as the message
      return {
        message: text,
        actions: []
      };
    } catch (error) {
      console.error('Error parsing API response:', error);
      // If we can't parse at all, return a generic message
      return {
        message: "I encountered an error processing your request. Please try again.",
        actions: []
      };
    }
  }
  
  /**
   * Prepare conditional tests by ensuring values are appropriate
   * This removes any hardcoded example file references
   */
  prepareConditionalTests(conditionalOutput) {
    if (!conditionalOutput) return;
    
    // Make sure we have a description for the condition
    if (!conditionalOutput.description) {
      conditionalOutput.description = "the condition is met";
    }
    
    // Remove any hardcoded file references that might be in the actions
    if (Array.isArray(conditionalOutput.trueActions)) {
      this.sanitizeActions(conditionalOutput.trueActions);
    }
    
    if (Array.isArray(conditionalOutput.falseActions)) {
      this.sanitizeActions(conditionalOutput.falseActions);
    }
  }
  
  /**
   * Sanitize actions to remove any hardcoded example file references
   */
  sanitizeActions(actions) {
    if (!Array.isArray(actions)) return;
    
    // We no longer need to identify specific example files
    // Just ensure all actions have the required fields
    
    for (const action of actions) {
      // Recursively handle nested conditionalOutput actions
      if (action.conditionalOutput) {
        this.prepareConditionalTests(action.conditionalOutput);
      }
    }
  }

  /**
   * Execute file system actions from AI response
   */
  async executeActions(actions) {
    const results = [];
    // Add a context object to maintain state across action execution
    const context = {
      lastOutput: '',
      lastError: '',
      lastCode: ''
    };
    
    // Process actions one by one, allowing for conditional flow and chaining
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      let skipNext = false;
      let skipToAction = null;
      
      try {
        let actionResult;
        let executionOutput = '';
        let executionError = '';
        
        // Use context from previous actions if applicable and not explicitly set
        if (context.lastOutput && !action.output) {
          action.output = context.lastOutput;
        }
        if (context.lastError && !action.error) {
          action.error = context.lastError;
        }
        if (context.lastCode && !action.code) {
          action.code = context.lastCode;
        }
        
        switch (action.type) {
          case 'createFile':
            if (!action.filename || !action.content) {
              throw new Error('Missing filename or content for create action');
            }
            fs.writeFile(action.filename, action.content);
            actionResult = `Created file: ${action.filename}`;
            results.push(actionResult);
            break;
            
          case 'updateFile':
            if (!action.filename || typeof action.content !== 'string') {
              throw new Error('Missing filename or content for update action');
            }
            if (!fs.fileExists(action.filename)) {
              throw new Error(`File does not exist: ${action.filename}`);
            }
            fs.writeFile(action.filename, action.content);
            actionResult = `Updated file: ${action.filename}`;
            results.push(actionResult);
            break;
            
          case 'deleteFile':
            if (!action.filename) {
              throw new Error('Missing filename for delete action');
            }
            fs.deleteFile(action.filename);
            actionResult = `Deleted file: ${action.filename}`;
            results.push(actionResult);
            break;
            
          case 'deleteAllFiles':
            // By default, require confirmation to avoid accidental deletion
            const confirmed = action.confirmed === true;
            const deletionResult = fs.deleteAllFiles(confirmed);
            
            if (deletionResult.success) {
              actionResult = `Deleted all files: ${deletionResult.count} files removed`;
              
              // If verbose is enabled, include file names
              if (action.verbose && deletionResult.files?.length > 0) {
                actionResult += `\nDeleted files: ${deletionResult.files.join(', ')}`;
              }
            } else {
              actionResult = `Failed to delete all files: ${deletionResult.message}`;
            }
            
            results.push(actionResult);
            break;
            
          case 'createPythonFile':
            if (!action.filename || !action.content) {
              throw new Error('Missing filename or content for Python file creation');
            }
            // Ensure filename has .py extension
            const pythonFilename = action.filename.endsWith('.py') ? 
              action.filename : `${action.filename}.py`;
            fs.writeFile(pythonFilename, action.content);
            actionResult = `Created Python file: ${pythonFilename}`;
            results.push(actionResult);
            break;
            
          case 'runPythonFile':
            if (!action.filename) {
              // If no filename provided, check if we have a recently created Python file
              const pythonFiles = fs.listFiles().filter(f => f.endsWith('.py'));
              if (pythonFiles.length > 0) {
                // Sort by creation/modification time to get the most recent
                const mostRecentFile = pythonFiles[pythonFiles.length - 1]; // Simplified for example
                action.filename = mostRecentFile;
                results.push(`No filename specified, using most recent Python file: ${action.filename}`);
              } else {
                throw new Error('Missing filename for Python execution and no Python files available');
              }
            }
            
            // Ensure filename has .py extension
            const runFilename = action.filename.endsWith('.py') ? 
              action.filename : `${action.filename}.py`;
              
            if (!fs.fileExists(runFilename)) {
              throw new Error(`Python file does not exist: ${runFilename}`);
            }
            
            results.push(`Running Python file: ${runFilename}`);
            
            // Get file content
            const fileData = fs.readFile(runFilename);
            const code = typeof fileData === 'string' ? fileData : fileData.content;
            
            // Execute the Python code
            const executionResult = await pythonService.executeCode(code);
            
            executionOutput = executionResult.output || '';
            executionError = executionResult.error || '';
            
            // Update context with these values
            context.lastOutput = executionOutput;
            context.lastError = executionError;
            context.lastCode = code;
            
            if (executionOutput) {
              actionResult = `Output: ${executionOutput}`;
              results.push(actionResult);
            }
            
            if (executionError) {
              actionResult = `Error: ${executionError}`;
              results.push(actionResult);
            }
            
            // Store the result for potential later analysis and conditional operations
            this.lastPythonResult = {
              code: code,
              output: executionOutput,
              error: executionError
            };
            
            // Log Python execution results if chat module is available
            this.logPythonExecution(runFilename, code, executionResult);
            
            break;
            
          case 'analyzePythonResult':
            if (!action.code) {
              // If no code provided, use the last executed code
              if (!this.lastPythonResult) {
                throw new Error('No Python code to analyze. Please run a Python file first.');
              }
              action.code = this.lastPythonResult.code;
              action.output = this.lastPythonResult.output;
              action.error = this.lastPythonResult.error;
            }
            
            results.push('Analyze this Python code and its output:...');
            
            // Get the output and error values for analysis
            executionOutput = action.output || this.lastPythonResult?.output || '';
            executionError = action.error || this.lastPythonResult?.error || '';
            
            // Update context with these values
            context.lastOutput = executionOutput;
            context.lastError = executionError;
            context.lastCode = action.code;
            
            // Use LLM to analyze the code and determine next steps
            const analysisPrompt = `Analyze this Python code and its output:
            
Code:
\`\`\`python
${action.code}
\`\`\`

Output:
\`\`\`
${executionOutput}
\`\`\`

${executionError ? `Error:\n\`\`\`\n${executionError}\n\`\`\`\n\n` : ''}

${action.analysisInstructions || 'Provide a brief analysis and determine what action to take next based on this output.'}
${action.conditionalOutput ? `Check if the output ${action.conditionalOutput.description || 'meets the condition'}.` : ''}`;

            try {
              // Make an internal call to the LLM for analysis without showing in the chat UI
              const analysisResponse = await this.callInternalAPI([{ role: 'user', content: analysisPrompt }]);
              
              // Extract the analysis from the response
              const analysis = analysisResponse.message;
              
              // Log a shortened version of the analysis in the results
              actionResult = `Analysis: ${analysis.length > 100 ? analysis.substring(0, 100) + '...' : analysis}`;
              results.push(actionResult);
              
              // Log the full analysis results if chat module is available
              this.logPythonAnalysis(action.code, analysis);
              
              // If there's conditional logic, let the LLM determine which path to take
              if (action.conditionalOutput) {
                // Ask the LLM directly if the condition is met, using the actual output
                const conditionPrompt = `Based on this Python output: "${executionOutput}", 
is the following condition met: "${action.conditionalOutput.description || ''}"?
Answer with just "true" or "false".`;
                
                const conditionResponse = await this.callInternalAPI([{ role: 'user', content: conditionPrompt }]);
                const conditionResult = conditionResponse.message.toLowerCase().includes('true');
                
                results.push(`Condition "${action.conditionalOutput.description || 'condition check'}" ${conditionResult ? 'met' : 'not met'}`);
                
                // Execute appropriate conditional actions based on LLM's determination
                if (conditionResult && Array.isArray(action.conditionalOutput.trueActions) && action.conditionalOutput.trueActions.length > 0) {
                  results.push('Executing conditional true actions...');
                  this.prepareActionFilenames(action.conditionalOutput.trueActions);
                  const conditionalResults = await this.executeActions(action.conditionalOutput.trueActions);
                  results.push(...conditionalResults);
                  if (action.conditionalOutput.skipRemaining) {
                    skipNext = true;
                  }
                } else if (!conditionResult && Array.isArray(action.conditionalOutput.falseActions) && action.conditionalOutput.falseActions.length > 0) {
                  results.push('Executing conditional false actions...');
                  this.prepareActionFilenames(action.conditionalOutput.falseActions);
                  const conditionalResults = await this.executeActions(action.conditionalOutput.falseActions);
                  results.push(...conditionalResults);
                  if (action.conditionalOutput.skipRemaining) {
                    skipNext = true;
                  }
                }
              }
              
              // Check if there was an error and see if retry instructions were provided
              if (executionError && action.retryStrategy) {
                const errorAnalysisPrompt = `Analyze this Python error and help fix it:
\`\`\`
${executionError}
\`\`\`

Original code:
\`\`\`python
${action.code}
\`\`\`

Strategy for fixing: ${action.retryStrategy}

Please provide a corrected version of the code that addresses the error.`;

                const errorAnalysisResponse = await this.callInternalAPI([{ role: 'user', content: errorAnalysisPrompt }]);
                
                // Extract corrected code from the response
                let correctedCode = '';
                const codeMatch = errorAnalysisResponse.message.match(/```python\s+([\s\S]*?)```/);
                if (codeMatch && codeMatch[1]) {
                  correctedCode = codeMatch[1].trim();
                } else {
                  // If no code block found, try to extract the entire message
                  correctedCode = errorAnalysisResponse.message.trim();
                }
                
                if (correctedCode) {
                  results.push('Error detected. Automatically fixing and retrying...');
                  
                  // Get the filename to update
                  const fileToUpdate = action.filename || (typeof action.code === 'string' && action.code.includes('.py') ? action.code : null);
                  
                  if (fileToUpdate) {
                    // Update the file with corrected code
                    try {
                      fs.writeFile(fileToUpdate, correctedCode);
                      results.push(`Updated ${fileToUpdate} with fixed code`);
                      
                      // Queue up a retry if requested
                      if (action.shouldRetry) {
                        if (!context.retryCount) context.retryCount = 0;
                        
                        if (context.retryCount < (action.maxRetries || 3)) {
                          context.retryCount++;
                          results.push(`Retry attempt ${context.retryCount}...`);
                          
                          // Add a runPythonFile action to the actions array to be executed next
                          actions.splice(i + 1, 0, {
                            type: 'runPythonFile',
                            filename: fileToUpdate,
                            chainAction: true
                          });
                        } else {
                          results.push('Maximum retry attempts reached. Please check the code manually.');
                        }
                      }
                    } catch (updateError) {
                      results.push(`Error updating file: ${updateError.message}`);
                    }
                  } else {
                    results.push('Could not determine which file to update for retry.');
                  }
                }
              }
            } catch (analysisError) {
              results.push(`Error during analysis: ${analysisError.message}`);
            }
            
            break;
            
          case 'message':
            if (!action.content) {
              throw new Error('Missing content for message action');
            }
            actionResult = action.content;
            results.push(actionResult);
            break;
            
          default:
            actionResult = `Unknown action type: ${action.type}`;
            results.push(actionResult);
        }
        
        // Process chainAction - if not set or false, don't chain with next action
        if (!action.chainAction && i < actions.length - 1) {
          results.push('Action complete. Ready for next user input.');
          break;  // Exit the loop if we shouldn't chain to the next action
        }
        
      } catch (error) {
        results.push(`Error executing action ${action.type}: ${error.message}`);
        // Stop execution chain on error unless explicitly configured to continue
        if (!action.continueOnError) {
          break;
        }
      }
      
      // Skip to specific action if requested
      if (skipToAction) {
        const targetIndex = actions.findIndex(a => a.id === skipToAction);
        if (targetIndex > -1) {
          i = targetIndex - 1; // Will be incremented in the next loop iteration
        }
      }
      
      // Skip next action if requested
      if (skipNext) {
        i++; // Skip the next action
      }
    }
    
    // Update file list if any actions were executed
    if (results.length > 0) {
      updateFileList();
    }
    
    return results;
  }

  /**
   * Log Python execution results to the conversation log
   */
  logPythonExecution(filename, code, result) {
    // Check if we have an active chat instance with logging
    if (window.chat && chat.logFileName) {
      try {
        const logFile = fs.readFile(chat.logFileName);
        
        const executionLog = `## Python Execution (${filename})\n\n` +
          `**Code:**\n\`\`\`python\n${code}\n\`\`\`\n\n` +
          (result.output ? `**Output:**\n\`\`\`\n${result.output}\n\`\`\`\n\n` : '') +
          (result.error ? `**Error:**\n\`\`\`\n${result.error}\n\`\`\`\n\n` : '') +
          `---\n\n`;
        
        fs.writeFile(chat.logFileName, logFile.content + executionLog);
        console.log(`Logged Python execution for ${filename}`);
      } catch (error) {
        console.error('Error logging Python execution:', error);
      }
    }
  }

  /**
   * Log Python analysis results to the conversation log
   */
  logPythonAnalysis(code, analysis) {
    // Check if we have an active chat instance with logging
    if (window.chat && chat.logFileName) {
      try {
        const logFile = fs.readFile(chat.logFileName);
        
        const analysisLog = `## Python Analysis\n\n` +
          `**Code Analyzed:**\n\`\`\`python\n${code.length > 100 ? code.substring(0, 100) + '...' : code}\n\`\`\`\n\n` +
          `**Analysis:**\n${analysis}\n\n` +
          `---\n\n`;
        
        fs.writeFile(chat.logFileName, logFile.content + analysisLog);
        console.log('Logged Python analysis');
      } catch (error) {
        console.error('Error logging Python analysis:', error);
      }
    }
  }

  /**
   * Prepare action filenames by setting appropriate values
   * if they are missing
   */
  prepareActionFilenames(actions) {
    if (!Array.isArray(actions)) return;
    
    // Get list of Python files for potential use
    const pythonFiles = fs.listFiles().filter(f => f.endsWith('.py'));
    
    for (const action of actions) {
      if (action.type === 'runPythonFile' && !action.filename) {
        // For runPythonFile actions without a filename, try to use something appropriate
        if (pythonFiles.length > 0) {
          // Default to most recent file
          action.filename = pythonFiles[pythonFiles.length - 1];
        }
      }
      
      // Recursively handle nested conditionalOutput actions
      if (action.conditionalOutput) {
        if (Array.isArray(action.conditionalOutput.trueActions)) {
          this.prepareActionFilenames(action.conditionalOutput.trueActions);
        }
        if (Array.isArray(action.conditionalOutput.falseActions)) {
          this.prepareActionFilenames(action.conditionalOutput.falseActions);
        }
      }
    }
  }

  /**
   * Call Gemini API internally for analysis without affecting the main conversation
   * This is used for AI-based analysis that doesn't need to be shown to the user directly
   */
  async callInternalAPI(messages) {
    let retries = 0;
    
    // Create a minimal context to save tokens
    const minimalContext = {
      python_capabilities: {
        supported: true
      }
    };
    
    // Create a focused prompt for internal analysis
    const internalPrompt = `You are an AI coding assistant focused on analyzing Python code and its outputs.
Be concise and direct in your responses. Focus specifically on answering the question or analyzing the code provided.

${messages[messages.length - 1].content}`;
    
    while (retries < this.maxRetries) {
      try {
        const url = `${this.endpoint}?key=${this.apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: internalPrompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              topK: 32,
              topP: 0.9,
              maxOutputTokens: 1024,
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Internal API call failed with status: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        
        return {
          message: text
        };
      } catch (error) {
        console.error(`Internal API call attempt ${retries + 1} failed:`, error);
        retries++;
        
        if (retries === this.maxRetries) {
          throw new Error('Failed to get internal analysis from Gemini API');
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }
  }
}

// Create global Gemini client instance
const gemini = new GeminiClient(); 
