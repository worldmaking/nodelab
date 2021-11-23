let Automerge;
try {
    Automerge = require('automerge');
} catch (e) {
    Automerge = window.Automerge;
}

/**
 * sourceDocument might look like...
 * 
 * sourceDoc = {
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
 * @param {object} sourceDocument initial state of the scene document
 * @returns a merge object containing functions {handleSyncMessage}
 */
function setupMerge(sourceDocument, actorID) {    

    // make a local automerge "back-end" doc from our document
    const backends= {};
    if (sourceDocument) {
        backends.doc1 = Automerge.from(sourceDocument, actorID);
    } else {
        backends.doc1 = Automerge.init(actorID);
    }   
    
    const syncStates = {};

    const merger = {};

    merger.addClient = function(actorID) {               
        syncStates[actorID] = Automerge.initSyncState();
    }

    merger.handleSyncMessage = function(syncMessage, senderID) {
        remoteSyncMessage = new Uint8Array(Array.from(syncMessage))        
        const [nextBackend, nextSyncState, patch] = Automerge.receiveSyncMessage(
            backends.doc1,
            syncStates[senderID],
            remoteSyncMessage,
        ) 
        backends.doc1 = nextBackend;
        syncStates[senderID] = nextSyncState;
        console.log('sync\n','nextBackend', nextBackend, '\n\nnextSyncState', nextSyncState, '\n\npatch', patch)
    }

    merger.applyChange = function(commitMessage, deltaFunction) {
        return Automerge.change(doc1, commitMessage, deltaFunction);        
    }

    merger.hasLocalChanges = function() { return hasLocalChanges; }

    merger.makeSyncMessage = function(receiverID) {        
        const [newSyncState, syncMessage] = Automerge.generateSyncMessage(backends.doc1, syncStates[receiverID]);
        syncStates[receiverID] = newSyncState;
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