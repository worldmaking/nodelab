import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { World }    from './world.mjs';
import { PoseData } from './networkMessages.mjs';
import { colourTripletToHex, print, vectorToString } from './utility.mjs';
import { initializeControllers } from './controllers.mjs';

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
    destination.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    destination.quaternion.set(pose.quat[0], pose.quat[1], pose.quat[2], pose.quat[3]);
    destination.scale.set(scale, scale, scale);
}


/**
 * World object to use in accessing camera, scene, shared primitives, etc.
 * @type {World} */
let world;

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

    /**
     * Create a replica with these user properties.
     * @param {string} displayName Name to display for this replica user.
     * @param {?number} colour Hex code colour to tint this user's avatar. Uses default material if absent.
     */
    constructor(displayName, colour) {
        

        // Use the world default material if we lack a colour for this user.
        let material = world.defaultMaterial;

        // Otherwise, make a custom material for this replica, 
        // and cache it for re-use and cleanup when we're done.
        if (colour) {
            material = new THREE.MeshLambertMaterial({color: new THREE.Color(colourTripletToHex(colour))});
            this.#material = material;
        }

         // Build a "head" object, starting with a box representing the user's VR goggles.
         this.#head = new THREE.Group();
         const visor = new THREE.Mesh(world.primitiveGeo.box, material);
         visor.scale.set(0.2, 0.1, 0.12);
         this.#head.add(visor);
     
         // Add to the box a sphere to create a sense of a head/face behind the goggles,
         // and help clarify which direction the goggles are pointing.
         const ball = new THREE.Mesh(world.primitiveGeo.sphere, material);    
         this.#head.add (ball);

         ball.scale.set(0.24, 0.35, 0.24);
         ball.position.set(0, -0.052, 0.09);
         ball.castShadow = true;
         world.scene.add(this.#head);

         // Create a box to serve as the torso.
        this.#body = new THREE.Group();
        const torso = new THREE.Mesh(world.primitiveGeo.box, material);
        torso.scale.set(0.35, 0.65, 0.12);
        torso.castShadow = true;
        this.#body.add(torso);
        world.scene.add(this.#body);

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
        
        this.#nameGeo.dispose();
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
        }
    }

    /**
     * Applies pose information received from the server to this replica.
     * @param userData Data structure containing a poses array or PoseData, and optional scale factor.
     */
    updatePose(userData) {
        const scale = userData.scale ?? 1;        

        // Position the head.
        unpackLocalPose(userData.poses[0], this.#head, scale);

        const p = new THREE.Vector3();
        const q = new THREE.Quaternion();

        // Position the torso under the head and slightly behind.
        // First, create an offset vector from the head pose, pointing toward the back of the head,
        // flatten it into the horizontal plane, and scale it to unit length.
        p.set(0, 0, -1).applyQuaternion(this.#head.quaternion).setComponent(1, 0).normalize();
        // Use this to smoothly rotate the torso, so it stays upright while facing roughly in the gaze direction. 
        q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), p);        
        this.#body.quaternion.slerp(q, 0.01);

        // Shift the body down and back from the head position, using the offset vector from earlier.
        this.#head.children[0].getWorldPosition(this.#body.position);
        this.#body.position.y -= 0.6 * scale;
        this.#body.position.addScaledVector(p, -0.12 * scale);        
        this.#body.scale.set(scale, scale, scale);

        this.#tryReplicateHand(HandID.left, userData.poses[1], scale);
        this.#tryReplicateHand(HandID.right, userData.poses[2], scale);
    }
}

/** @type {Replica[]} */
let replicas = [];

/**
 * Set up the replication, with a reference to the world it should add replica user avatars into.
 * Call this during initialization, before receiving the list of remote users from the server.
 * @param {World} targetWorld World to use for accessing the scene, camera, shared primitives/materials.
 */
function initializeReplication(targetWorld) {
    world = targetWorld;
    
    initializeControllers(world);
    controllers[HandID.left] = world.renderer.xr.getController(HandID.left); 
    controllers[HandID.right] = world.renderer.xr.getController(HandID.right);
}

/**
 * Call this when a new user joins to create a replica of their avatar to represent them.
 * @param userData A data structure containing the user's id, and user structure with their name and colour.
 */
function createReplicaForUser(id, userData) {
    const replica = new Replica(userData.name, userData.rgb)
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

export {
    initializeReplication,
    updateUserReplica,
    replicatePoses,
    disposeUserReplica
}