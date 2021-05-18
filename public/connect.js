let port = window.location.port
let socket
let connection_div = document.getElementById("connection")
//const socketpath = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${port}/`
const HOST = location.origin.replace(/^http/, 'ws');

const reconnect_timeout = 1000 * 10

let serverMessage

function connect() {
	if (socket) return;

	socket = new WebSocket(socketpath);
	connection_div.innerText = `connecting to ${HOST}`
	socket.binaryType = "arraybuffer";

	reconnect = function() {
		connection_div.innerText = ("connection lost")
		//setTimeout(connect, reconnect_timeout)
	}

	socket.onerror = function(event, err) {
		connection_div.innerText = `connection error ${event} ${socket.readyState}`
		console.error("WebSocket error observed:", event, socket.readyState);
		socket = null
		reconnect();
	}

	socket.onopen = () => {
		connection_div.innerText = `connected to ${HOST}`

		socket.onclose = function(event) {
			console.log("WebSocket is closed now.");
			connection_div.innerText = "disconnected"
			socket = null
			reconnect();
		}

		//socket.send('Here\'s some text that the server is urgently awaiting!'); 
		socket.onmessage = event => {
			if (serverMessage) {
				if (event.data[0]=="{") {
					serverMessage(JSON.parse(event.data), socket)
				} else {
					console.log(`Received message ${event.data}`);
				}
			}
// 			//if(event.data instanceof ArrayBuffer) {
// 			let msg = JSON.parse(event.data)
// 			if (msg.cmd == "setcode") {
// 				//console.log("setcode", msg.code)

// 				editor.setValue(msg.code)
// 				editor_dirty = false;
// 			} else if (msg.cmd == "setstate") {
// 				data.innerText = JSON.stringify(msg.state, null, "  ")
// 			} else {
// 				console.log(`Received message ${msg}`);
// 			}
		}

		// request current code:
		socket.send(`{"cmd":"getcode"}`)
	}
}
connect();