const fs = require('fs');
const path = require("path")
const url = require('url');
const assert = require("assert");
const http = require("http");
const https = require("https");

const express = require("express");
const ws = require("ws");
const { v4: uuidv4 } = require("uuid")
const { Message, PoseData } = require('./public/networkMessages.js');
// const jsonpatch = require("json8-patch");
// const { exit } = require("process");
// const dotenv = require("dotenv").config();
const dotenv = require("dotenv").config();

// These constants are available by default in CommonJS Module syntax,
// but we need to polyfill them in when working in an ES Module.
/*
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
*/

// this will be true if this server is running on Heroku
const IS_HEROKU = (process.env._ && process.env._.indexOf("heroku") !== -1);
// this will be true if there's no .env file or the DEBUG environment variable was set to true:
const IS_DEBUG = (!process.env.PORT_HTTP) || (process.env.DEBUG === true);
// use HTTPS if we are NOT on Heroku, and NOT using DEBUG:
const IS_HTTPS = !IS_DEBUG && !IS_HEROKU;

const PUBLIC_PATH = path.join(__dirname, "public")
const PORT_HTTP = IS_HEROKU ? (process.env.PORT || 3000) : (process.env.PORT_HTTP || 8080);
const PORT_HTTPS = process.env.PORT_HTTPS || 443;
const PORT = IS_HTTPS ? PORT_HTTPS : PORT_HTTP;
//const PORT_WS = process.env.PORT_WS || 8090; // not used unless you want a second ws port

// allow cross-domain access (CORS)
const app = express();
app.use(function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	return next();
});

// promote http to https:
if (IS_HTTPS) {
	http.createServer(function(req, res) {
        res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
        res.end();
    }).listen(PORT_HTTP);
}

// create the primary server:
const server = IS_HTTPS ? https.createServer({
	key: fs.readFileSync(process.env.KEY_PATH),
	cert: fs.readFileSync(process.env.CERT_PATH)
}, app) : http.createServer(app);


// serve static files from PUBLIC_PATH:
app.use(express.static(PUBLIC_PATH)); 
// default to index.html if no file given:
app.get("/", function(req, res) {
    res.sendFile(path.join(PUBLIC_PATH, "index.html"))
});
// add a websocket server:
const wss = new ws.Server({ server });
// start the server:
server.listen(PORT, function() {
	console.log("\nNode.js listening on port " + PORT);
});

// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ 


// Audio Server 
//! factored this out into its own repo to resolve github issue #11. 
//require('child_process').fork('audioSignalingServer.js');

//if (location.hostname === "localhost" || location.hostname === "127.0.0.1"){
	// require('child_process').fork('audioSignalingServer.js');
// }

// else{
// 	//socket = io('https://agile-basin-71343.herokuapp.com/', { transports : ['websocket'] })
// }
















const demoproject = {
  threejs: {
	geometries: [{ uuid: "geom_cube", type: "BoxGeometry" }],
	materials: [{ uuid: "mat_cube", type: "MeshStandardMaterial" }],
	object: {
		type: "Scene",
		children: [
			{ type: "Mesh", geometry: "geom_cube", material: "mat_cube", castShadow: true, matrix: [
				0.8775825618903728,
				0.22984884706593015,
				-0.4207354924039482,
				0,
				0,
				0.8775825618903728,
				0.47942553860420295,
				0,
				0.47942553860420295,
				-0.4207354924039482,
				0.7701511529340699,
				0,
				0,
				1.5,
				0,
				1
			]}
		]
	}
  }
};

const clients = {}
// a set of uniquely-named rooms
// each room would have a list of its occupants
// a client can only be in one room at a time
const rooms = {
	
}

// get (or create) a room:
function getRoom(name="default") {
	if (!rooms[name]) {
		rooms[name] = {
			name: name,
			clients: {},
			project: demoproject
		}
	}
	return rooms[name]
}

/**
 * Send a message to all users in a room.
 * @param {Room} room
 * @param {Message} message 
 */
function notifyRoom(room, message) {	
	if (!room) return;
	const clientsInRoom = Object.values(room.clients);
	message.sendToAll(clientsInRoom);
}

// generate a unique id if needed
// verify id is unused (or generate a new one instead)
// returns 128-bit UUID as a string:
function newID(id="") {
	while (!id || clients[id]) id = uuidv4()
	return id
}


// Handle incoming connections as a new user joining a room.
wss.on('connection', (socket, req) => {
	// Read the path from the connection request and treat it as a room name, sanitizing and standardizing the format.
	// Actual room name might differ from this, if it's empty and we need to substitute a "default" instead.
	const requestedRoomName = url.parse(req.url).pathname.replace(/\/*$/, "").replace(/\/+/, "/")
	
	const id = newID()
	let client = {
		socket: socket,
		room: getRoom(requestedRoomName),
		shared: {
			// Structure for any rapidly-changing data (poses, etc.)
			volatile: {
				id: id,
				poses: [new PoseData()],
			},
			// Structure for rarely-changing user configuration (display name, colour, etc.)
			user: {}
		}
	}
	clients[id] = client
	// enter this room
	client.room.clients[id] = client;

	// Convenience function for getting everyone in the room *except* this client.
	function getOthersInRoom() {
		return Object.values(client.room.clients).filter(c => c.shared.volatile.id != id);
	}

	console.log(`client ${client.shared.volatile.id} connecting to room ${client.room.name}`);
	
	socket.on('message', (data) => {
		const msg = Message.fromData(data);
		
		switch(msg.cmd) {
			case "pose":
				// New pose update (and possibly other rapidly-changing data) from the client.
				client.shared.volatile = msg.val;
				// Insert our ID into this structure, so we can just batch-send all the volatile
				// info together and it already has our ID packed in.
				client.shared.volatile.id = id;			
				break;
			case "user": 
				// TODO: Send update to other users about changed info.
				client.shared.user = msg.val;

				// Tell everyone about the new/updated user.
				(new Message("user", {id: id, user: msg.val})).sendToAll(getOthersInRoom());
				break;
		}
	
	});

	socket.on('error', (err) => {
		console.log(err)
		// should we exit?
	});

	socket.on('close', () => {
		// console.log(Object.keys(clients))
		delete clients[id]

		// remove from room
		if (client.room) delete client.room.clients[id]


		// Tell everyone this user left.		
		notifyRoom(client.room, new Message("exit", id));

		console.log(`client ${id} left room ${client.room.name}`);		
	});

	// Welcome the new user and tell them their unique id.
	// TODO: Tell them their spawn position too.
	(new Message("handshake", {
		id: id, 
		others: getOthersInRoom().map(o=>o.shared)
	})).sendWith(socket);

	// Share the current 3D scene with the user.
	(new Message("project", client.room.project)).sendWith(socket);
});

setInterval(function() {
	for (let roomid of Object.keys(rooms)) {
		const room = rooms[roomid];
		const clientlist = Object.values(room.clients);
		const message = new Message("others", clientlist.map(o=>o.shared.volatile));
		message.sendToAll(clientlist);
	}
}, 1000/30);



