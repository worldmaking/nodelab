function connect(handleMessage, opt) {
	const self = Object.assign({ 
		log: console.log, 
		reconnect_timeout: 3000,
		url: location.origin.replace(/^http/, 'ws')
		}, opt)
	self.server = new WebSocket(self.url);
	self.log( `connecting to ${self.url}` )
	self.server.binaryType = "arraybuffer";

	reconnect = function() {
		self.log ("connection lost")
		setTimeout(() => {
			if (!self.server) self.server = connect(handleMessage, self)
		}, self.reconnect_timeout);
	}

	self.server.onerror = function(event, err) {
		self.log( `connection error ${event} ${self.server.readyState}` )
		console.error("WebSocket error observed:", event, self.server.readyState);
		self.server = null
		reconnect();
	}

	self.server.onopen = () => {
		self.log( `connected to ${self.url}`)
		self.server.onclose = function(event) {
			self.log("disconnected")
			self.server = null
			reconnect();
		}
		self.server.onmessage = event => {
			if (handleMessage) handleMessage(event.data, self.server)
		}
	}
	return self
}