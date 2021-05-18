const path = require("path")
const fs = require('fs');
const https = require('https');
const { Server } = require('ws');
const express = require("express")

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// const wss = new Server({ app });

// wss.on('connection', (socket) => {
// 	console.log('Client connected');
// 	socket.send("hi there");
// 	socket.on('close', () => console.log('Client disconnected'));
// });



app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
console.log("ok")