/**
 * Simple in-memory file system with persistence to disk
 */

// Helper function for showing notifications
function showNotification(message, type = 'info') {
  if (typeof window.showNotification === 'function') {
    // Use the global function if available
    window.showNotification(message, type);
  } else {
    // Just log to console if no UI function available
    console.log(`[${type}] ${message}`);
  }
}

class FileSystem {
  constructor() {
    this.files = {};
    this.baseDir = 'files/'; // Directory to store files
    this.loadFromStorage();
  }

  // Save file system state to Chrome storage
  async saveToStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ files: this.files });
    } else {
      // Fallback to localStorage when chrome.storage is not available
      try {
        localStorage.setItem('terminal_editor_files', JSON.stringify(this.files));
      } catch (e) {
        console.warn('Failed to save to localStorage', e);
      }
    }
  }

  // Load file system state from Chrome storage
  async loadFromStorage() {
    // First try to load from Chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get('files');
      if (data.files) {
        this.files = data.files;
        return;
      }
    } else {
      // Fallback to localStorage when chrome.storage is not available
      try {
        const filesData = localStorage.getItem('terminal_editor_files');
        if (filesData) {
          this.files = JSON.parse(filesData);
          return;
        }
      } catch (e) {
        console.warn('Failed to load from localStorage', e);
      }
    }
  }

  // Export files as a ZIP archive
  async exportZip() {
    try {
      // Debug: log the files object to see what we're working with
      console.log('Files to export:', this.files);
      
      // Create a new JSZip instance
      const zip = new JSZip();
      
      // Check if we have any files to export
      const fileCount = Object.keys(this.files).length;
      if (fileCount === 0) {
        console.error('No files to export');
        showNotification('No files to export', 'error');
        return false;
      }
      
      // Add each file to the zip
      for (const filePath in this.files) {
        if (Object.prototype.hasOwnProperty.call(this.files, filePath)) {
          const fileData = this.files[filePath];
          // Handle different possible structures
          if (typeof fileData === 'string') {
            zip.file(filePath, fileData);
          } else if (fileData && typeof fileData.content === 'string') {
            zip.file(filePath, fileData.content);
          } else {
            console.warn(`Skipping file ${filePath} - invalid format`);
          }
        }
      }
      
      // Generate the zip file
      const content = await zip.generateAsync({type: "blob"});
      
      // Download the file
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "files.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error("Error exporting files:", error);
      return false;
    }
  }

  // Import files from a ZIP file
  async importZip(file) {
    try {
      const content = await file.arrayBuffer();
      // Use the global JSZip that's now included in the HTML
      const zip = await JSZip.loadAsync(content);
      
      const files = {};
      const promises = [];
      
      zip.forEach((path, zipEntry) => {
        if (!zipEntry.dir) {
          const promise = zipEntry.async("string").then(content => {
            files[path] = { content };
          });
          promises.push(promise);
        }
      });
      
      await Promise.all(promises);
      
      this.files = files;
      this.saveToStorage();
      return true;
    } catch (error) {
      console.error("Error importing ZIP:", error);
      return false;
    }
  }
  
  // Import files from a JSON file (for backward compatibility)
  async importJson(file) {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (event) => {
          try {
            const filesData = JSON.parse(event.target.result);
            this.files = filesData;
            await this.saveToStorage();
            resolve(true);
          } catch (error) {
            console.error('Failed to parse imported files:', error);
            reject(error);
          }
        };
        
        reader.onerror = (error) => {
          console.error('Failed to read file:', error);
          reject(error);
        };
        
        reader.readAsText(file);
      });
    } catch (error) {
      console.error('Failed to import files:', error);
      return false;
    }
  }

  // List all files
  listFiles() {
    return Object.keys(this.files);
  }

  // Create or update a file
  writeFile(filename, content) {
    if (!filename) {
      throw new Error('Filename is required');
    }
    
    // Store file with consistent structure
    this.files[filename] = {
      content: content,
      lastModified: new Date().toISOString()
    };
    
    this.saveToStorage();
    return true;
  }

  // Read a file
  readFile(filename) {
    if (!this.fileExists(filename)) {
      throw new Error(`File not found: ${filename}`);
    }
    
    const fileData = this.files[filename];
    // Handle different possible structures for backward compatibility
    if (typeof fileData === 'string') {
      return { content: fileData };
    } else if (fileData && typeof fileData.content === 'string') {
      return fileData;
    } else {
      console.error(`Invalid file format for ${filename}`);
      return { content: '' };
    }
  }

  // Delete a file
  deleteFile(filename) {
    if (!this.fileExists(filename)) {
      throw new Error(`File not found: ${filename}`);
    }
    
    delete this.files[filename];
    this.saveToStorage();
    return true;
  }

  // Check if a file exists
  fileExists(filename) {
    return Object.prototype.hasOwnProperty.call(this.files, filename);
  }
  
  /**
   * Delete all files in the file system
   * @param {boolean} confirmed - Whether the action is confirmed (to prevent accidental deletion)
   * @returns {object} - Result object with success status and count of deleted files
   */
  deleteAllFiles(confirmed = false) {
    if (!confirmed) {
      return { 
        success: false, 
        message: 'Deletion not confirmed. Set confirmed=true to proceed.',
        count: 0 
      };
    }
    
    const fileCount = Object.keys(this.files).length;
    if (fileCount === 0) {
      return { 
        success: true, 
        message: 'No files to delete.',
        count: 0 
      };
    }
    
    // Store file names for reporting
    const deletedFiles = Object.keys(this.files);
    
    // Clear all files
    this.files = {};
    this.saveToStorage();
    
    console.log(`Deleted all files (${fileCount} files)`);
    showNotification(`Deleted all files (${fileCount} files)`, 'warning');
    
    return { 
      success: true, 
      message: `Successfully deleted ${fileCount} files.`,
      count: fileCount,
      files: deletedFiles
    };
  }
  
  // Debug method: Clear all files (kept for backward compatibility)
  clearAllFiles() {
    return this.deleteAllFiles(true);
  }

  // Export selected files as a ZIP archive
  async exportSelectedFiles(filesToExport) {
    try {
      // Debug: log the files to export
      console.log('Selected files to export:', filesToExport);
      
      // Create a new JSZip instance
      const zip = new JSZip();
      
      // Check if we have any files to export
      if (!filesToExport || filesToExport.length === 0) {
        console.error('No files selected for export');
        showNotification('No files selected for export', 'error');
        return false;
      }
      
      // Add selected files to the zip
      let fileCount = 0;
      for (const filePath of filesToExport) {
        if (this.fileExists(filePath)) {
          const fileData = this.files[filePath];
          // Handle different possible structures
          if (typeof fileData === 'string') {
            zip.file(filePath, fileData);
            fileCount++;
          } else if (fileData && typeof fileData.content === 'string') {
            zip.file(filePath, fileData.content);
            fileCount++;
          } else {
            console.warn(`Skipping file ${filePath} - invalid format`);
          }
        } else {
          console.warn(`File not found: ${filePath}`);
        }
      }
      
      if (fileCount === 0) {
        console.error('No valid files to export');
        showNotification('No valid files to export', 'error');
        return false;
      }
      
      // Generate the zip file
      const content = await zip.generateAsync({type: "blob"});
      
      // Download the file
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "selected_files.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error("Error exporting selected files:", error);
      return false;
    }
  }
}

// Create global file system instance
const fs = new FileSystem(); 

// Add a debug function to window
window.clearAllFiles = function() {
  return fs.clearAllFiles();
}; 