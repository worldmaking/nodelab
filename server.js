const path = require("path")
const fs = require('fs');
const http = require('http');
const https = require('https');
const { Server } = require('ws');
const express = require("express")

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const httpServer = http.createServer(app)

const wss = new Server({ server: httpServer });

wss.on('connection', (socket) => {
	console.log('Client connected');
	socket.send("hi there");
	socket.on('close', () => console.log('Client disconnected'));
});

httpServer.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));

console.log("ok")