import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { World }    from './world.mjs';
import { initializeControllers } from './controllers.mjs';

/** @type {World} */
let world;

/** @type {THREE.Group[]} Reference to left (0) and right (1) controller.*/
let controllers;

/** @type {number[]} Last direction pressed on each analog stick: -1 left / 0 center / +1 right.*/
const lastDirection = [0, 0];

/** @type {boolean[]} Last amount of squeeze on each trigger.*/
const lastSqueezed = [false, false];

/** @type {number} Which controller is actively used for pointing/teleporting? -1 = none. */
let activeControllerIndex = -1;

let origin;
let aim;

/** @type {boolean} State of buttons on controller. */
let uiTrigger;

/**
 * Call this to intialize VR controls.
 * @param {World} newWorld World to apply control logic to.
 */
function initializeControls(newWorld) {
    world = newWorld;
    controllers = initializeControllers(world);
}

/**
 * Call this once a frame to handle control logic.
 * @param {number} dt seconds elapsed since previous control update.
 */
function updateControls(dt) {
    // Iterate over each active controller.
    for (let i = 0; i < 2; i++) {
        const controller = controllers[i];
        if (!controller || !controller.visible) continue;

        const source = controller.userData.source;
        if (source && source.gamepad) {
            const gamepad = source.gamepad;

            // Rotation using analog stick.

            // Analog stick x axis.
            const x = gamepad.axes[2];
            // Hysteresis: trigger rotation only when crossing from low to high.
            const threshold = x * lastDirection[i] <= 0 ? 0.6 : 0.3;
            const direction = Math.abs(x) > threshold ? Math.sign(x) : 0;
            if (direction !== lastDirection[i] && direction !== 0) {
                // If we've flicked the stick left/right, rotate our view in that direction.
                world.rotateClientSpace(direction * Math.PI/6);
            }
            // Remember our direction for next frame.
            lastDirection[i] = direction;           


            // If we didn't have an active controller, well, now we do.
            if (activeControllerIndex === -1) {
                activeControllerIndex = i;
            } else if (activeControllerIndex !== i) {
                // Only the active controller gets to point and teleport.
                continue;
            }

            // Aim teleport based on pointing direction.
            origin = new THREE.Vector3();
            controller.getWorldPosition(origin);            
            
            aim = new THREE.Vector3();
            controller.getWorldDirection(aim);
            aim.multiplyScalar(-1);

            world.updateTeleportTargetFromRay(origin, aim);

            const trigger = gamepad.buttons[0].pressed;
            if (trigger && !lastSqueezed[i]) {
                world.tryTeleportToTarget();
            }
            lastSqueezed[i] = trigger;

            if ( i = 1 ) uiTrigger = gamepad.buttons[0].pressed;
        }
    }

    // Reset active controller if the one we were using disappears.
    if (activeControllerIndex >= 0 && (!controllers[activeControllerIndex] || !controllers[activeControllerIndex].visible))
        activeControllerIndex = -1;
}


export { origin, aim, uiTrigger, initializeControls, updateControls }