/**
 * Chat interface for AI interactions
 */
class Chat {
  constructor(messagesContainer, inputElement, sendButton) {
    this.messagesContainer = messagesContainer;
    this.inputElement = inputElement;
    this.sendButton = sendButton;
    this.messages = [];
    this.logFileName = null; // Will be set when first message is sent
    
    this.setupEventListeners();
    this.showWelcomeMessage();
  }
  
  setupEventListeners() {
    this.sendButton.addEventListener('click', () => this.sendMessage());
    
    this.inputElement.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    });
  }

  showWelcomeMessage() {
    const welcomeMessage = `Hello! I'm your AI assistant in LightAgentIDE. I can help you with:
- Answering questions about your code and files
- Creating or modifying files
- Running and analyzing Python code
- Suggesting code improvements
- Explaining concepts and syntax

Just type your question or request, and I'll assist you while maintaining a clean, distraction-free workflow.`;
    
    this.addMessage('assistant', welcomeMessage);
  }
  
  async sendMessage() {
    const message = this.inputElement.value.trim();
    if (!message) return;
    
    // Create log file if this is the first message
    if (!this.logFileName) {
      this.initLogFile();
    }
    
    // Disable input while processing
    this.inputElement.value = '';
    this.inputElement.disabled = true;
    this.sendButton.disabled = true;
    
    try {
      // Add user message to chat
      this.addMessage('user', message);
      
      // Log user message
      this.logMessage('user', message);
      
      // Show typing indicator
      const typingIndicator = this.addTypingIndicator();
      
      // Generate context with current file system state
      const context = await gemini.generateContext();
      
      // Call Gemini API
      const response = await gemini.callAPI(this.messages, context);
      
      // Remove typing indicator
      typingIndicator.remove();
      
      // Execute any actions from the response
      const actionResults = await gemini.executeActions(response.actions);
      
      // Add AI response to chat
      let fullResponse = response.message;
      
      // Only add action results if there were actions
      if (actionResults.length > 0) {
        fullResponse += '\n\n**Actions taken:**\n' + actionResults.map(r => `- ${r}`).join('\n');
      }
      
      this.addMessage('assistant', fullResponse);
      
      // Log assistant response
      this.logMessage('assistant', fullResponse);
      
      // Log raw response with actions
      this.logRawResponse(response, actionResults);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = `I encountered an error: ${error.message}\n\nPlease try again or rephrase your request.`;
      this.addMessage('assistant', errorMessage);
      
      // Log error
      this.logMessage('assistant', errorMessage);
      this.logMessage('system', `Error: ${error.message}`);
    } finally {
      // Re-enable input
      this.inputElement.disabled = false;
      this.sendButton.disabled = false;
      this.inputElement.focus();
    }
  }
  
  addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'chat-message assistant typing';
    indicator.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    this.messagesContainer.appendChild(indicator);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    return indicator;
  }
  
  addMessage(role, content) {
    // Add to messages array (excluding typing indicators)
    if (role !== 'typing') {
      this.messages.push({ role, content });
    }
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    // Format code blocks if present
    const formattedContent = this.formatMessage(content);
    messageDiv.innerHTML = formattedContent;
    
    // Add to container and scroll to bottom
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    
    return messageDiv;
  }
  
  formatMessage(content) {
    // First escape HTML to prevent XSS
    content = this.escapeHtml(content);
    
    // Replace markdown-style formatting
    return content
      // Code blocks with syntax highlighting
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
      })
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Lists
      .replace(/^- (.+)$/gm, '• $1')
      // Line breaks
      .replace(/\n/g, '<br>');
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Create log file with timestamp as name
  initLogFile() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    this.logFileName = `gemini_log_${timestamp}.md`;
    
    // Create log file with header
    const header = `# Gemini Conversation Log\nStarted: ${now.toLocaleString()}\n\n`;
    fs.writeFile(this.logFileName, header);
    console.log(`Created log file: ${this.logFileName}`);
  }
  
  // Log a message to the log file
  logMessage(role, content) {
    if (!this.logFileName) return;
    
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    const timestamp = new Date().toLocaleTimeString();
    const entry = `## ${roleLabel} (${timestamp})\n\n${content}\n\n---\n\n`;
    
    try {
      // Get current log content
      const logFile = fs.readFile(this.logFileName);
      // Append new entry
      fs.writeFile(this.logFileName, logFile.content + entry);
    } catch (error) {
      console.error('Error logging message:', error);
    }
  }
  
  // Log raw API response for debugging
  logRawResponse(response, actionResults) {
    if (!this.logFileName) return;
    
    try {
      const logFile = fs.readFile(this.logFileName);
      const rawInfo = `## System (Raw Response)\n\n` +
                     `\`\`\`json\n${JSON.stringify(response, null, 2)}\n\`\`\`\n\n` +
                     `Actions executed:\n\`\`\`\n${actionResults.join('\n')}\n\`\`\`\n\n---\n\n`;
      fs.writeFile(this.logFileName, logFile.content + rawInfo);
    } catch (error) {
      console.error('Error logging raw response:', error);
    }
  }
  
  clear() {
    this.messages = [];
    this.messagesContainer.innerHTML = '';
    this.showWelcomeMessage();
    
    // Reset log file for new session
    this.logFileName = null;
  }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create a global chat instance
  window.chat = new Chat(
    document.getElementById('chat-messages'),
    document.getElementById('chat-input'),
    document.getElementById('send-chat')
  );
}); 