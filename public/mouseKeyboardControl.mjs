import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import {vectorToString, print} from './utility.mjs';

let world;
let walkSpeed = 2.0;

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

/**
 *  Get the direction in worldspace the current mouse position is pointing
 *  @return {THREE.Vector3} Normalized direction in worldspace.
 */
function getMouseDirection() {
    const direction = new THREE.Vector3(mouse.x, mouse.y, 1);
    direction.unproject(world.camera);

    const origin = new THREE.Vector3();
    world.camera.getWorldPosition(origin);
    direction.sub(origin);
    direction.normalize();

    return direction;
}

function directionToSphericalAngles(direction, angles) {    
    angles.x = Math.asin(direction.y);
    angles.y = Math.atan2(-direction.x, -direction.z);
    angles.z = 0;
}


const keyPressed = {};


document.body.addEventListener('keydown', function (event) {
    print('key down: ' + event.code);
    keyPressed[event.code] = true;
});

document.body.addEventListener('keyup', function (event) {
    keyPressed[event.code] = false;
});

function initializeControls(newWorld) {
    world = newWorld;
}


let isDragging = false;
const dragStartAngles = new THREE.Euler();

const pitchLimit = 80 * Math.PI/180;

function updateControls(deltaTime) {
    getMouseDirection();


    if (mouseButtons[2]) {
        if (!isDragging) {
            isDragging = true;

            const direction = getMouseDirection();
            const cameraInverse = world.camera.quaternion.clone();
            cameraInverse.invert();

            direction.applyQuaternion(cameraInverse);
            directionToSphericalAngles(direction, dragStartAngles);
        } else {
            const destinationAngle = new THREE.Euler();
            directionToSphericalAngles(getMouseDirection(), destinationAngle);

            world.camera.rotation.set(Math.max(-pitchLimit, Math.min(pitchLimit, dragStartAngles.x - destinationAngle.x)), 0, 0);
            world.clientSpace.rotation.set(0, dragStartAngles.y - destinationAngle.y, 0);
        }
    } else if (isDragging) {
        isDragging = false;
    }

    const walkInput = new THREE.Vector3();

    if (keyPressed['ArrowLeft'] || keyPressed['KeyA']) walkInput.x--;
    if (keyPressed['ArrowRight'] || keyPressed['KeyD']) walkInput.x++;
    if (keyPressed['ArrowUp'] || keyPressed['KeyW']) walkInput.z--;
    if (keyPressed['ArrowDown'] || keyPressed['KeyS']) walkInput.z++;    

    let scale = deltaTime * walkSpeed;
    const squaredLength = walkInput.lengthSq();
    if (squaredLength > 1) scale /= Math.sqrt(squaredLength);
    walkInput.multiplyScalar(scale);

    world.clientSpace.localToWorld(walkInput);

    world.clientSpace.position.copy(walkInput);
}

export { mouse, initializeControls, updateControls }