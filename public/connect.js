function connect(handleMessage, logMessage = console.log, reconnect_timeout=5000) {
	const HOST = location.origin.replace(/^http/, 'ws');
	let server = new WebSocket(HOST);
	logMessage( `connecting to ${HOST}` )
	server.binaryType = "arraybuffer";

	reconnect = function() {
		logMessage ("connection lost")
		setTimeout(() => {
			if (!server) server = connect(handleMessage, logMessage)
		}, reconnect_timeout);
	}

	server.onerror = function(event, err) {
		logMessage( `connection error ${event} ${server.readyState}` )
		console.error("WebSocket error observed:", event, server.readyState);
		server = null
		reconnect();
	}

	server.onopen = () => {
		logMessage( `connected to ${HOST}`)

		server.onclose = function(event) {
			logMessage("disconnected")
			server = null
			reconnect();
		}

		//socket.send('Here\'s some text that the server is urgently awaiting!'); 
		server.onmessage = event => {
			if (handleMessage) handleMessage(event.data)
		}

		server.send(`handshake`)
	}
	return server
}