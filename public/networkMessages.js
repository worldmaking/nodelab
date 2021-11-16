/**
 * Common structure for sending data between client & server.
 * Attempting to centralize any changes that might be needed into one shared file.
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
     * Standard call to deserialize a socket message into a data structure.
     * Centralized in one place so we can change our parsing method if needed.
     * @param {string|ArrayBuffer} data Message data received over a websocket.
     * @returns {Message} (Hopefully) a Message object with cmd and val members.
     */
    static fromData(data) {
        return JSON.parse(data);
    }

    /** 
     * Converts this message to a serialized form of data to send over a socket.
     * Centralized in one place so we can swap from JSON to binary if needed in future.
     * @returns {string} Serialized data that can be sent over a socket.
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

try {
    module.exports = exports = { Message, PoseData };
 } catch (e) {}
 