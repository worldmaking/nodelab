console.log('calling form parent process');


// This Code is modified from https://github.com/borjanebbal/webrtc-node-app

const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)

//app.use('/', express.static('public'))

io.on('connection', (socket) => {
  socket.on('join', (roomId) => {

    let numberOfClients = 0;
    if (io.sockets.adapter.rooms.has(roomId)) numberOfClients = io.sockets.adapter.rooms.get(roomId).size

    // These events are emitted only to the sender socket.
    if (numberOfClients == 0) {
      console.log(`Creating room ${roomId} and emitting room_created socket event`)
      //create a room with the room ID
      socket.join(roomId)
      socket.emit('room_created', roomId)
  
    } 

  //   else if (numberOfClients == 1) {
  //     // if there are some one in the room 
  //     // emit your id to the person in the room 
  //       console.log(`Joining room ${roomId} and emitting room_joined socket event`)
  //       socket.join(roomId)
  //       const clientd = io.sockets.adapter.rooms.get(roomId)
  //       let clientlist = []
  //       for (const clientId of clientd ) {clientlist.push(clientId)}
  //       console.log(clientlist)
  
  //       // socket.emit('room_joined', roomId)
  //       socket.emit('room_joined2',socket.id, numberOfClients, clientlist, roomId)
  
  // // console.log(socket.id, numberOfClients, clientd, roomId)
  //     } 
  
  else if (numberOfClients >= 1) {
      // if there are some one in the room 
      // emit your id to the person in the room 
        console.log(`Joining room ${roomId} and emitting room_joined socket event`)
        socket.join(roomId)
        //socket.emit('room_joined', roomId)
        
        const clientd = io.sockets.adapter.rooms.get(roomId)
        let clientlist = []
        for (const clientId of clientd ) {clientlist.push(clientId)}
        console.log(clientlist)
        socket.emit('room_joined2', socket.id, numberOfClients, clientlist, roomId)
  
      } 


    else {
    // This limits the amount of people in the room 
    // potentially for optimization reasons
      console.log(`Can't join room ${roomId}, emitting full_room socket event`)
      socket.emit('full_room', roomId)
    }
  })








  // These events are emitted to all the sockets connected to the same room except the sender.
  // when a user enters a room it emits a call
  socket.on('start_call2', (roomId) => {
    console.log(`Broadcasting start_call event to peers in room ${roomId}`)   
    const clientd = io.sockets.adapter.rooms.get(roomId)

    let clientlist = []
    for (const clientId of clientd ) {clientlist.push(clientId)}
    socket.to(roomId).emit('start_call2',socket.id, clientlist.length, clientlist, roomId)
  })

  // 
  socket.on('webrtc_offer2', (event, toID) => {
    console.log(`Broadcasting webrtc_offer event to peers in room ${event.roomId}`)
    const clientd = io.sockets.adapter.rooms.get(event.roomId)
    let clientlist = []
    for (const clientId of clientd ) {clientlist.push(clientId)}

    io.to(toID).emit('webrtc_offer2',socket.id, clientlist.length, clientlist, event.sdp)
    //socket.to(event.roomId).emit('webrtc_offer2', event.sdp)
  })


  socket.on('webrtc_answer2', (event, toID) => {
    console.log(`Broadcasting webrtc_answer event to peers in room ${event.roomId}`)
    //socket.to(event.roomId).emit('webrtc_answer2', event.sdp,socket.id )
    io.to(toID).emit('webrtc_answer2', event.sdp,socket.id )
  })

  socket.on('webrtc_ice_candidate', (event, toID) => {
    console.log(`Broadcasting webrtc_ice_candidate event to peers in room ${event.roomId}`)
    io.to(toID).emit('webrtc_ice_candidate', event, socket.id)
    //socket.to(event.roomId).emit('webrtc_ice_candidate', event, socket.id)
  })


  socket.on('disconnect', function() {
    io.sockets.emit("user-left", socket.id);
  })


  socket.on('dis_con', function(event) {
    socket.leave(event.roomId)
    io.sockets.emit("user-left", socket.id);
  })


})

// START THE SERVER =================================================================
const port = process.env.PORT || 3123
server.listen(port, () => {
  console.log(`Express server listening on port ${port}`)
})