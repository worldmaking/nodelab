import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/controls/OrbitControls.js';
//import {vectorToString, print} from './utility.mjs';

/** @type {World} */
let world;
/** @type {OrbitControls} */
let orbit;

// Tuning parameters for movement physics.
let walkSpeed = 3.0;
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



// Updates zoom when changing control schemes.
function setZoom(d = IDEAL_ZOOM) {
    world.mouseCamera.position
      .sub(orbit.target)
      .normalize()
      .multiplyScalar(d)
      .add(orbit.target);
}

// Track mouse for raycasting & teleportation.
const mouse = new THREE.Vector2();
const mouseButtons = [0,0,0];
function updateMouseButtons (event) {
    // Update states of all mouse buttons, stored in bitmask.
    for (let i = 0; i < 3; i++) {
        mouseButtons[i] = (event.buttons & (1 << i));
    }
}
document.body.addEventListener('pointerdown', updateMouseButtons);
document.body.addEventListener('pointerup', updateMouseButtons);
document.addEventListener('pointermove', function (event) {
    // Normalize coordinates from -1 on the bottom/left to +1 at the top/right,
    // with (0, 0) in the center of the canvas.
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Catch mouse buttons that were pressed/released outside the window.
    updateMouseButtons(event);
});
document.addEventListener('dblclick', function (event) {
    if (!world.renderer.xr.isPrsenting) {
        world.tryTeleportToTarget();
        world.vrCamera.getWorldPosition(orbit.target);
    }
});


// Maintain a depressed (1) or up (0) state for each keyboard key.
const keyPressed = {
    KeyW: 0,
    KeyA: 0,
    KeyS: 0,
    KeyD: 0,
    Space: 0,
    ArrowLeft: 0,
    ArrowRight: 0,
    ArrowUp: 0,
    ArrowDown: 0,
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
 * Sets up mouse & keyboard controls. Call this before entering animation loop.
 * @param {World} newWorld World object to attach control behaviours to.
 */
function initializeControls(newWorld) {
    world = newWorld;
    orbit = new OrbitControls(world.mouseCamera, world.renderer.domElement);
    
    boxVisualizer = new THREE.BoxHelper(world.scene, 0xffffff);
    world.scene.add(boxVisualizer);
    elevation = world.playerHeight;        
}

function enableOrbit(b) {
    if (orbit) orbit.enabled = b;
}


// Updates the camera to follow any changes in the avatar position.
// And ensures the avatar's head is always the center of rotation.
function positionChanged() {
    world.clientSpace.updateMatrixWorld();
    world.vrCamera.updateMatrixWorld();

    world.mouseCamera.position.sub(orbit.target);
    
    world.vrCamera.getWorldPosition(orbit.target);

    world.mouseCamera.position.add(orbit.target);    
}

/**
 * Call this once per frame when using non-VR.
 * @param {number} dt Seconds elapsed since the last control update.
 */
function updateControls(dt) {  
    // Enforce a maximum time step to avoid falling through floor when out of focus.
    dt = Math.min(dt, 0.1); 

    dt = Math.min(dt, 0.1);
    
    // Get the horizontal rotation of the orbit perspective, between -PI and +PI.
    const angle = orbit.getAzimuthalAngle();

    // Move the player.
    // (Can't change WASD motion while falling/jumping!)
    if (isOnGround) {
      movementInput.set(
        (keyPressed.KeyD - keyPressed.KeyA) + (keyPressed.ArrowRight - keyPressed.ArrowLeft),
        0,
        (keyPressed.KeyS - keyPressed.KeyW) + (keyPressed.ArrowDown - keyPressed.ArrowUp)
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
    world.vrCamera.quaternion.slerp(q, 5 * dt);

    // Did we fall to oblivion?
    if (world.clientSpace.position.y + elevation < -25) {
      world.teleportClientSpace(new THREE.Vector3(0, 10, 0));
    }

    // Update grounded state by scanning for a walkable surface under the avatar.
    isOnGround = false;
    let rayPoint = world.clientSpace.position.clone();
    rayPoint.y += elevation;
    raycaster.set(rayPoint, new THREE.Vector3(0, -1, 0));
    raycaster.firstHitOnly = true;
    let intersects = raycaster.intersectObjects(world.walkable);
    if (intersects.length > 0) {
        const is = intersects[0];
        // .distance, .point, .object

        // Snap client space to be standing on this intersected surface.
        boundingBox.setFromObject(is.object);
        boxVisualizer.setFromObject(is.object);
        rayPoint.set(is.point.x, boundingBox.max.y, is.point.z);
        world.clientSpace.position.copy(rayPoint);

        // Adjust our avatar's elevation above clientSpace
        // to account for the change.
        elevation = is.distance;
        // If player is below this point, lift it up, with a slight easing:
        if (elevation < world.playerHeight) {
            elevation += (world.playerHeight - elevation) * dt;

        isOnGround = (elevation <= world.playerHeight);
      }
    }
    boxVisualizer.visible = isOnGround;

    // Handle velocity impulse when jumping, 
    if (isOnGround) {
      // Jump if pressed, otherwise cancel vertical velocity to land.
      verticalVelocity = keyPressed.Space * JUMP;
    } else {
      // Fall, with terminal velocity.
      const terminalVelocity = -30;
      verticalVelocity = Math.max(verticalVelocity + GRAVITY * dt, terminalVelocity);
    }

    // Rise or fall with our velocity, and set the avatar head to match.
    elevation += verticalVelocity * dt;    
    world.vrCamera.position.set(0, elevation, 0);

    // Update the orbit controls with our latest position.
    positionChanged();

    // Switch orbit control limits based on current perspective setting.
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

    world.updateTeleportTargetFromMouse(mouse);
}

export { mouse, mouseButtons, initializeControls, updateControls, enableOrbit }