

const voice = {

	room: "/",
	server: null,
	localStream: null,
	connections: [],

	// Free public STUN servers provided by Google.
	iceServers: {
		iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
		{ urls: 'stun:stun2.l.google.com:19302' },
		{ urls: 'stun:stun3.l.google.com:19302' },
		{ urls: 'stun:stun4.l.google.com:19302' },
		// {
		//     urls: "turn:3.145.6.86:3478?transport=udp", 
		//     credential: 'root', 
		//     username: 'user'
		//   }
		],
	},

	
	async setLocalStream() {
		let stream
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false,
			})
		} catch (error) {
			console.error('Could not get user media', error)
		}

		this.localStream = stream
		//localVideoComponent.srcObject = stream
	},

	addLocalTracks(rtcPeerConnection) {
		this.localStream.getAudioTracks().forEach((track) => {
			console.log(track)
			rtcPeerConnection.addTrack(track, this.localStream)
		})
	},

	setRemoteStream(event,id) {
		// remoteVideoComponent.srcObject = event.streams[0]
		// remoteStream = event.stream
		let audio_chat_container = document.getElementById('audio-chat-container');
		
		let audio  = document.createElement('audio');
	
		audio.setAttribute('data-socket', id);
		audio.setAttribute('id', 'remote-audio');
			
		audio.srcObject=event.streams[0];
		audio.autoplay    = true; 
			
		audio_chat_container.appendChild(audio);
	},

	sendIceCandidate(event,id) {
		if (event.candidate) {
			// socket.emit('webrtc_ice_candidate', {
			// 	roomId,
			// 	label: event.candidate.sdpMLineIndex,
			// 	candidate: event.candidate.candidate,
			// },id 
			// )
			{
				const message = new Message("webrtc_ice_candidate", {
					roomId: this.room,
					label: event.candidate.sdpMLineIndex,
					candidate: event.candidate.candidate,
					id
				});
				message.sendWith(this.server);
			}
		}
	},

	async startCall(id, user) {
		if(!this.connections[id]){
			this.connections[id] = new RTCPeerConnection(this.iceServers);
			this.addLocalTracks(this.connections[id])
			this.connections[id].ontrack = (event) => {
				this.setRemoteStream(event,id)
			}
			this.connections[id].onicecandidate  = (event) => {
				this.sendIceCandidate(event,id)
			}
			await this.createOffer(this.connections[id], id)                                                
		}
	},

	async createOffer(rtcPeerConnection, toID) {
		let sessionDescription
		try {
			sessionDescription = await rtcPeerConnection.createOffer()
			rtcPeerConnection.setLocalDescription(sessionDescription)
		} catch (error) {
			console.error(error)
		}
	
		// socket.emit('webrtc_offer2', {
		// 	type: 'webrtc_offer',
		// 	sdp: sessionDescription,
		// 	roomId,
		// },
		// toID)

		const message = new Message("webrtc_offer2", {
			type: 'webrtc_offer',
			sdp: sessionDescription,
			roomId: this.room,
			id: toID
		});
		message.sendWith(this.server);
		
	},

}

















function connectToWorld(opt={}) {

	let options = Object.assign({
		url: location.origin.replace(/^http/, 'ws'),
		room: "/",
		reload_on_disconnect: false,
		
		userName: "Anonymous",
		userRGB: [Math.random(), Math.random(), Math.random()],		
		log: console.log,
		onconnect: function(myID) {
			options.log ("Received connection handshake, but no 'onconnect' handler was provided.");
		},		
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

						options.onconnect(users.self.id);

						// Initialize replication for all other users already in the room.
						for (let o of msg.val.others) {
							users.others[o.volatile.id] = o.volatile;
							options.onuser(o.volatile.id, o.user);							
						}
						break;
					case "user":
						console.log("new user", msg.val)
						// Accept notification of a new user joining, 
						// or an existing user changing their persistent data.
						options.onuser(msg.val.id, msg.val.user);

						voice.startCall(msg.val.id, msg.val.user)

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
						
					// audio socket messages:



					default: 
						options.log("unknown message", msg);
				}			
			}

			// send an update regarding our userdata:
			{
				const message = new Message("user", users.self.user);
				message.sendWith(server);
			}
			{
				voice.setLocalStream();
				// const message = new Message("audio_join", options.room);
				// message.sendWith(server);
			}
		}

		voice.server = server;
		voice.room = options.room
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