import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { World }    from './world.mjs';
import { colourTripletToHex, print, vectorToString } from './utility.mjs';

/**
 * Pseudo-enum to make magic numbers for indexing hands less magic/more readable.
 */
const HandID = {
    left: 0,
    right: 1,
    /**
     * Converts a hand ID to a sign for mirror-flipping left vs right side geometry.
     * @param {number} handID A value from the HandID pseudo-enum.
     * @returns {number} -1 for left, +1 for right.
     */
    toSideSign: function(handID) {
        return 2 * handID - 1;
    },
    /**
     * Converts a hand ID to the corresponding index to use into the serialized poses array.
     * @param {number} handID A value from the HandID pseudo-enum.
     * @returns {number} 1 for left, 2 for right (head is in index 0).
     */
    toPoseIndex: function(handID) {
        return handID + 1;
    }
}
Object.freeze(HandID);

/**
 * Gets the world space position and orientation of an object 
 * and packs it into a PoseData struct to send to the server.
 * @param {THREE.Object3D} source 
 * @param {PoseData} pose
 */
function packWorldPose(source, pose) {
    let p = new THREE.Vector3();
    source.getWorldPosition(p);
    pose.pos[0] = p.x;
    pose.pos[1] = p.y;
    pose.pos[2] = p.z;

    let q = new THREE.Quaternion();
    source.getWorldQuaternion(q);
    pose.quat[0] = q.x;
    pose.quat[1] = q.y;
    pose.quat[2] = q.z;
    pose.quat[3] = q.w;
}

/**
 * Takes pose data from a network packet and applies it as the
 * local position and orientation of a THREE.js object.
 * 
 * Note that replicas are always at the root level of the scene,
 * so setting their local position is sufficient to set their world position.
 * @param {PoseData} pose The pose data to unpack, including position & orientation.
 * @param {THREE.Object3D} destination The 3D object to transform to match this pose.
 * @param {number} [scale=1] The scale factor for this object.
 */
function unpackLocalPose(pose, destination, scale = 1) {
    if (destination.visible) {
        const p = new THREE.Vector3(pose.pos[0], pose.pos[1], pose.pos[2]);
        destination.position.lerp(p, 0.2);
        const q = new THREE.Quaternion(pose.quat[0], pose.quat[1], pose.quat[2], pose.quat[3]);
        destination.quaternion.slerp(q, 0.2);
    } else {
        destination.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
        destination.quaternion.set(pose.quat[0], pose.quat[1], pose.quat[2], pose.quat[3]);
        destination.visible = true;
    }
    destination.scale.set(scale, scale, scale);
}


/**
 * World object to use in accessing camera, scene, shared primitives, etc.
 * @type {World} */
let world;

/**
 * Local replica to represent the client - visible in 3rd person or when looking down in VR.
 * @type {Replica} */
let clientReplica;

// Load a font that we can use to display user names of other users, 
// and prepare a material to use for text rendering.
const loader = new THREE.FontLoader();
/** @type {THREE.Font} */
let font;
loader.load('fonts/Roboto_Regular.json', function (loadedFont) {
    font = loadedFont;
});
const textMaterial = new THREE.MeshBasicMaterial({color:0x000000});


/**
 * Array of the local user's controller objects - to use for reading pose info.
 * @type {THREE.Object3D[]}
 */
const controllers = [null, null];

// TUning parameters to control the shape of the visible figure.
const HEAD_HEIGHT = 0.35;
const HEAD_WIDTH = 0.24;
const HEAD_LIFT = -0.052;
const HEAD_SETBACK = 0.09;
const NECK_LENGTH = 0.05;
const TORSO_HEIGHT = 0.65;
/**
 * Class representing the visual presentation of a single remote user.
 */
class Replica {    
    /** @type {THREE.Mesh} */
    #head;

    /** @type {THREE.Mesh} */
    #body;

    /** @type {THREE.Group[]} */
    #hands = [null, null];

    /** @type {THREE.TextGeometry} */
    #nameGeo;

    /** @type {THREE.Material} */
    #material = null;

    #displayName;

    #colour;

