import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/controls/OrbitControls.js';
import {vectorToString, print} from './utility.mjs';

/** @type {World} */
let world;
/** @type {OrbitControls} */
let orbit;

// Tuning parameters for movement physics.
let walkSpeed = 2.0;
const UP_VECTOR = new THREE.Vector3(0, 1, 0);
const IDEAL_ZOOM = 6;
const JUMP = 8;
const GRAVITY = -9.8;

// Movement state tracking.
let isFirstPerson = false;
let isOnGround = true;

// Objects for snapping to the floor, and visualizing it.
const raycaster = new THREE.Raycaster();
const boundingBox = new THREE.Box3();
let boxVisualizer;

// Tracks the user's movement direction in world space.
const movementInput = new THREE.Vector3();
let verticalVelocity = 0;
let elevation = 1.5;

// A group to store the current teleport target:
const teleport = new THREE.Group();

function setZoom(d = IDEAL_ZOOM) {
    world.mouseCamera.position
      .sub(orbit.target)
      .normalize()
      .multiplyScalar(d)
      .add(orbit.target);
}

const mouse = new THREE.Vector2();
const mouseButtons = [0,0,0];


function updateMouseButtons (event) {

    for (let i = 0; i < 3; i++) {
        mouseButtons[i] = (event.buttons & (1 << i));
    }
}
document.body.addEventListener('mousedown', updateMouseButtons);
document.body.addEventListener('mouseup', updateMouseButtons);

// Track mouse movements for mouse picking in non-VR.
document.addEventListener('mousemove', function (event) {
    // Normalize coordinates from -1 on the bottom/left to +1 at the top/right,
    // with (0, 0) in the center of the canvas.
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Catch mouse buttons that were pressed/released outside the window.
    updateMouseButtons(event);
});


// Maintain a depressed (1) or up (0) state for each keyboard key.
const keyPressed = {
    KeyW: 0,
    KeyA: 0,
    KeyS: 0,
    KeyD: 0,
    Space: 0,
    ShiftLeft: 0,
    ShiftRight: 0,
};
document.body.addEventListener('keydown', function (event) {
    keyPressed[event.code] = 1;
});

document.body.addEventListener('keyup', function (event) {
    keyPressed[event.code] = 0;
    // mode selector
    if (event.code == 'Digit1') {
        isFirstPerson = true;
    } else if (event.code == 'Digit3') {
        isFirstPerson = false;
        setZoom();
    }
});

/**
 * Sets up mouse & keyboard controls.
 * @param {World} newWorld World object to attach control behaviours to.
 */
function initializeControls(newWorld) {
    world = newWorld;
    orbit = new OrbitControls(world.mouseCamera, world.renderer.domElement);

    world.scene.add(teleport);
    boxVisualizer = new THREE.BoxHelper(world.scene, 0xffffff);
    world.scene.add(boxVisualizer);
    elevation = world.playerHeight;        
}


function positionChanged() {
    world.vrCamera.updateMatrixWorld();

    world.mouseCamera.position.sub(orbit.target);
    
    world.vrCamera.getWorldPosition(orbit.target);

    world.mouseCamera.position.add(orbit.target);    
}

/**
 * Call this once per frame when moving the 
 * @param {number} dt Seconds elapsed since the last control update.
 */
function updateControls(dt) {   

    // Get the horizontal rotation of the orbit perspective, between -PI and +PI.
    const angle = orbit.getAzimuthalAngle();

    // Move the player.
    // (Can't change WASD motion while falling/jumping!)
    if (isOnGround) {
      movementInput.set(
        keyPressed.KeyD - keyPressed.KeyA,
        0,
        keyPressed.KeyS - keyPressed.KeyW
      );
      // Ensure that diagonal movement is not faster than orthogonal.
      movementInput.clampLength(0, 1);

      // Rotate by view angle.
      movementInput.applyAxisAngle(UP_VECTOR, angle);
    }
    world.clientSpace.position.addScaledVector(movementInput, walkSpeed * dt);

    // Head always follows camera view:
    const q = world.clientSpace.quaternion.clone();
    q.invert();
    q.multiply(world.mouseCamera.quaternion);
    world.vrCamera.quaternion.copy(q);

    // Did we fall to oblivion?
    if (world.clientSpace.position.y < -25) {
      world.teleportClientSpace(new THREE.Vector3(0, 10, 0));
    }

    isOnGround = false;
    let rayPoint = world.clientSpace.position.clone();
    rayPoint.y += elevation;
    raycaster.set(rayPoint, new THREE.Vector3(0, -1, 0));
    raycaster.firstHitOnly = true;
    let intersects = raycaster.intersectObjects(world.walkable);
    if (intersects.length > 0) {
        const is = intersects[0];
        // .distance, .point, .object

        // Adjust our avatar's elevation above clientSpace
        // to account for the change.
        elevation = is.distance;
        boundingBox.setFromObject(is.object);
        boxVisualizer.setFromObject(is.object);
        rayPoint.set(is.point.x, boundingBox.max.y, is.point.z);
        world.clientSpace.position.copy(rayPoint);

        // If player is below this point, lift it up, with a slight easing:
        if (elevation < world.playerHeight) {
            elevation += (world.playerHeight - elevation) * dt;

        isOnGround = (elevation <= world.playerHeight);
      }
    }
    boxVisualizer.visible = isOnGround;

    world.clientSpace.updateMatrixWorld();

    if (isOnGround) {
      // jump
      verticalVelocity = keyPressed.Space * JUMP;
    } else {
      // fall:
      verticalVelocity += GRAVITY * dt;
    }

    elevation += verticalVelocity * dt;    

    world.vrCamera.position.set(0, elevation, 0);

    positionChanged();

    if (isFirstPerson) {
        orbit.maxPolarAngle = Math.PI;
        orbit.minDistance = 1e-4;
        orbit.maxDistance = 1e-4;
    } else {
        orbit.maxPolarAngle = Math.PI / 2;
        orbit.minDistance = 1;
        orbit.maxDistance = 20;
    }
    orbit.update(dt);
}

export { mouse, initializeControls, updateControls }