
// DOM elements.
// This Code is addapted from the tutorial on https://github.com/borjanebbal/webrtc-node-app
// This is modified to be a mesh network from being a standard peer to peer 
// The index.html was removed and the features implemented into the HUD ui
// This implementation also only uses audio to make sure it is preformant




//
const audioChatContainer = document.getElementById('audio-chat-container')

let socket;



//This checks if we are on a local host or deployed to heroku
if (location.hostname === "localhost" || location.hostname === "127.0.0.1"){
	socket = io(':3123', { transports : ['websocket'] })
	console.log("Connected to local socket")
}

//Connects to a seperate heroku server
//This would be removed if the heroku server is merged with the server.js
else{
	socket = io('https://agile-basin-71343.herokuapp.com/', { transports : ['websocket'] })
	console.log("Connected to agile-basin-71343")
}


//This sets the constraints of the stream, it is able to send video and audio
//currently it is audio only
const mediaConstraints = {
	audio: true,
	video: false,
}

let localStream
let remoteStream
let isRoomCreator
let rtcPeerConnection // Connection between the local device and the remote peer.
let roomId

//This contains every list of connected clients
var connections=[]

// Free public STUN servers provided by Google.
const iceServers = {
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
	}


// SOCKET EVENT CALLBACKS =====================================================
socket.on('room_created', async () => {
	console.log('Socket event callback: room_created')

	await setLocalStream(mediaConstraints)
	isRoomCreator = true
})

socket.on('room_joined2', async () => {
	console.log('Socket event callback: room_joined')

	await setLocalStream(mediaConstraints)
	socket.emit('start_call2', roomId)
})

socket.on('full_room', () => {
	console.log('Socket event callback: full_room')
	alert('The room is full, please try another one')
})

// FUNCTIONS ==================================================================

// Is called by what ever html pagethe client is on 
// the client would send the uuid in though this function
// The uuid would be used to apply the webrtc audio to a three.js object 
function initialize(){
	joinRoom();
}

//the trigger function to start the audio
function joinRoom() {

	console.log("joinRoom")
//This insures that the room is generated based on the page the client is currently on
	let room = location.hostname
	roomId = room
//Sends the function to the server to join the room 
	socket.emit('join', room)

}

//Tester : not fully developed
function leaveRoom(){
	socket.emit('dis_con',roomId)
}

// The export function for mjs
export{
	joinRoom,
	leaveRoom,
	initialize
}


// function showVideoConference() {
// 	roomSelectionContainer.style = 'display: none'
// 	videoChatContainer.style = 'display: block'
// }

// The set local stream 
// gets the clients audio or video stream
async function setLocalStream(mediaConstraints) {
	let stream
	try {
		stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
	} catch (error) {
		console.error('Could not get user media', error)
	}

	localStream = stream
	//localVideoComponent.srcObject = stream
}


// SOCKET EVENT CALLBACKS =====================================================
//this triggers the webrtc exchange
socket.on('start_call2', async (id,count,clients,roomId) => {
console.log("startCall")

// Since this will be called multiple times as the client is added 
// It checks if a connection is already made with the user thats making the call
// If not it creates a new entry into the list of connections 
	if(!connections[id]){
		connections[id] = new RTCPeerConnection(iceServers);
		addLocalTracks(connections[id])
		connections[id].ontrack = function() {
			setRemoteStream(event,id)
		}
		connections[id].onicecandidate  = function() {
			// ice canditates are exchanged
			sendIceCandidate(event,id)
		}
		await createOffer(connections[id], id)                                                
	}
})

//The client receives a web rtc offer 
socket.on('webrtc_offer2', async (id,count,clients,eventd) => {
	console.log("webrtc_offer")
	if(!connections[id]){
		connections[id] = new RTCPeerConnection(iceServers)
		addLocalTracks(connections[id])
		connections[id].ontrack = function() {
			setRemoteStream(event,id)
		}
		connections[id].onicecandidate  = function() {
		 sendIceCandidate(event,id)
	 }
	 connections[id].setRemoteDescription(new RTCSessionDescription(eventd))
	 await createAnswer(connections[id], id)
 }
})


socket.on('webrtc_answer2', (event, fromId) => {
	console.log("webrtc_answer")
	connections[fromId].setRemoteDescription(new RTCSessionDescription(event))
})

socket.on('webrtc_ice_candidate', (event,id) => {
	// ICE candidate configuration.
	var candidate = new RTCIceCandidate({
		sdpMLineIndex: event.label,
		candidate: event.candidate,
	})
	connections[id].addIceCandidate(candidate)
})




socket.on('user-left', function(id){
		console.log(id + "Left ")
    var audio = document.querySelector('[data-socket="'+ id +'"]');
    //var parentDiv = video.parentElement;
    audio.remove();
});



// FUNCTIONS ==================================================================
function addLocalTracks(rtcPeerConnection) {
	localStream.getAudioTracks().forEach((track) => {
		console.log(track)
		rtcPeerConnection.addTrack(track, localStream)
	})
}

async function createOffer(rtcPeerConnection, toID) {
	let sessionDescription
	try {
		sessionDescription = await rtcPeerConnection.createOffer()
		rtcPeerConnection.setLocalDescription(sessionDescription)
	} catch (error) {
		console.error(error)
	}

	socket.emit('webrtc_offer2', {
		type: 'webrtc_offer',
		sdp: sessionDescription,
		roomId,
	},
	toID)
	
}

// Session descriptions:
// The configuration of an endpoint on a WebRTC connection is called a session 
// description. The description includes information about the kind of media being 
// sent, its format, the transfer protocol being used, the endpoint's IP address and 
// port, and other information needed to describe a media transfer 
// endpoint. This information is exchanged and stored using Session Description Protocol
// From: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity

async function createAnswer(rtcPeerConnection, toID) {
	let sessionDescription
	try {
		sessionDescription = await rtcPeerConnection.createAnswer()
		rtcPeerConnection.setLocalDescription(sessionDescription)
	} catch (error) {
		console.error(error)
	}

	socket.emit('webrtc_answer2', {
		type: 'webrtc_answer',
		sdp: sessionDescription,
		roomId,
	}, 
	toID)
}
	



//creates the stream oobject that is appended to the html
function setRemoteStream(event,id) {
	// remoteVideoComponent.srcObject = event.streams[0]
	// remoteStream = event.stream
	var audio_chat_container = document.getElementById('audio-chat-container');
	
	var audio  = document.createElement('audio');

	audio.setAttribute('data-socket', id);
	audio.setAttribute('id', 'remote-audio');
		
	audio.srcObject=event.streams[0];
	audio.autoplay    = true; 
		
	audio_chat_container.appendChild(audio);
}



// an exchanged regarding the information of the network connection
function sendIceCandidate(event,id) {
	if (event.candidate) {
		socket.emit('webrtc_ice_candidate', {
			roomId,
			label: event.candidate.sdpMLineIndex,
			candidate: event.candidate.candidate,
		},id 
		)
	}
}
