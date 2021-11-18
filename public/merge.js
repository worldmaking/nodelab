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

    let syncState = Automerge.initSyncState();

    // pass new changes to here
    let backends= {};
    backends['doc1'] = doc1;

    let hasLocalChanges = false;

    let merger = {};

    merger.addClient = function(actorID) {
        
    }

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

    merger.applyChange = function(commitMessage, deltaFunction) {
        hasLocalChanges = true;
        return Automerge.change(doc1, commitMessage, deltaFunction);
    }

    merger.makeSyncMessage = function() {

        hasLocalChanges = false;
    }

    return merger;
}

try {
    module.exports = exports = { setupMerge };
} catch (e) {}




/*

/// Early
const merger = setupMerge(defaultScene);

// Later, in event handler...
merger.addClient(actorID);

function changeNodeColor(doc, nodeKey, color) {
    doc.nodes[nodeKey].color = color;
}

function makeColourChanger(nodeKey, color) {
    return (doc) => {changeNodeColor(doc, nodeKey, color)};
}

merger.applyChange('make it blue', makeColourChanger('myNode', 'blue'));
*/