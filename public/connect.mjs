import {Message, PoseData} from './networkMessages.mjs';


function connectToWorld(opt={}) {

	let options = Object.assign({
		url: "wss://alicelab.herokuapp.com",
		room: "/",
		reload_on_disconnect: false,
		userName: "Anonymous",
		userRGB: [Math.random(), Math.random(), Math.random()],		
		log: console.log,
		onproject: function(projectData) { 
			options.log ("Received project message, but ignored it since no 'onproject' handler was provided.")
		},		
	}, opt);

	let users = {
		self: {
			id: "",
			poses: [new PoseData(0, 1.4, 2)],
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
				const msg = JSON.parse(event.data);				
				
				switch (msg.cmd) {
					case "handshake":
						users.self.id = msg.val;
						break;
					case "others":
						users.others = msg.val.filter(o=>o.id != users.self.id);
						break;
					case "reload": 
						location.reload();
						break;					
					case "project":
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
			const message = new Message("pose", users.self.poses);
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