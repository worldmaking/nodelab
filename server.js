/*

A simple server to manage user connections within different "rooms"

Server: I open a websocket server
Client: I connect to your websocket
Server: wss.on('connection') -- I create a UUID and client struct for you, set up my handlers, and tell you "handshake <id>"
Client: I receive your "handshake", and copy that to my local session ID
I reply with "handshake <id>" to confirm
I will now start listening for other messages
Server: I receive your "handshake" and I will now start listening for other messages



Should:
- ensure clients all have unique IDs (UUID)
	- new client connection generates new UUID on server & server informs client
	- wait for an ack back?
	- could be nice to resume old UUID if the break wasn't too long?
- ensure a client is in only one room at once
- notice when a client has disconnected, & remove it
	- this includes when client has not posted a request for a while?
- remove a room when nobody is in it
- receive pose updates from clients
- reply to these with the poses of other clients in the same room
- when a client enters or exits a room, update other clients in the same room
- when a client changes some self-state (e.g. colour), update other clients in the same room
- basically, forward all client changes to other clients in the same room

A relatively lazy way to do this would be to simply send a list of client states to all members of a room, but that would be wasteful of bandwidth when client states get more complex. 
Next laziest is to simply forward all client changes to other clients in the same room, adding the corresponding UUID. Change could be represented as a jsonpatch, but that would be wasteful for poses. Probably better to have a few commands.
To server:
- "enter <roomname>" (implicit exit)
- "pose <headpos array> <quat array>"
- "patch <jsonpatch>" for everything else
To clients:
- "enter <uuid>"
- "exit <uuid>"
- "pose <uuid> <headpos array> <quat array>"
- "patch <uuid> <jsonpatch>"


JSONPATCH:
- http://jsonpatchjs.com/ node and browser, does not mutate, 
- https://github.com/Starcounter-Jack/JSON-Patch can mutate or not, observers, diffs. ACTIVE. benchmarks show this to be fastest
- https://github.com/sonnyp/JSON8/tree/main/packages/patch mutates, can generate diffs, inversions, can compress patches. ACTIVE. spec shows this to be the most complete. 
*/

const path = require("path")
const fs = require('fs');
const url = require('url');
const http = require('http');
const assert = require("assert");

const ws = require('ws');
const express = require("express");
const { v4: uuidv4 } = require("uuid")
const jsonpatch = require("json8-patch");
const { exit } = require("process");

const PORT = process.env.PORT || 3000;
const app = express();
// allow cross-domain access:
app.use(function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	return next();
});
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app)
const wss = new ws.Server({ server: server });


// a set of uniquely-named rooms
// each room would have a list of its occupants
// a client can only be in one room at a time
const rooms = {
	
}

// a set of clients, indexed by their uuid
const clients = {

}

// get (or create) a room:
function getRoom(name="default") {
	if (!rooms[name]) {
		rooms[name] = {
			name: name,
			clients: {},
		}

	}
	return rooms[name]
}

function sendRoom(roomname, msg, client) {
	let room = rooms[roomname]
	if (!room) return;

	let mates = Object.values(room.clients)
	for (let mate of mates) {
		//console.log(mate.shared.id, msg)
		//console.log(roomname, msg)
		//if (client && mate.socket != client.socket) {
			//console.log(mate.shared.id, mate.socket == client.socket)
			mate.socket.send(msg)
		//} 
	}
}

function exitRoom(id) {
	let client = clients[id]
	if (!client) return;
	const roomname = client.room
	let room = rooms[roomname]
	if (!room) return;

	// remove id from room.clients
	delete room.clients[id]
	client.room = ""
	// notify roommates
	sendRoom(roomname, `exit ${id}`)
}

function enterRoom(id, roomname) {
	let client = clients[id]
	if (!client) return;
	let room = getRoom(roomname);
	// ensure we can only be in one room at a time:
	if (client.room) exitRoom(id)
	client.room = roomname;
	// and update room:
	room.clients[id] = client;

	// full roll call
	sendRoom(roomname, "mates "+JSON.stringify(Object.values(room.clients).map(o => o.shared)))
}

