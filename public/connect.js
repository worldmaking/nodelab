function connect(handleMessage, opt) {
	const options = Object.assign({ 
		log: console.log, 
		reconnect_timeout: 3000,
		url: location.origin.replace(/^http/, 'ws')
		}, opt)
	console.log(options)
	let server = new WebSocket(options.url);
	options.log( `connecting to ${options.url}` )
	server.binaryType = "arraybuffer";

	reconnect = function() {
		options.log ("connection lost")
		setTimeout(() => {
			if (!server) server = connect(handleMessage, options)
		}, options.reconnect_timeout);
	}

	server.onerror = function(event, err) {
		options.log( `connection error ${event} ${server.readyState}` )
		console.error("WebSocket error observed:", event, server.readyState);
		server = null
		reconnect();
	}

	server.onopen = () => {
		options.log( `connected to ${options.url}`)
		server.onclose = function(event) {
			options.log("disconnected")
			server = null
			reconnect();
		}
		server.onmessage = event => {
			if (handleMessage) handleMessage(event.data, server)
		}
	}
	return server
}