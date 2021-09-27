function connectToWorld(opt={}) {

	let options = Object.assign({
		url: location.origin.replace(/^http/, 'ws'),
		room: "/",
		reload_on_disconnect: false,

		log: console.log,
		
	}, opt)

	console.log("options", options)

	let world = {
		self: {
			id: "",
			pos: [0, 0, 0],
			quat: [0, 0, 0, 1],
			user: {
				rgb: [Math.random(), Math.random(), Math.random()]
			}
		},
		others: [],
	}


	function connect(world) {
		options.log(`connecting to ${options.url}${options.room}`)
		server = new WebSocket(options.url + options.room);
		server.binaryType = "arraybuffer";

		reconnect = function() {
			server = null
			setTimeout(() => {
				if (options.reload_on_disconnect) {
					location.reload();
				} else {
					if (!server) connect(world)
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
				let msg = event.data
				//console.log(msg)
				let s = msg.indexOf(" ")
				if (s > 0) {
					const cmd = msg.substr(0, s), rest = msg.substr(s+1)
					switch (cmd) {
						case "handshake":
							world.self.id = rest
							break;
						case "others":
							world.others = JSON.parse(rest).filter(o=>o.id != world.self.id)
							break;

						case "reload": 
							location.reload();
							break;
						default: 
							options.log(msg);
					}
				}
			}

			// send an update regarding our userdata:
			server.send(`user ${JSON.stringify(world.self.user)}`)
		}

		return server
	}

	server = connect(world);

	setInterval(() => {
		if (server && server.readyState==1 && world.self.id) {
			server.send(`pose ${world.self.pos.join(" ")} ${world.self.quat.join(" ")}`)
		}
	}, 1000/30);

	return {
		world,
		server
	};
}
