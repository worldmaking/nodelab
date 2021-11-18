const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require("path");
const Automerge = require('automerge')


// blank document
let doc = {
    nodes: {},
    arcs: {},
};
let incomingDeltas = [];

// make a local automerge doc from our scene
let doc1 = Automerge.from(doc);
let syncStates = {
  serverState: Automerge.initSyncState()
}

// test just adding a node to the doc
var newDoc = Automerge.change(doc1, 'newnode', (doc) => {
  // create the node
  doc.nodes['osc_1'] = {
    _props: {
      kind: 'cube',
      orient: [
        Math.random(),
        Math.random(),
        Math.random(),
        Math.random(),
      ],
      pos: [Math.random(), Math.random() + 1, Math.random()],
      colour: '#' + Math.floor(Math.random() * 16777215).toString(16),
    }
  }
  // otherObject[delta.path] = delta._props
});
const [nextSyncState, syncMessage] = Automerge.generateSyncMessage(newDoc, syncStates.serverState)

// const app = express();
const PORT = process.env.PORT || 3000;
const INDEX = 'app/index.html';

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const { Server } = require('ws');


const wss = new Server({ server });

wss.getUniqueID = function () {
  function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4();
};

wss.on('connection', (ws) => {

  //!TODO if you generate unique IDs for the client but you make it so they can persist between sessions (like an author name...) the following will let you assign a syncstate and then resume the sync state when they rejoin, reducing computation and network traffic... 
  /*
    if (data.type === 'HELLO') {
    if (syncStates[source] === undefined) {
      syncStates[source] = {}
      syncStates[source][docId] = Automerge.Backend.decodeSyncState(db.getSyncState(docId, source))
      sendMessage({ source: workerId, target: source, type: 'HELLO' })
    }
    return
  }
  */
  ws.on('close', () => console.log('Client disconnected'));


  ws.on('message', function incoming(message){
      let msg = JSON.parse(message)
      switch(msg.cmd){
          case 'actorID':
            console.log('new client actorID', msg.data)
            ws.id = msg.data
            // create a syncState for the new client
            syncStates[ws.id] = Automerge.initSyncState()



            
            syncStates[ws.id]= nextSyncState
            // send sync state to client
            msg = JSON.stringify({
              cmd: 'sync',
              data: {
                state: nextSyncState,
                // convert uInt8array to js array
                syncMessage: Array.from(syncMessage)
              }
            })
            ws.send(msg)
          break

          case 'sync':
            remoteSyncMessage = new Uint8Array(Array.from(msg.data.syncMessage))

            Object.entries(syncStates).forEach(([peer, syncState]) => {
              console.log('peer\n', peer, '\nsyncState', syncState)
              const [nextSyncState, syncMessage] = Automerge.generateSyncMessage(newDoc, syncStates.serverState)
              syncStates[ws.id]= nextSyncState

              if (syncMessage) {
                msg = JSON.stringify({
                  cmd: 'sync',
                  data: {
                    state: nextSyncState,
                    // convert uInt8array to js array
                    syncMessage: Array.from(syncMessage)
                  }
                })
                ws.send(msg)
              }
            })

          break
          // case 'changes':
          //   console.log(msg)
          //   // just broadcast the message to all peers. 
          //   wss.clients.forEach((client) => {
          //     client.send(JSON.stringify(msg));
          //   });
          // break
      }


  })

});
// app.use(express.static('app'))



// app.set("views", path.join(__dirname, "app/index.html"));

// app.get("/", (req, res) => {
//     res.status(200).send("WHATABYTE: Food For Devs");
// });

// //initialize a simple http server
// const server = http.createServer(app);

// //initialize the WebSocket server instance
// const wss = new WebSocket.Server({ server });

// let clients = []
// wss.on('connection', function connection(ws){

//     //connection is up, let's add a simple simple event
//     ws.on('message', function incoming(message){

//         //log the received message and send it back to the client
//         console.log('received: %s', message);
//         ws.send(`Hello, you sent -> ${message}`);

//             //broadcast the message to all the clients
//         clients.forEach(function(client) {
//             client.send(message.utf8Data);
//         });
//     });

//     //send immediatly a feedback to the incoming connection    
//     ws.send('Hi there, I am a WebSocket server');
// });

// //start our server
// server.listen(port, () => {
//     console.log(`Server started on port ${server.address().port} :)`);
// });