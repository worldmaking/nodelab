const path = require("path")
const fs = require('fs');
const http = require('http');
const ws = require('ws');
const express = require("express");
const assert = require("assert");

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app)
const wss = new ws.Server({ server: server });

let clients = {}
let socket2client = {}
function nextID() {
	let id = 0;
	while (clients[id]) id++;
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
	let client = { 
		id: id,  
		pose: {
			position: [0, 0, 0],
			quaternion: [0, 0, 0, 1],
			height: 1.2,

		}
	}
	clients[id] = client
	socket2client[socket] = client
	socket.send(JSON.stringify({ cmd:"handshake", id:id }))

	broadcast(`client ${id} joined`);
	console.log(`client ${id} joined`);

	socket.on('close', () => {
		delete socket2client[socket]
		delete clients[client.id]
		broadcast(`client ${id} left`);
		console.log(`client ${id} left`)

	});
	socket.on('message', (msg) => {
		if(msg instanceof ArrayBuffer) { 
			///... 
		} else if (msg[0]=="{") {
			let json = JSON.parse(msg);
			switch(json.cmd) {
				case "handshake": 
					if(json.id != id) { 
						console.error("bad handshake");
						socket.close()
					}
					return;
					break;
				case "pose":
					clients[json.id].pose = json.pose
					return;
					break;
			}
		} 
		
		console.log(`client ${id} said ${msg}`);
		broadcast(`client ${id} said ${msg}`);
	})
});

setInterval(function updateClients() {
	broadcast(JSON.stringify({cmd:"clients", clients:clients }))
}, 30/1000);

server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));

console.log("ok")