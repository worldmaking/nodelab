
"use strict";

const fs = require('fs');
const path = require("path")
const url = require('url');
const assert = require("assert");
const http = require("http");
const https = require("https");

const express = require("express");
const ws = require("ws");
const { v4: uuidv4 } = require("uuid")
// const jsonpatch = require("json8-patch");
// const { exit } = require("process");
// const dotenv = require("dotenv").config();


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

function notifyRoom(roomname, msg) {
	let room = rooms[roomname]
	if (!room) return;
	let others = Object.values(room.clients)
	for (let mate of others) {
		mate.socket.send(msg)
	}
}

// generate a unique id if needed
// verify id is unused (or generate a new one instead)
// returns 128-bit UUID as a string:
function newID(id="") {
	while (!id || clients[id]) id = uuidv4()
	return id
}

wss.on('connection', (socket, req) => {
	let room = url.parse(req.url).pathname.replace(/\/*$/, "").replace(/\/+/, "/")
	let id = newID()
	let client = {
		socket: socket,
		room: room,
		shared: {
			id: id,
			pos: [0, 0, 0],
			quat: [0, 0, 0, 1],
			user: {}
		}
	}
	clients[id] = client

	console.log(`client ${client.shared.id} connecting to room ${client.room}`);

	// enter this room
	getRoom(client.room).clients[id] = client

	socket.on('message', (msg) => {
		//console.log(msg)
		const s = msg.indexOf(" ")
		if (s > 0) {
			const cmd = msg.substr(0, s), rest = msg.substr(s+1)
			switch(cmd) {
				case "pose": 
					let vals = rest.split(" ").map(Number)
					client.shared.pos = vals.slice(0,3)
					client.shared.quat = vals.slice(3, 7)
					break;
				case "user": 
					client.shared.user = JSON.parse(rest)
					break;
			}
		}
	});

	socket.on('error', (err) => {
		console.log(err)
		// should we exit?
	});

	socket.on('close', () => {
		console.log("close", id)
		console.log(Object.keys(clients))
		delete clients[id]

		// remove from room
		if (client.room) delete rooms[client.room].clients[id]

		console.log(`client ${id} left`)
	});

	socket.send("handshake " + id)
	socket.send("project " + JSON.stringify(getRoom(client.room).project))
});

setInterval(function() {
	for (let roomid of Object.keys(rooms)) {
		const room = rooms[roomid]
		let clientlist = Object.values(room.clients)
		let shared = "others " + JSON.stringify(clientlist.map(o=>o.shared));
		clientlist.forEach(c => c.socket.send(shared))
	}
}, 1000/30);

