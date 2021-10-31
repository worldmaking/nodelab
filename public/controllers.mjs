import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { World }    from './world.mjs';
import { XRControllerModelFactory } from "https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/webxr/XRControllerModelFactory.min.js"; 


/**
 * Controller handling adapted from WebXR BallShooter example:
 * Constructs visible versions of controllers matching the user's hardware when they're activated.
 * Call during scene setup.
 * @param world {World} world from world.mjs to get access to the client space for tracking controllers.
 */
function initializeControllers(world) {
    // Tracking controller state changes.
    function onSelectStart() {
        this.userData.isSelecting = true;
    }

    function onSelectEnd() {
        this.userData.isSelecting = false;
    }

    function onConnect(event) {
        this.add(buildController(event.data));
    }

    // Added this function to ensure we don't leak memory when repeatedly adding
    // and removing controllers, piling up unused geometry/materials for the selection pointer child.
    function onRemove() {
        let child = this.children[0];
        if (child) {
            this.remove(child);
            child.geometry.dispose();
            child.material.dispose();
        }
    }

    // Wire up left and reight controllers, and add them to the user's local coordinate space
    // so they follow as we teleport around the scene.
    const controller1 = world.renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    controller1.addEventListener('connected', onConnect); 
    controller1.addEventListener('disconnected', onRemove);
    world.clientSpace.add(controller1);

    const controller2 = world.renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    controller2.addEventListener('connected', onConnect);
    controller2.addEventListener('disconnected', onRemove);
    world.clientSpace.add(controller2);

    // The XRControllerModelFactory will automatically fetch controller models
    // that match what the user is holding as closely as possible. The models
    // should be attached to the object returned from getControllerGrip in
    // order to match the orientation of the held device.
    const controllerModelFactory = new XRControllerModelFactory();

    // Load appropriate display model into the "grip" group for each controller,
    // and add them to the user's local coordinate space so they follow as we teleport.
    const controllerGrip1 = world.renderer.xr.getControllerGrip(0);
    controllerGrip1.add(
        controllerModelFactory.createControllerModel(controllerGrip1)
    );
    world.clientSpace.add(controllerGrip1);

    const controllerGrip2 = world.renderer.xr.getControllerGrip(1);
    controllerGrip2.add(
        controllerModelFactory.createControllerModel(controllerGrip2)
    );
    world.clientSpace.add(controllerGrip2);
}

// Set up pointer visuals to match the kind of interaction used by this controller.
// Accepts a data object from an XR Controller "connected" event to match the detected hardware.
function buildController(data) {
    let geometry, material;

    switch (data.targetRayMode) {
        case 'tracked-pointer':
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3)
        );
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3)
        );
        material = new THREE.LineBasicMaterial({
            vertexColors: true,
            blending: THREE.AdditiveBlending,
        });
        return new THREE.Line(geometry, material);

        case 'gaze':
        geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(
            0,
            0,
            -1
        );
        material = new THREE.MeshBasicMaterial({
            opacity: 0.5,
            transparent: true,
        });
        return new THREE.Mesh(geometry, material);
    }
}

export { initializeControllers }