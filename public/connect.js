
// import * as Automerge from "https://cdn.skypack.dev/automerge@1.0.1-preview.4"

function connectToWorld(opt={}) {

	let options = Object.assign({
		// url: "wss://alicelab.herokuapp.com",
		url: "wss://localhost:3000",
		room: "/",
		reload_on_disconnect: false,

		log: console.log,
		
	}, opt)

	//console.log("options", options)

	let world = {
		self: {
			id: "",
			pos: [0, 1.4, 2],
			quat: [0, 0, 0, 1],
			user: {
				rgb: [Math.random(), Math.random(), Math.random()]
			}
		},
		others: []
	}

	syncState = window.Automerge.initSyncState()

	// make a local automerge doc from our scene
	let doc1 = window.Automerge.from(world);
	const actorID = window.Automerge.getActorId(doc1).toString()
	// pass new changes to here

	let backends= {}
	backends['doc1'] = doc1

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

			let msg = JSON.stringify({
				cmd: 'actorID',
				data: actorID,
				date: Date.now()
			  })
			server.send(msg);
			console.log(msg)

			server.onclose = function(event) {
				options.log("disconnected")
				reconnect();
			}
			server.onmessage = (event) => {
				let msg = event.data
				let s
				try {
				  msg = JSON.parse(msg)
				  console.log(msg)
				} catch (e) {
				  s = msg.indexOf(" ")
				}
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
						case "project":
							if (options.onproject) options.onproject(JSON.parse(rest))
							break;
						default: 
							options.log(msg);
					}
				} else {
					switch(msg.cmd){
						case 'sync':
							// console.log(backends.doc1, syncState, msg.data.syncMessage)
							remoteSyncMessage = new Uint8Array(Array.from(msg.data.syncMessage))
							backends.doc1 = Automerge.clone(backends.doc1)
							const [nextBackend, nextSyncState, patch] = Automerge.receiveSyncMessage(
								backends.doc1,
								syncState,
								remoteSyncMessage,
							) 
							backends.doc1 = nextBackend
							syncState = nextSyncState
							console.log('sync\n','nextBackend', nextBackend, '\n\nnextSyncState', nextSyncState, '\n\npatch', patch)
					
							console.log('adding a new node')
							newnode()
						break
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

	
	function newnode(){
	

	doc1 = Automerge.change(doc1, 'newnode', (doc) => {
		// create the node
		nodename = 'osc_' + Math.random()
		doc[nodename] = {};
	});
	
	const [nextSyncState, syncMessage] = Automerge.generateSyncMessage(backends.doc1, syncState)
	// updatePeers(newDoc)
	syncState = nextSyncState
	msg = JSON.stringify({
		cmd: 'sync',
		data: {
			// convert uInt8array to js array
			syncMessage: Array.from(syncMessage)
		}
	})
		console.log(msg)
		server.send(msg)
		dirty = false

	}

}

