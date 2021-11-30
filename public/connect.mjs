function connectToWorld(opt={}) {

	let options = Object.assign({
		url: location.origin.replace(/^http/, 'ws'),
		room: "/",
		reload_on_disconnect: false,
		
		userName: "Anonymous",
		userRGB: [Math.random(), Math.random(), Math.random()],		
		log: console.log,
		onproject: function(projectData) { 
			options.log ("Received project message, but ignored it since no 'onproject' handler was provided.")
		},		
		onuser: function(id, userData) { 
			options.log (`Received user message for ${id}, but ignored it because no 'onuser' handler was provided.`)
		},
		onuserexit: function(id, userData) { 
			options.log (`Received user exit message for ${id}, but ignored it because no 'onuserexit' handler was provided.`)
		},	
	}, opt);

	let users = {
		self: {
			id: "",	
			volatile: {		
				poses: [new PoseData(0, 1.4, 2)],
			},
			user: {
				name: options.userName,
				rgb: options.userRGB
			}
		},
		others: []
	};


	function connect(users) {
		options.log(`connecting to ${options.url}${options.room}`)
		let server = new WebSocket(options.url + options.room);
		server.binaryType = "arraybuffer";

		const reconnect = function() {
			server = null
			setTimeout(() => {
				if (options.reload_on_disconnect) {
					location.reload();
				} else {
					if (!server) connect(users)
				}
			}, 3000);
		}

		server.onerror = function(event, err) {
			options.log("WebSocket error observed:", err, server.readyState);
			server.close();
			reconnect();
		}

		server.onopen = () => {
			options.log( `connected to ${options.url}`)
			server.onclose = function(event) {
				options.log("disconnected")
				reconnect();
			}
			server.onmessage = (event) => {
				const msg = Message.fromData(event.data);				
				
				switch (msg.cmd) {
					case "handshake":
						// Accept our new ID.
						users.self.id = msg.val.id;

						// Initialize replication for all other users already in the room.
						for (let o of msg.val.others) {
							users.others[o.volatile.id] = o.volatile;
							options.onuser(o.volatile.id, o.user);							
						}
						break;
					case "user":
						// Accept notification of a new user joining, 
						// or an existing user changing their persistent data.
						options.onuser(msg.val.id, msg.val.user);
						break;
					case "others":
						// Accept an update of all users' volatile data. Prune out information about ourselves.
						users.others = msg.val.filter(o=>o.id != users.self.id);						
						break;
					case "exit": 
						// Accept notification that a user has left the room.
						options.onuserexit(msg.val);
						break;	
					case "reload": 
						// Reload the scene on command from the server.
						location.reload();
						break;								
					case "project":
						// Accept JSON representing the current state of the world contents.
						if (options.onproject) options.onproject(msg.val);
						break;					
					default: 
						options.log("unknown message", msg);
				}			
			}

			// send an update regarding our userdata:
			{
				const message = new Message("user", users.self.user);
				message.sendWith(server);
			}
		}

		return server
	}

	const server = connect(users);

	setInterval(() => {
		if (server && server.readyState==1 && users.self.id) {
			const message = new Message("pose", users.self.volatile);
			message.sendWith(server);
		}
	}, 1000/30);

	return {
		users,
		server
	};
}

export { 
	connectToWorld 
};