    /**
     * Create a replica with these user properties.
     * @param {string} displayName Name to display for this replica user.
     * @param {?number} colour Hex code colour to tint this user's avatar. Uses default material if absent.
     */
    constructor(displayName, colour, customAvatar) {
        

        // Use the world default material if we lack a colour for this user.
        let material = world.defaultMaterial;

        // Otherwise, make a custom material for this replica, 
        // and cache it for re-use and cleanup when we're done.
        if (colour) {
            this.#colour = new THREE.Color(colourTripletToHex(colour));
            material = new THREE.MeshLambertMaterial({color: this.#colour});
            this.#material = material;            
        }
        
        this.#head = new THREE.Group();
        world.scene.add(this.#head);
        this.#body = new THREE.Group();
        world.scene.add(this.#body);

        let makeDefaultAvatar = true;

        if(customAvatar){
            makeDefaultAvatar = customAvatar(this.#head,this.#body, material)
        }

        if (makeDefaultAvatar) {
            // Build a "head" object, starting with a box representing the user's VR goggles.
            
            const visor = new THREE.Mesh(world.primitiveGeo.box, material);
            visor.scale.set(0.2, 0.1, 0.12);
            this.#head.add(visor);
        
            // Add to the box a sphere to create a sense of a head/face behind the goggles,
            // and help clarify which direction the goggles are pointing.
            const ball = new THREE.Mesh(world.primitiveGeo.sphere, material);    
            this.#head.add(ball);

            ball.scale.set(HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH);
            ball.position.set(0, HEAD_LIFT, HEAD_SETBACK);
            ball.rotation.set(Math.PI * 0.1, 0, 0);
            ball.castShadow = true;
            

            // Create a box to serve as the torso.
            
            const torso = new THREE.Mesh(world.primitiveGeo.box, material);
            torso.scale.set(0.35, TORSO_HEIGHT, 0.12);
            torso.castShadow = true;
            this.#body.add(torso);
        
        }
        if (displayName) {
            this.#displayName = displayName;
            // Create text to show the user's display name.
            const nameGeo = new THREE.TextGeometry(displayName, {font:font, size: 0.3, height: 0});                
            nameGeo.computeBoundingBox();

            const name = new THREE.Mesh(nameGeo, textMaterial);
            name.rotation.set(0, Math.PI, 0);
            // Position the name so it hovers above the body, centered left-to-right.
            name.position.addScaledVector(nameGeo.boundingBox.min, -0.5);
            name.position.addScaledVector(nameGeo.boundingBox.max, -0.5);
            name.position.y += 1.5;
            name.position.x *= -1.0;
            this.#body.add(name);
            this.#nameGeo = nameGeo;
        }

        this.#head.visible = false;
    }

    static createClientReplica(colour,customAvatar) {
        let replica = new Replica(undefined, colour, customAvatar);
        world.vrCamera.add(replica.#head);
        world.clientSpace.add(replica.#body);
        replica.#head.visible = true;

        return replica;
    }

    getBody(){
        return this.#body;
    }
    /**
     * Call this when a user chances their colour/name to update their appearance.
     * @param userData data structure containing rgb colour and name string.
     */
    updateUserData(userData) {
        this.#material.color = new THREE.Color(colourTripletToHex(userData.rgb));

        if (userData.name != this.#displayName) {
            this.#nameGeo.dispose();
            this.displayName = userData.name;
            const nameGeo = new THREE.TextGeometry(userData.name, {font:font, size: 0.3, height: 0});                
            nameGeo.computeBoundingBox();
        }
    }

    /** Destroys this replica and disposes of its unmanaged assets. */
    dispose() {
        world.scene.remove(this.#head);
        world.scene.remove(this.#body);
        for (let hand of this.#hands) {
            if (hand && hand.parent) world.scene.remove(hand);
        }
        if(this.#nameGeo) this.#nameGeo.dispose();
        
        if (this.#material) this.#material.dispose();
    }

    /**
     * Creates a set of geometry to represent the remote user's hand / controller.
     * @param handID A HandID value to indicate whether to make a left (0) or right (1) hand.
     * @returns {THREE.Group} A group that contains the hand geometry.
     */
    #createHand(handID) {
         // -1 = left, +1 = right to mirror the displayed shape.
        const side = HandID.toSideSign(handID);

        const hand = new THREE.Group();

        // Position and scale a cube to act as the palm/extended fingers of the hand.
        const palm = new THREE.Mesh(world.primitiveGeo.box, this.#material);
        palm.scale.set(0.08, 0.02, 0.16);
        palm.rotation.set(0.3, 0, side * -1);
        palm.position.set(side * 0.02, 0, 0.05);
        hand.add(palm);
    
        // Position and scale another cube jutting out to represent the thumb.
        const thumb = new THREE.Mesh(world.primitiveGeo.box, this.#material);
        thumb.scale.set(0.02, 0.02, 0.08);
        thumb.rotation.set(0, side * 0.5, 0);
        thumb.position.set(side * -0.02, 0.02, 0.08);
        hand.add(thumb);    
    
        // Add the hand to the scene, record it for later reference, and return it.
        world.scene.add(hand);
        this.#hands[handID] = hand;
        return hand;
    }

    /**
     * Replicates pose data for a controller, if present. 
     * Handles creating the visual for the hand if needed, and removing it if the controller is disconnected.
     * @param {number} handId A HandID value to indicate whether to make a left (0) or right (1) hand.
     * @param {?PoseData} poseData The pose information to apply, or undefined if this controller is absent.
     * @param {?number} [scale=1] A scale factor to apply to the hand, if this avatar is scaled.
     */
    #tryReplicateHand(handId, poseData, scale = 1) {
        let hand = this.#hands[handId];

        if (poseData) {           
            // If we have pose data for this hand, display and update it.
            if (!hand) {
                // If we haven't made this hand yet for this avatar, make one "just in time".                
                hand = this.#createHand(handId);
            } else if (!hand.parent) {
                // Otherwise, if we'd hidden the hand, un-hide it.
                world.scene.add(hand);
            }
    
            // Update the hand group's pose with the new server data.
            unpackLocalPose(poseData, hand, scale);    
        } else if (hand && hand.parent) {        
            // Otherwise, if we stopped getting hand pose data,
            // and we're currently showing a hand we made earlier, hide it.
            world.scene.remove(hand);
            hand.visible = false;
        }        
    }

    /**
     * Animates a torso to sit a little below the given head.
     * Called internally when updating a replica pose, and manually for the local client's torso.
     * @param {Object3D} head An object to place the torso below and slightly behind.
     * @param {number} scale A scale value to draw the torso at. Defaults to 1.
     */
    poseBodyFrom(head, scale = 1) {
        const p = new THREE.Vector3();
        const q = new THREE.Quaternion();

        // Get a position below the bottom of the head to represent the location of the neck.
        // This will rotate with the head to help the torso track it better.
        p.set(0, HEAD_LIFT - 0.5 * HEAD_HEIGHT - NECK_LENGTH, HEAD_SETBACK);
        p.multiplyScalar(scale);
        p.applyQuaternion(head.quaternion);
        p.add(head.position);
        p.y -= (TORSO_HEIGHT * 0.5 + 0.02) * scale;
        this.#body.position.copy(p);

        // Create an offset vector from the head pose, pointing toward the back of the head,
        // flatten it into the horizontal plane, and scale it to unit length.
        p.set(0, 0, -1).applyQuaternion(head.quaternion).setComponent(1, 0).normalize();
        // Use this to smoothly rotate the torso, so it stays upright while facing roughly in the gaze direction. 
        q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), p);        
        this.#body.quaternion.slerp(q, 0.01);

        // Shift the body back from the head position, using the offset vector from earlier.
        this.#body.position.addScaledVector(p, -0.03 * scale);        

        this.#body.scale.set(scale, scale, scale);
    }

    /**
     * Applies pose information received from the server to this replica.
     * @param userData Data structure containing a poses array or PoseData, and optional scale factor.
     */
    updatePose(userData) {
        const scale = userData.scale ?? 1;        

        // Position the head.
        unpackLocalPose(userData.poses[0], this.#head, scale);       

        this.poseBodyFrom(this.#head, scale);

        this.#tryReplicateHand(HandID.left, userData.poses[1], scale);
        this.#tryReplicateHand(HandID.right, userData.poses[2], scale);
    }

    getColour() {
        return this.#colour;
    }
}

/** @type {Replica[]} */
let replicas = [];
let customAvatarFunction=undefined;

/**
 * Set up the replication, with a reference to the world it should add replica user avatars into.
 * Call this during initialization, before receiving the list of remote users from the server.
 * @param {World} targetWorld World to use for accessing the scene, camera, shared primitives/materials.
 */
function initializeReplication(targetWorld, clientColour, customAvatar) {
    world = targetWorld;
    customAvatarFunction=customAvatar;
    controllers[HandID.left] = world.renderer.xr.getController(HandID.left); 
    controllers[HandID.right] = world.renderer.xr.getController(HandID.right);

    clientReplica = Replica.createClientReplica(clientColour, customAvatarFunction);
}

/**
 * Call this when a new user joins to create a replica of their avatar to represent them.
 * @param userData A data structure containing the user's id, and user structure with their name and colour.
 */
function createReplicaForUser(id, userData) {
    const replica = new Replica(userData.name, userData.rgb, customAvatarFunction)
    replicas[id] = replica;
}

/**
 * Updates the replica's pose to match the latest data received from the server.
 * Call this inside the animation loop, or when new pose data is received.
 * @param userData 
 */
function replicateUserPose(userData) {
    const replica = replicas[userData.id];
    if (replica) replica.updatePose(userData);
}

/**
 * Logs pose information from a handheld controller to be sent over the network,
 * if such a controller is present. Otherwise it sets the corresponding pose to undefined.
 * @param handID A value of the HandID enum indicating which hand we're trying to read.
 * @param self The "self" data structure from connect.js's "users" structure.
 */
function tryRecordClientHand(handID, self) {
    // First pose is always the HMD, so we need to shift our index.
    const poseIndex = HandID.toPoseIndex(handID);

    if (controllers[handID].children.length > 0) {
        // If we have a controller active (if it has a controller model inserted),
        // update (or create) pose data for that controller.
        let data = self.poses[poseIndex];
        if (!data) {
            self.poses[poseIndex] = data = new PoseData();
        }
        packWorldPose(controllers[handID], data);
    } else {
        // Otherwise, clear out this array index to signal "no such contoller connected".
        self.poses[poseIndex] = undefined;
    }
}

/**
 * Records the local client's pose data into the network data object to be sent to the server,
 * and updates the replicas of remote users to match the latest pose data received.
 * Call this in the animation loop so that the latest data is always ready/visible.
 * @param self The "self" data structure from connect.js's "users" structure.
 * @param others The "others" data structure from connect.js's "users" structure.
 */
function replicatePoses(self, others) {
    
    // Save our camera/HMD pose to be shared to the server.
    packWorldPose(world.vrCamera, self.volatile.poses[0]);    

    // Likewise, share our controller poses, if we have any active.
    tryRecordClientHand(HandID.left, self.volatile);
    tryRecordClientHand(HandID.right, self.volatile);

    // Update the poses of all replicas to match latest server data.
    for (const other of others) {
        replicateUserPose(other);
    }

    // Pose our local client model according to the "head" pose.
    clientReplica.poseBodyFrom(world.vrCamera);
}

/**
 * Call this function when receiving a "user" message,
 * to configure a newly-joining user (new replica) or update an existing one.
 * @param id 
 * @param userData 
 */
function updateUserReplica(id, userData) {
    const replica = replicas[id];
    if (!replica) {
        createReplicaForUser(id, userData);
    } else {
        replica.updateUserData(userData);
    }
}

/**
 * Removes a user's visible replica from the scene and cleans up its assets.
 * Call this when a user disconnects.
 * @param {string} id Identifier for the user to be removed.
 */
function disposeUserReplica(id) {
    const replica = replicas[id];
    if (replica) {
        replica.dispose();
        delete replicas[id];
    }
}

function getOwnReplicaBody() {
    return clientReplica.getBody();
}
function getUserReplica(id) {
    return replicas[id];
}

function getOwnReplica() {
    return clientReplica;
}

export {
    initializeReplication,
    updateUserReplica,
    replicatePoses,
    disposeUserReplica,
    getOwnReplicaBody,
    getOwnReplica,
    getUserReplica
}