// generate a unique id if needed
// verify id is unused (or generate a new one instead)
// returns 128-bit UUID as a string:
function newID(id="") {
	while (!id || clients[id]) id = uuidv4()
	return id
}

wss.on('connection', (socket, req) => {
	let room = url.parse(req.url).pathname.replace(/\/*$/, "").replace(/^\/*/, "").replace(/\/+/, "/")
	console.log('client connecting to', room);

	const query = url.parse(req.url, true).query;
	//console.log("query: ", query);

	const id = newID()
	const client = {
		socket: socket,
		room: "",
		shared: {
			id: id,				// server-defined unique id
			pos: [0, 0, 0], 		// head position
			quat: [0, 0, 0, 1], 	// head orientation
			user: {} 				// user-defined state
		}
	}
	clients[id] = client

	function onhandshake(msg) {
		const s = msg.indexOf(" ")
		const cmd = msg.substr(0, s), rest = msg.substr(s+1)
		if (cmd != "handshake") {
			// ignored
			console.log("ignoring", msg)
		} else if (rest != id) {
			console.error("bad handshake");
			socket.close()
		} else {
			// success, now we can add the client to a room and handle messages:
			console.log("handshake success")
			socket.removeListener('message', onhandshake)
			socket.on('message', onmessage);

			if (room) enterRoom(id, room)
		}
	}

	function onmessage(msg) {
		const s = msg.indexOf(" ")
		if (s > 0) {
			const cmd = msg.substr(0, s), rest = msg.substr(s+1)
			switch(cmd) {
				case "pose": 
					let vals = rest.split(" ").map(Number)
					client.shared.pos = vals.slice(0,3)
					client.shared.quat = vals.slice(3, 7)

					//console.log(Object.values(clients).map(o => o.shared.pos))
					// forward pose change to all members of this room
					let fwd = `pose ${id} ${rest}`
					sendRoom(client.room, fwd, client)
					//socket.send(fwd)
					break;
				default:
					console.log("default", msg);
			}
		} else {
			console.log(msg)
		}
	}
	
	socket.on('message', onhandshake);
	// reply with handshake:
	socket.send("handshake " + id)

	// let id = nextID();
	// let client = { 
	// 	id: id,  
	// 	pose: {
	// 		position: [0, 0, 0],
	// 		quaternion: [0, 0, 0, 1],
	// 		height: 1.2,

	// 	}
	// }
	// clients[id] = client
	// socket2client[socket] = client
	// socket.send(JSON.stringify({ cmd:"handshake", id:id }))

	// broadcast(`client ${id} joined`);
	// console.log(`client ${id} joined`);

	socket.on('error', (err) => {
		console.log(err)
	});

	socket.on('close', () => {
		//delete socket2client[socket]
		// remove from room
		if (client.room) {
			exitRoom(id)
		}
		// TODO notify members of that room
		//broadcast(`client ${id} left`);
		delete clients[client.id]
		console.log(`client ${id} left`)

	});
	// socket.on('message', (msg) => {
	// 	if(msg instanceof ArrayBuffer) { 
	// 		///... 
	// 	} else if (msg[0]=="{") {
	// 		let json = JSON.parse(msg);
	// 		switch(json.cmd) {
	// 			case "handshake": 
	// 				if(json.id != id) { 
	// 					console.error("bad handshake");
	// 					socket.close()
	// 				}
	// 				return;
	// 				break;
	// 			case "pose":
	// 				clients[json.id].pose = json.pose
	// 				return;
	// 				break;
	// 		}
	// 	} 
		
	// 	console.log(`client ${id} said ${msg}`);
	// 	broadcast(`client ${id} said ${msg}`);
	// })
});


server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));

function cleanup(e) {
	console.log("cleanup", e)
}

[`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`].forEach((e) => process.on(e, e => {
	cleanup(e)
}))