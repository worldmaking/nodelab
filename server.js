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

function broadcast(msg) {
	wss.clients.forEach(function (client) {
       if (client.readyState == ws.OPEN) {
          client.send( msg );
       }
    });
}

wss.on('connection', (client) => {
	console.log('client connected');
	broadcast("somebody joined");
	client.on('close', () => {
		console.log('client disconnected')
		broadcast("somebody left");
	});
	client.on('message', (msg) => {
		console.log('received: %s', msg);
		broadcast("somebody said " + msg);
	})
});

server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));

console.log("ok")