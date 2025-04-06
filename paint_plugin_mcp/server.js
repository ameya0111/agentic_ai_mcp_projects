const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// Command handlers
const commandHandlers = {
    drawLine: (data) => {
        console.log('Handling drawLine command:', data);
        return {
            type: 'drawLine',
            startX: data.startX,
            startY: data.startY,
            endX: data.endX,
            endY: data.endY,
            color: data.color || '#000000',
            width: data.width || 2
        };
    },
    drawRectangle: (data) => {
        console.log('Handling drawRectangle command:', data);
        return {
            type: 'drawRectangle',
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            color: data.color || '#000000',
            strokeWidth: data.strokeWidth || 2
        };
    },
    addText: (data) => {
        console.log('Handling addText command:', data);
        return {
            type: 'addText',
            x: data.x,
            y: data.y,
            text: data.text,
            fontSize: data.fontSize || '16px',
            fontFamily: data.fontFamily || 'Arial',
            color: data.color || '#000000'
        };
    }
};

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New client connected');
    clients.add(ws);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received WebSocket message:', data);
            const handler = commandHandlers[data.command];
            
            if (handler) {
                const result = handler(data);
                console.log('Broadcasting to clients:', result);
                // Broadcast the command to all connected clients
                clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(result));
                    }
                });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// REST API endpoints for drawing commands
app.post('/api/draw', (req, res) => {
    console.log('Received REST API request:', req.body);
    const { command, ...data } = req.body;
    const handler = commandHandlers[command];

    if (handler) {
        const result = handler(data);
        console.log('Broadcasting to WebSocket clients:', result);
        // Broadcast to all WebSocket clients
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(result));
            }
        });
        res.json({ success: true, result });
    } else {
        console.error('Invalid command received:', command);
        res.status(400).json({ error: 'Invalid command' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Waiting for connections...');
}); 
