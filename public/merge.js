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
    let syncState = window.Automerge.initSyncState()

    // make a local automerge doc from our scene
    const doc1 = window.Automerge.from(scene);
    const actorID = window.Automerge.getActorId(doc1).toString();
    // pass new changes to here

    let backends= {};
    backends['doc1'] = doc1;


    let merger = {};

    merger.handleSyncMessage = function(message) {
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

    return merger;
}

try {
    module.exports = exports = { setupMerge };
} catch (e) {}