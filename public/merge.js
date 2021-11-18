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

/**
 * Call this function to intialize automerge, and get an object
 * back that you can use as an interface for transactions.
 * @param {object} scene initial state of the scene document
 * @returns a merge object containing functions {handleSyncMessage}
 */
function setupMerge(scene) {    

    // make a local automerge doc from our scene
    const doc1 = Automerge.from(scene);
    const actorID = Automerge.getActorId(doc1).toString();

    let localSyncState = Automerge.initSyncState();
    let clientSyncStates = {};

    // pass new changes to here
    let backends= {};
    backends['doc1'] = doc1;

    let hasLocalChanges = false;

    let merger = {};

    merger.addClient = function(actorID) {
        // TODO: Does the return value need to be stored somewhere?
        Automerge.initSyncState();
        clientSyncStates[actorID] = localSyncState;
    }

    merger.handleSyncMessage = function(message) {
        remoteSyncMessage = new Uint8Array(Array.from(message))
        backends.doc1 = Automerge.clone(backends.doc1)
        const [nextBackend, nextSyncState, patch] = Automerge.receiveSyncMessage(
            backends.doc1,
            localSyncState,
            remoteSyncMessage,
        ) 
        backends.doc1 = nextBackend
        localSyncState = nextSyncState
        console.log('sync\n','nextBackend', nextBackend, '\n\nnextSyncState', nextSyncState, '\n\npatch', patch)
    
        console.log('adding a new node');
    }

    merger.applyChange = function(commitMessage, deltaFunction) {
        hasLocalChanges = true;
        return Automerge.change(doc1, commitMessage, deltaFunction);        
    }

    merger.hasLocalChanges = function() { return hasLocalChanges; }

    merger.makeSyncMessage = function() {
        hasLocalChanges = false;
        const [newSyncState, syncMessage] = Automerge.generateSyncMessage(newDoc, localSyncState);
        localSyncState = newSyncState;
        return syncMessage;
    }

    return merger;
}

try {
    module.exports = exports = { setupMerge };
} catch (e) {}



// In animation loop / event handler. Pack up the latest and greatest to share.
/*
if (merger.hasLocalChanges()) {
    let payload = merger.makeSyncMessage();

    (new Message('merge', payload)).sendWith(socket);
}
*/

/*

/// Early
const merger = setupMerge(defaultScene);

// Later, in event handler...
merger.addClient(actorID);

function changeNodeColor(nodeKey, color) {
    return (doc) => { doc.nodes[nodeKey] = color; };
}


merger.applyChange('make it blue', changeNodeColor('myNode', 'blue'));
*/