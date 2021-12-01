// DOM elements.
// This Code is from https://github.com/borjanebbal/webrtc-node-app

//const roomSelectionContainer = document.getElementById('room-selection-container')
//const roomInput = document.getElementById('room-input')
//const connectButton = document.getElementById('connect-button')



const audioChatContainer = document.getElementById('audio-chat-container')
//const localVideoComponent = document.getElementById('local-video')
//const remoteVideoComponent = document.getElementById('remote-video')

// Variables.

console.log("audiorun")

const socket = io('https://agile-basin-71343.herokuapp.com/', { transports : ['websocket'] })
// https://agile-basin-71343.herokuapp.com/
// https://nodelab-rtc-signaller.herokuapp.com/
//const socket = io(':3123', { transports : ['websocket'] })

const mediaConstraints = {
	audio: true,
	video: false,
}
let localStream
let remoteStream
let isRoomCreator
let rtcPeerConnection // Connection between the local device and the remote peer.
let roomId


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

// BUTTON LISTENER ============================================================
// connectButton.addEventListener('click', () => {
// 	joinRoom(roomInput.value)
// })

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








export default function joinRoom() {

	console.log("joinRoom")
	
	let room = '/multiplayer'
	//if (room == '') {
	//	alert('Please type a room ID')
//		
	//} 

	//else {
		roomId = room
		console.log(typeof room) 
		socket.emit('join', room)
		//showVideoConference()
        //console.log(app)
	//}


	// socket.emit('join', room)
}

function leaveRoom(){
	//socket.close()
	socket.emit('dis_con',roomId)
}





// function showVideoConference() {
// 	roomSelectionContainer.style = 'display: none'
// 	videoChatContainer.style = 'display: block'
// }

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

socket.on('start_call2', async (id,count,clients,roomId) => {
console.log("startCall")
	if(!connections[id]){
		connections[id] = new RTCPeerConnection(iceServers);
		addLocalTracks(connections[id])
		connections[id].ontrack = function() {
			setRemoteStream(event,id)
		}
		connections[id].onicecandidate  = function() {
			sendIceCandidate(event,id)
		}
		await createOffer(connections[id], id)                                                
	}
})

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