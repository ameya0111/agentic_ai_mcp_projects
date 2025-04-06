// Canvas setup
const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
// Explicitly use localhost instead of window.location.hostname since we're in a Chrome extension
const ws = new WebSocket('ws://localhost:3000');

// Create a temporary canvas for preview and position it absolutely over the main canvas
const tempCanvas = document.createElement('canvas');
tempCanvas.style.position = 'absolute';
tempCanvas.style.left = '0';
tempCanvas.style.top = '0';
tempCanvas.style.width = '100%';
tempCanvas.style.height = '100%';
tempCanvas.style.pointerEvents = 'none';
const tempCtx = tempCanvas.getContext('2d');
canvas.parentNode.appendChild(tempCanvas);

// Function to update canvas size
function updateCanvasSize() {
    const container = canvas.parentNode;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    tempCanvas.width = rect.width;
    tempCanvas.height = rect.height;
}

// Initial size setup
updateCanvasSize();

// Add resize observer
const resizeObserver = new ResizeObserver(entries => {
    updateCanvasSize();
});
resizeObserver.observe(canvas.parentNode);

// UI elements
const lineBtn = document.getElementById('lineBtn');
const rectBtn = document.getElementById('rectBtn');
const textBtn = document.getElementById('textBtn');
const colorPicker = document.getElementById('colorPicker');
const lineWidth = document.getElementById('lineWidth');
const clearBtn = document.getElementById('clearBtn');
const textInput = document.getElementById('textInput');
const textField = document.getElementById('textField');
const addTextBtn = document.getElementById('addTextBtn');

// WebSocket status indicator
const statusDiv = document.createElement('div');
statusDiv.style.padding = '5px';
statusDiv.style.backgroundColor = '#f0f0f0';
statusDiv.style.marginBottom = '5px';
statusDiv.style.borderRadius = '3px';
document.querySelector('.container').insertBefore(statusDiv, document.querySelector('.toolbar'));

// Drawing state
let isDrawing = false;
let currentTool = 'line';
let startX = 0;
let startY = 0;

// Tool button handlers
lineBtn.addEventListener('click', () => setTool('line'));
rectBtn.addEventListener('click', () => setTool('rectangle'));
textBtn.addEventListener('click', () => setTool('text'));
clearBtn.addEventListener('click', clearCanvas);

function setTool(tool) {
    currentTool = tool;
    [lineBtn, rectBtn, textBtn].forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tool}Btn`).classList.add('active');
    textInput.style.display = tool === 'text' ? 'flex' : 'none';
}

// Canvas event listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// WebSocket connection handling
ws.onopen = () => {
    console.log('Connected to MCP server');
    statusDiv.textContent = 'Connected to server';
    statusDiv.style.backgroundColor = '#d4edda';
    statusDiv.style.color = '#155724';
};

ws.onclose = () => {
    console.log('Disconnected from MCP server');
    statusDiv.textContent = 'Disconnected from server';
    statusDiv.style.backgroundColor = '#f8d7da';
    statusDiv.style.color = '#721c24';
    // Try to reconnect
    setTimeout(() => {
        window.location.reload();
    }, 3000);
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    statusDiv.textContent = 'Connection error';
    statusDiv.style.backgroundColor = '#f8d7da';
    statusDiv.style.color = '#721c24';
};

ws.onmessage = (event) => {
    console.log('Received message from server:', event.data);
    try {
        const data = JSON.parse(event.data);
        console.log('Parsed data:', data);
        
        switch (data.type) {
            case 'drawLine':
                console.log('Drawing line:', data);
                ctx.strokeStyle = data.color;
                ctx.lineWidth = data.width;
                drawLine(data.startX, data.startY, data.endX, data.endY);
                break;
            case 'drawRectangle':
                console.log('Drawing rectangle:', data);
                ctx.strokeStyle = data.color;
                ctx.lineWidth = data.strokeWidth;
                drawRectangle(data.x, data.y, data.width, data.height);
                break;
            case 'addText':
                console.log('Adding text:', data);
                ctx.font = `${data.fontSize}`;
                ctx.fillStyle = data.color;
                addText(data.x, data.y, data.text);
                break;
            default:
                console.log('Unknown command type:', data.type);
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
};

// Drawing functions
function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // Clear only the temporary canvas
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Set drawing styles for preview
    tempCtx.strokeStyle = colorPicker.value;
    tempCtx.lineWidth = lineWidth.value;

    // Draw only on temporary canvas
    if (currentTool === 'line') {
        tempCtx.beginPath();
        tempCtx.moveTo(startX, startY);
        tempCtx.lineTo(currentX, currentY);
        tempCtx.stroke();
    } else if (currentTool === 'rectangle') {
        tempCtx.beginPath();
        tempCtx.strokeRect(startX, startY, currentX - startX, currentY - startY);
    }
}

function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    // Clear the preview
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw final shape on main canvas
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = lineWidth.value;

    if (currentTool === 'line') {
        drawLine(startX, startY, endX, endY);
        sendDrawCommand('drawLine', {
            startX, startY, endX, endY,
            color: colorPicker.value,
            width: lineWidth.value
        });
    } else if (currentTool === 'rectangle') {
        drawRectangle(startX, startY, endX - startX, endY - startY);
        sendDrawCommand('drawRectangle', {
            x: startX,
            y: startY,
            width: endX - startX,
            height: endY - startY,
            color: colorPicker.value,
            strokeWidth: lineWidth.value
        });
    }
}

// Drawing command handlers
function drawLine(startX, startY, endX, endY) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
}

function drawRectangle(x, y, width, height) {
    ctx.beginPath();
    ctx.strokeRect(x, y, width, height);
}

function addText(x, y, text) {
    ctx.font = `${lineWidth.value * 8}px Arial`;
    ctx.fillStyle = colorPicker.value;
    ctx.fillText(text, x, y);
}

// Text input handler
addTextBtn.addEventListener('click', () => {
    const text = textField.value.trim();
    if (text) {
        addText(startX, startY, text);
        sendDrawCommand('addText', {
            x: startX,
            y: startY,
            text: text,
            color: colorPicker.value,
            fontSize: `${lineWidth.value * 8}px`
        });
        textField.value = '';
    }
});

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function sendDrawCommand(command, data) {
    if (ws.readyState === WebSocket.OPEN) {
        console.log('Sending command to server:', { command, ...data });
        ws.send(JSON.stringify({
            command,
            ...data
        }));
    } else {
        console.error('WebSocket is not connected. Current state:', ws.readyState);
    }
}

// Set initial tool
setTool('line');
