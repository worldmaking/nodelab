// Automerge is accessed in different ways depending on whether we're
// in the server's Node.js environment or the client browser.
let Automerge;
try {
    // Node.js: declare a dependency on the package.
    Automerge = require('automerge');
} catch (e) {
    // Browser: fetch the Automerge reference
    // created for us by automergeBundle.js
    Automerge = window.Automerge;
}

/**
 * Function that applies a modification to a syncrhonized document.
 * @callback DeltaFunction 
 * @param {Object} document The document to be modified. This can be mutated ONLY inside this function.
 */

class Merger {
    
    /** @type {string} Unique identifier for "this" agent, used for attributing changes. */
    actorID;

    /** @type {Object} Internal / back-end representation of the synchronized document. */
    document;

    /** @type {Object} Map of synchronization data for each remote client, indexed by their actor ID. */
    syncStates = {};

    /**
     * Create a new Automerge wrapper for a synchronized document.
     * @param {Object|null} sourceDocument Initial state of the document to be auto-merged.
     * @param {string} [actorID] Optional identifier for "this" agent, used for attributing changes. Auto-generates a unique ID if absent.
     */
    constructor(sourceDocument, actorID) {    

        this.actorID = actorID;

        // make a local automerge "back-end" doc from our document    
        if (sourceDocument) {
            this.document = Automerge.from(sourceDocument, actorID);
        } else {
            this.document = Automerge.init(actorID);
        }   
    }
    
    /**
     * Read the current synchronized document.
     * @returns Current internal document object - treat this as read only. All changes should be made through applyChange().
     */
    getDocument() {
        return this.document;
    }

    /**
     * Set up Automerge to communicate with a new remote agent, tracking synchronization between us and them.
     * @param {string} remoteActorID Unique ID representing this actor, received from that actor.
     */
    addClient(remoteActorID) {
        // Store a new / blank sync state for this actor, so we know our next sync can't assume anything about their relative document state.
        this.syncStates[remoteActorID] = Automerge.initSyncState();
    }

    /**
     * Receive a SyncMessage from a remote actor, and apply its updates to our document.
     * @param {string} syncMessage JSON string representation of sync message as an array of 8-bit numbers like "[128, 255, 0, ...]".
     * @param {string} senderID Unique ID of the actor who sent this sync message, so we can read it in the context of our conversation with that actor.
     * @returns {import('automerge').Patch} Patch data structure representing what has changed about our document following this message.
     */
    handleSyncMessage(syncMessage, senderID) {
        // Decode message into a Uint8 Array.
        // TODO: Receive message in this format natively, for reduced string parsing/transmission overhead.
        const remoteSyncMessage = new Uint8Array(Array.from(syncMessage))        

        // Ask Automerge to apply the sync message to our document.
        const [modifiedDocument, nextSyncState, patch] = Automerge.receiveSyncMessage(
            this.document,
            this.syncStates[senderID],
            remoteSyncMessage,
        ) 

        // Store the updated document state as our new immutable syncrhonized document.
        this.document = modifiedDocument;

        // Update the state of our conversation-tracking with the sender, so we know what
        // replies we might need to send them based on our current relative synchronization.
        this.syncStates[senderID] = nextSyncState;
        
        // Return the deltas applied by this message, so calling code can update the displayed version of the document/scene to match.
        return patch;
    }

    /**
     * Apply a local change to our synchronized document, to later share with other actors.
     * @param {string} commitMessage Message that will be associated with this change.
     * @param {DeltaFunction} deltaFunction Callback of the form doc => { mutate doc } to change the document.
     */
    applyChange(commitMessage, deltaFunction) {
        this.document = Automerge.change(this.document, commitMessage, deltaFunction);        
    }    

    /**
     * Check to see whether we have an update/reply to share with the given actor, and if so, construct the sync message.
     * @param {string} receiverID Unique ID of the actor to receive this message.
     * @returns {import('automerge').SyncMessage|null} Message to send to this recipient, or null if we are already synchronized with this recipient.
     */
    makeSyncMessage(receiverID) {        
        const [newSyncState, syncMessage] = Automerge.generateSyncMessage(this.document, this.syncStates[receiverID]);
        this.syncStates[receiverID] = newSyncState;
        return syncMessage;
    }
}



// Export as a module for Node.js, while treating as plain/non-module js for the client browser environment.
try {
    module.exports = exports = { Merger };
} catch (e) {}