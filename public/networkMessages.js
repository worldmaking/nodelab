
/**
 * Common structure for sending
 */
class Message {
    /** @type {string} */
    cmd;

    val;

    /**
     * 
     * @param {string} command
     * @param {any} value 
     */
    constructor (command, value) {
        this.cmd = command;
        this.val = value;
    }

    /** 
     * Converts this message to a serialized form of data to send over a socket.
     * Centralized in one place so we can swap from JSON to binary if needed in future.
     */
    #serialize() {
        return JSON.stringify(this);
    }

    /**
     * Serializes this message and sends it over the provided web socket (client or server).
     * @param {WebSocket|ws} socket 
     */
    sendWith (socket) {        
        socket.send(this.#serialize());
    }

    /**
     * Serializes this message (once) and sends a copy of it to all clients in the collection.
     * @param {*} clients An array of client objects with a 'socket' field to send messages to.
     */
    sendToAll (clients) {
        const serialized = this.#serialize();
        clients.forEach(c => c.socket.send(serialized));
    }
}

/**
 * Plain-Old-Data structure for replicating poses of HMDs and controllers.
 */
class PoseData {
    /** @type {number[]} */
    pos;
    quat = [0, 0, 0, 1];

    /**
     * Constructor for initializing the PoseData with a specific position.
     * @param {number} [x=0] 
     * @param {number} [y=0]
     * @param {number} [z=0]
     */
    constructor (x=0, y=0, z=0) {
        this.pos = [x, y, z];
    }
}

export {Message, PoseData};