/**
 * Editor functionality
 */
class Editor {
  constructor(fileNameElement, contentElement, saveButton) {
    this.fileNameElement = fileNameElement;
    this.contentElement = contentElement;
    this.saveButton = saveButton;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.saveButton.addEventListener('click', this.saveFile.bind(this));
    
    // Add keyboard shortcut for save (Ctrl+S or Cmd+S)
    this.contentElement.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        this.saveFile();
      }
    });
  }
  
  saveFile() {
    const filename = this.fileNameElement.value.trim();
    const content = this.contentElement.value;
    
    if (!filename) {
      alert('Please enter a filename');
      return;
    }
    
    try {
      fs.writeFile(filename, content);
      updateFileList();
      
      // Show success message temporarily
      this.showMessage('File saved successfully');
    } catch (error) {
      alert(`Error saving file: ${error.message}`);
    }
  }
  
  showMessage(message) {
    const saveText = this.saveButton.textContent;
    this.saveButton.textContent = message;
    this.saveButton.disabled = true;
    
    setTimeout(() => {
      this.saveButton.textContent = saveText;
      this.saveButton.disabled = false;
    }, 1000);
  }
  
  loadFile(filename) {
    this.fileNameElement.value = filename;
    
    try {
      if (fs.fileExists(filename)) {
        const fileData = fs.readFile(filename);
        this.contentElement.value = fileData.content;
      } else {
        this.contentElement.value = '';
      }
    } catch (error) {
      alert(`Error loading file: ${error.message}`);
    }
  }
}

// Will be initialized in main.js 