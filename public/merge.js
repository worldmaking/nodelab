const Automerge = require('automerge');

/**
 * scene might look like...
 * 
 * scene = {
 *  nodes: {
 *    _props
 *  },
 *  arcs: {
 *  }
 * }
 */


class Merger {

    doc1;
    backends;

    constructor (scene) {
        syncState = window.Automerge.initSyncState()

        // make a local automerge doc from our scene
        let doc1 = window.Automerge.from(scene);
        const actorID = window.Automerge.getActorId(doc1).toString()
        // pass new changes to here
    
        let backends= {}
        backends['doc1'] = doc1      
    }

    handleSyncMessage (message) {
        remoteSyncMessage = new Uint8Array(Array.from(message))
        backends.doc1 = Automerge.clone(backends.doc1)
        const [nextBackend, nextSyncState, patch] = Automerge.receiveSyncMessage(
            backends.doc1,
            syncState,
            remoteSyncMessage,
        ) 
        backends.doc1 = nextBackend
        syncState = nextSyncState
        console.log('sync\n','nextBackend', nextBackend, '\n\nnextSyncState', nextSyncState, '\n\npatch', patch)
    
        console.log('adding a new node');
    }
}


const merger = new Merger(initialScene);



merger.handleSyncMessage(message);










function setupMerge(scene) {
    let doc1;
    let backends;



    let merger = {};

    merger.handleSyncMessage = function(message) {
        //
    }

    return merger;
}