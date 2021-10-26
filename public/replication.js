//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import * as THREE   from 'three';
import { World }    from './world';
import { PoseData } from './networkMessages';

/**
 * Pseudo-enum to make magic numbers for indexing hands less magic/more readable.
 */
const HandID = {
    left: 0,
    right: 1
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
    destination.scale.set(pose.scale, pose.scale, pose.scale);
}


/** @type {World} */
let world;

const controllers = [null, null];


// Load a font that we can use to display user names of other users, 
// and prepare a material to use for text rendering.
const loader = new THREE.FontLoader();
/** @type {THREE.Font} */
let font;
loader.load('fonts/Roboto_Regular.json', function (loadedFont) {
    font = loadedFont;
});
const textMaterial = new THREE.MeshBasicMaterial({color:0x000000});


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

    /**
     * 
     * @param {string} id 
     * @param {string} displayName 
     * @param {?number} colour 
     */
    constructor(id, displayName, colour) {
        

        // Use the world default material if we lack a colour for this user.
        let material = world.defaultMaterial;

        // Otherwise, make a custom material for this replica, 
        // and cache it for re-use and cleanup when we're done.
        if (colour) {
            material = new THREE.MeshLambertMaterial({color: new THREE.Color(rgb)});
            this.#material = material;
        }

         // Build a "head" object, starting with a box representing the user's VR goggles.
         this.#head = new THREE.Mesh(world.primitiveGeo.box, material);
         this.#head.scale.set(0.2, 0.1, 0.12);
     
         // Add to the box a sphere to create a sense of a head/face behind the goggles,
         // and help clarify which direction the goggles are pointing.
         const ball = new THREE.Mesh(world.primitiveGeo.sphere, material);    
         this.#head.add (ball);
         ball.scale.set(1.2, 3.5, 2);
         ball.position.set(0, -0.52, 0.75);
         ball.castShadow = true;
         world.scene.add(this.#head);

         // Create a box to serve as the torso.
        this.#body = new THREE.Mesh(world.primitiveGeo.box, material);
        this.#body.scale.set(0.35, 0.65, 0.12);
        this.#body.castShadow = true;
        world.scene.add(this.#body);

        // Create text to show the user's display name.
        const nameGeo = new THREE.TextGeometry(displayName, {font:font, size: 0.3, height: 0});                
        nameGeo.computeBoundingBox();

        const name = new THREE.Mesh(replica.nameGeo, textMaterial);
        name.rotation.set(0, Math.PI, 0);
        // Position the name so it hovers above the body, centered left-to-right.
        name.position.addScaledVector(replica.nameGeo.boundingBox.min, -0.5);
        name.position.addScaledVector(replica.nameGeo.boundingBox.max, -0.5);
        name.position.y += 1.5;
        name.position.x *= -1.0;
        this.#body.add(name);
        this.#nameGeo = nameGeo;
    }

    /** Destroys this replica and disposes of its unmanaged assets. */
    dispose() {
        this.#head.removeFromParent();
        this.#body.removeFromParent();
        for (let hand of this.#hands) {
            if (hand && hand.parent) hand.removeFromParent();
        }
        
        this.#nameGeo.dispose();
        if (this.#material) this.#material.dispose();
    }

    #createHand(index) {
         // -1 = left, +1 = right to mirror the displayed shape.
        const side = index * 2 - 1;

        const hand = new THREE.Group();

        const palm = new THREE.Mesh(world.primitiveGeo.box, replica.material);
        palm.scale.set(0.08, 0.02, 0.16);
        palm.rotation.set(0.3, 0, side * -1);
        palm.position.set(side * 0.02, 0, 0.05);
        hand.add(palm);
    
        const thumb = new THREE.Mesh(world.primitiveGeo.box, replica.material);
        thumb.scale.set(0.02, 0.02, 0.08);
        thumb.rotation.set(0, side * 0.5, 0);
        thumb.position.set(side * -0.02, 0.02, 0.08);
        hand.add(thumb);    
    
        world.scene.add(hand);

        this.#hands[handIndex] = hand;
        return hand;
    }

    /**
     * 
     * @param {number} handId Integer 0 for left, 1 for right
     * @param {PoseData} poseData 
     */
    #tryReplicateHand(handId, poseData) {
        let hand = this.#hands[handId];

        if (poseData) {           
            // If we have pose data for this hand, display and update it.
            if (!hand) {
                // If we haven't made this hand yet for this avatar, make one "just in time".                
                this.#createHand(handId);
            } else if (!hand.parent) {
                // Otherwise, if we'd hidden the hand, un-hide it.
                hand = world.scene.add(hand);
            }
    
            // Update the hand group's pose with the new server data.
            unpackLocalPose(poseData, hand);          
        } else if (hand && hand.parent) {        
            // Otherwise, if we stopped getting hand pose data,
            // and we're currently showing a hand we made earlier, hide it.
            world.scene.remove(hand);
        }
    }

    updatePose(userData) {

        unpackLocalPose(userData.poses[0], this.#head);

        const p = new THREE.Vector3();
        const q = new THREE.Quaternion();

        // Position the torso under the head and slightly behind.
        // First, create an offset vector from the head pose, pointing toward the back of the head,
        // flatten it into the horizontal plane, and scale it to unit length.
        p.set(0, 0, -1).applyQuaternion(this.head.quaternion).setComponent(1, 0).normalize();
        // Use this to smoothly rotate the torso, so it stays upright while facing roughly in the gaze direction. 
        q.setFromUnitVectors(forward, p);        
        this.#body.quaternion.slerp(q, 0.01);

        // Shift the body down and back from the head position, using the offset vector from earlier.
        this.#head.children[0].getWorldPosition(this.#body.position);
        this.#body.position.y -= 0.6;
        this.#body.position.addScaledVector(p, -0.1);

        this.#tryReplicateHand(HandID.left, userData.poses[1]);
        this.#tryReplicateHand(HandID.right, userData.poses[2]);
    }
}

/** @type {Replica[]} */
let replicas = [];

/**
 * 
 * @param {World} targetWorld 
 */
function initializeReplication(targetWorld) {
    world = targetWorld;
    
    controllers[HandID.left] = world.renderer.xr.getController(HandID.left); 
    controllers[HandID.right] = world.renderer.xr.getController(HandID.right);
}

function createReplicaForUser(userData) {
    const replica = new Replica(userData.id, userData.displayName, userData.rgb)
    replicas[userData.id] = replica;
}

function replicateUserPose(userData) {
    const replica = replicas[userData.id];
    if (replica) replica.updatePose(userData);
}


function tryRecordLocalHand(handIndex, self) {
    // First pose is always the HMD.
    const poseIndex = handIndex + 1;

    if (controllers[handIndex].children.length > 0) {
        let data = self.poses[poseIndex];
        if (!data) {
            self.controllers[handIndex] = data = new PoseData();
        }
        packWorldPose(controllers[handIndex], data);
    } else {
        self.poses[poseIndex] = undefined;
    }
}

function replicatePoses(self, others) {
    
    packWorldPose(world.camera, self.poses[0]);

    for (const handIndex of HandID) {
        tryRecordLocalHand(handIndex);
    }

    for (const other of others) {
        replicateUserPose(other);
    }
}


function disposeReplicaForUser(id) {
    const replica = replicas[id];
    if (replica) {
        replica.dispose();
        delete replicas[id];
    }
}

export {
    PoseData,
    initializeReplication,
    createReplicaForUser,
    replicatePoses,
    disposeReplicaForUser
}