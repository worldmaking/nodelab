const path = require("path")
const fs = require('fs');
const http = require('http');
const ws = require('ws');
const express = require("express")

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app)
const wss = new ws.Server({ server: server });

let ids = []
let socket2client = {}
function nextID() {
	let id = 0;
	while (ids[id]) id++;
	return id;
}

function broadcast(msg) {
	wss.clients.forEach(function (client) {
       if (client.readyState == ws.OPEN) {
          client.send( msg );
       }
    });
}

wss.on('connection', (socket) => {
	console.log('client connected');

	let id = nextID();
	let client = { id: id }
	ids[id] = client
	socket2client[socket] = client
	socket.send(JSON.stringify({ cmd:"handshake", id:id }))

	broadcast(`client ${id} joined`);
	console.log(`client ${id} joined`);

	socket.on('close', () => {
		delete socket2client[socket]
		delete ids[client.id]
		broadcast(`client ${id} left`);
		console.log(`client ${id} left`)

	});
	socket.on('message', (msg) => {
		console.log(`client ${id} said ${msg}`);
		broadcast(`client ${id} said ${msg}`);
	})
});


server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));

console.log("ok")