/**
 * Main application script
 */
document.addEventListener('DOMContentLoaded', function() {
  // Initialize components
  const terminal = new Terminal(
    document.getElementById('terminal-output'),
    document.getElementById('terminal-input')
  );
  
  const editor = new Editor(
    document.getElementById('file-name'),
    document.getElementById('file-content'),
    document.getElementById('save-file')
  );
  
  // Create a sample file if no files exist
  createSampleFileIfNeeded();
  
  // Update file list on start
  updateFileList();
  
  // Notify user about new agentic capabilities
  setTimeout(() => {
    showNotification("Enhanced agentic capabilities enabled! The AI can now execute conditional actions automatically.", "success");
  }, 1500);
  
  // Handle tab switching
  document.querySelectorAll('.tab-btn').forEach(function(button) {
    button.addEventListener('click', function() {
      // Get the tab to show
      const tabId = this.getAttribute('data-tab');
      
      // Hide all tabs and remove active class
      document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.classList.remove('active');
      });
      
      document.querySelectorAll('.tab-content').forEach(function(content) {
        content.classList.remove('active');
      });
      
      // Show the selected tab
      this.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      
      // Focus input if terminal tab
      if (tabId === 'terminal') {
        document.getElementById('terminal-input').focus();
      } else if (tabId === 'editor') {
        document.getElementById('file-content').focus();
      }
    });
  });
  
  // Setup file export/import functionality
  setupFileExportImport();
  
  // Focus terminal input by default
  document.getElementById('terminal-input').focus();
});

/**
 * Create a sample file if no files exist
 */
function createSampleFileIfNeeded() {
  const files = fs.listFiles();
  if (files.length === 0) {
    // Create a sample README file
    fs.writeFile('README.txt', 'Welcome to Terminal & Editor!\n\nThis is a sample file created to help you get started.');
    console.log('Created sample file: README.txt');
  }
}

/**
 * Setup file export and import functionality
 */
function setupFileExportImport() {
  // Export all files button
  const exportButton = document.getElementById('export-files');
  exportButton.addEventListener('click', async () => {
    if (await fs.exportZip()) {
      showNotification('All files exported as ZIP successfully', 'success');
    } else {
      showNotification('Error exporting files', 'error');
    }
  });
  
  // Export selected files button
  const exportSelectedButton = document.getElementById('export-selected-files');
  exportSelectedButton.addEventListener('click', async () => {
    const selectedFiles = getSelectedFiles();
    
    if (selectedFiles.length === 0) {
      showNotification('Please select files to export', 'warning');
      return;
    }
    
    if (await fs.exportSelectedFiles(selectedFiles)) {
      showNotification(`${selectedFiles.length} file(s) exported as ZIP successfully`, 'success');
    } else {
      showNotification('Error exporting selected files', 'error');
    }
  });
  
  // Select all files checkbox
  const selectAllCheckbox = document.getElementById('select-all-files');
  selectAllCheckbox.addEventListener('change', () => {
    const isChecked = selectAllCheckbox.checked;
    document.querySelectorAll('#file-list input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = isChecked;
    });
  });
  
  // Import files
  const importInput = document.getElementById('import-files');
  importInput.addEventListener('change', async (event) => {
    if (event.target.files.length > 0) {
      const file = event.target.files[0];
      let success = false;
      
      try {
        if (file.name.endsWith('.zip')) {
          success = await fs.importZip(file);
        } else if (file.name.endsWith('.json')) {
          // For backward compatibility
          success = await fs.importJson(file);
        } else {
          showNotification('Unsupported file format', 'error');
          return;
        }
        
        if (success) {
          showNotification('Files imported successfully', 'success');
          // Refresh the file list
          updateFileList();
        } else {
          showNotification('Error importing files', 'error');
        }
      } catch (error) {
        showNotification(`Import error: ${error.message}`, 'error');
      }
      
      // Reset the file input
      event.target.value = '';
    }
  });

  // Delete all files button
  const deleteAllButton = document.getElementById('delete-all-files');
  deleteAllButton.addEventListener('click', async () => {
    // Show a confirmation dialog before proceeding
    if (!confirm('Are you sure you want to delete ALL files? This action cannot be undone!')) {
      return; // User canceled
    }
    
    const result = fs.deleteAllFiles(true);
    
    if (result.success) {
      showNotification(`${result.count} file(s) deleted successfully`, 'warning');
      // Refresh the file list
      updateFileList();
      
      // Reset the editor if it's currently showing a file that was deleted
      const currentFile = document.getElementById('file-name').value;
      if (currentFile && !fs.fileExists(currentFile)) {
        document.getElementById('file-name').value = '';
        document.getElementById('file-content').value = '';
      }
    } else {
      showNotification(result.message, 'info');
    }
  });
}

/**
 * Get all currently selected files
 */
function getSelectedFiles() {
  const selectedFiles = [];
  document.querySelectorAll('#file-list input[type="checkbox"]:checked').forEach(checkbox => {
    selectedFiles.push(checkbox.dataset.filename);
  });
  return selectedFiles;
}

/**
 * Display a notification message
 */
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Remove after timeout
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}

/**
 * Update the file list in the UI
 */
function updateFileList() {
  const fileList = document.getElementById('file-list');
  fileList.innerHTML = '';
  
  const files = fs.listFiles();
  
  if (files.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = 'No files';
    fileList.appendChild(emptyItem);
    return;
  }
  
  files.forEach(function(filename) {
    const fileItem = document.createElement('li');
    
    // File selection checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.filename = filename;
    fileItem.appendChild(checkbox);
    
    // File name display that's clickable to open the file
    const fileNameSpan = document.createElement('span');
    fileNameSpan.textContent = filename;
    fileNameSpan.classList.add('file-name');
    fileNameSpan.addEventListener('click', function() {
      // Switch to editor tab and load file
      const editorTab = document.querySelector('[data-tab="editor"]');
      document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      editorTab.classList.add('active');
      document.getElementById('editor').classList.add('active');
      
      // Load the file
      const editor = new Editor(
        document.getElementById('file-name'),
        document.getElementById('file-content'),
        document.getElementById('save-file')
      );
      editor.loadFile(filename);
    });
    fileItem.appendChild(fileNameSpan);
    
    // File actions
    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('file-actions');
    
    // Edit button
    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', function() {
      // Switch to editor tab and load file
      const editorTab = document.querySelector('[data-tab="editor"]');
      document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      editorTab.classList.add('active');
      document.getElementById('editor').classList.add('active');
      
      // Load the file
      const editor = new Editor(
        document.getElementById('file-name'),
        document.getElementById('file-content'),
        document.getElementById('save-file')
      );
      editor.loadFile(filename);
    });
    actionsDiv.appendChild(editButton);
    
    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', function() {
      if (confirm(`Are you sure you want to delete "${filename}"?`)) {
        try {
          fs.deleteFile(filename);
          updateFileList();
        } catch (error) {
          alert(`Error deleting file: ${error.message}`);
        }
      }
    });
    actionsDiv.appendChild(deleteButton);
    
    fileItem.appendChild(actionsDiv);
    fileList.appendChild(fileItem);
  });
} 