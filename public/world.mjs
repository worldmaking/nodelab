import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/webxr/VRButton.js';
import {print, vectorToString} from './utility.mjs';

// added ramp to floor; expanded plane and gridHelper


/**
 * Bundles up the boilerplate of setting up a THREE.js scene for VR,
 * and packs up the items we want to use most often into a "world" object with type information
 * for easier code completion when accessing it in other modules.
 * 
 * Also responsible for maintaining the user's "client space" zone within the world,
 * tracking how the space of their sensor range in their physical room
 * maps into the virtual scene.
 */ 
class World {
    /** @type {THREE.Clock} */
    clock;

    /** @type {THREE.WebGLRenderer} */
    renderer;

    /** @type {THREE.Scene} */
    scene;

    playerHeight = 1.5;

    /**
     * Camera used for VR view and replication. 
     * @type {THREE.camera} */
    vrCamera;

    /**
     * Camera used for mouse & keyboard use. 
     * @type {THREE.camera} */
    mouseCamera;

    /** @type {THREE.Mesh[]} */
    walkable;

    /** @type {THREE.Group} */
    clientSpace;

    /** @type {THREE.material} */
    defaultMaterial;

    /** @type {THREE.Group}*/
    teleportTarget;

    /** @type {THREE.Raycaster}*/
    raycaster = new THREE.Raycaster();

    constructor(makeLights=true) {
        // Set up basic rendering features.
        this.clock = new THREE.Clock();

        const renderer = new THREE.WebGLRenderer({antialias:true});
        this.renderer = renderer;

        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;

        document.body.appendChild(renderer.domElement);
        document.body.appendChild(VRButton.createButton(renderer));

        // Setup scene and camera.
        const scene = new THREE.Scene();
        this.scene = scene;

        const vrCamera = new THREE.PerspectiveCamera();
        vrCamera.position.set(0, this.playerHeight, 0);
        this.vrCamera = vrCamera;

        // Nest the VR camera in a local coordinate system that we can move around for teleportation.
        this.clientSpace = new THREE.Group();
        this.#addSpaceReticle(this.clientSpace);
        this.clientSpace.add(vrCamera);        
        scene.add(this.clientSpace);        

        // Create a second camera for mouse & keyboard use.
        const mouseCamera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.05,
            100
        );
        mouseCamera.position.set(0, this.playerHeight, 0);
        this.mouseCamera = mouseCamera;
        // This one gets parented to the root of the scene, so it can work with orbit controls.
        scene.add(mouseCamera);

        // Handle resizing the canvas when the window size changes, and adapt to initial size.
        this.#handleResize();
        window.addEventListener('resize', this.#handleResize.bind(this), false);

        // Create a basic material for the floor or other structure.
        const material = new THREE.MeshLambertMaterial();
        this.defaultMaterial = material;

        // ! radial gradient material

        let floorMat = new THREE.ShaderMaterial({
        //let floorMat = new THREE.MeshLambertMaterial({
            uniforms: {
              color1: { value: new THREE.Color(0xffffff)},
              color2: { value: new THREE.Color(0x104A80)},
              ratio: {value: innerWidth / innerHeight}
            },
            // vertexShader: `varying vec2 vUv;
            //   void main(){
            //     vUv = uv;
            //     gl_Position = vec4(position, 1.);
            //   }`,
            //       fragmentShader: `varying vec2 vUv;
            //     uniform vec3 color1;
            //     uniform vec3 color2;
            //     uniform float ratio;
            //     void main(){
            //         vec2 uv = (vUv - 0.5) * vec2(ratio, 1.);
            //       gl_FragColor = vec4( mix( color1, color2, length(uv)), 1. );
            //     }`,
            //     wireframe: true
            // });
            vertexShader: `
                varying vec2 vUv;

                void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color1;
                uniform vec3 color2;
            
                varying vec2 vUv;
                
                void main() {
                
                gl_FragColor = vec4(mix(color1, color2, vUv.y), 1.0);
                }
            `
            });

        // Set up an attractive fog in the distance, to obscure harsh cutoff where the geometry ends,
        // and to give some atmospheric perspective, to help with depth perception (esp. in non-VR view).
        const fadeColor = 0x5099c5;
        scene.background = new THREE.Color(fadeColor);
        scene.fog = new THREE.FogExp2(fadeColor, 0.05);

        // Create a floor plane marked with a grid to give local landmarks, so you can tell when you move.
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(200,200), floorMat);
        floor.receiveShadow = true;
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);
        this.walkable = [floor];

        const grid = new THREE.GridHelper(200,200, 0x333366, 0x666666);
        scene.add(grid);
        
        if (makeLights){

        
            // Add some lights to the scene to distinguish surfaces help see where objects are positioned,
            // using the parallax of their shadow.
            const light = new THREE.HemisphereLight(0xfffcee, 0x202555);
            scene.add(light);

            const directional = new THREE.DirectionalLight(0xfff2dd, 1.0);
            directional.position.set(-1, 7, 0.5);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            directional.castShadow = true;
            scene.add(directional);
        }
        // Add a targeting reticle for teleportation moves.
        // (Used by both mouse & keyboard and VR controls, so might as well centralize it here).
        this.teleportTarget = new THREE.Group();
        this.#addSpaceReticle(this.teleportTarget);        
        this.teleportTarget.visible = false;
        scene.add(this.teleportTarget);        

        // Create primitives geometry for things we'll want to re-use a lot,
        // so we don't have every file making their own wastefully.
        // (In particular, boxes and spheres are currently used by replication.js
        //  to build the user avatars).
        this.primitiveGeo = {         
            box: new THREE.BoxGeometry(),         
            ico: new THREE.IcosahedronGeometry(),         
            sphere: new THREE.SphereGeometry(0.5, 17, 9),
        }
    }

    /**
     * Adds a circular reticle with a "forward" direction to the given object.
     * @param {THREE.Object3D} space Coordinate space object to attach the reticle to.
     */
    #addSpaceReticle(space) {
        space.add(new THREE.PolarGridHelper(1, 16, 1));
        space.add((new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), 1.1, 0x0000ff, 0.2, 0.2)));
    }


    /** Handle resizing the canvas when the window size changes, and adapt to initial size. */
    #handleResize() {                
        if (!this.renderer.xr.isPresenting) {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.mouseCamera.aspect = window.innerWidth / window.innerHeight;
            this.mouseCamera.updateProjectionMatrix();
        }
    }

    /**
     * Rotates client space so that its -z axis points along the provided direction.
     * Rotation is only ever in the horizontal plane.
     * @param {THREE.Vector3} worldDirection Direction in worldspace (not necessarily normalized).
     */
    #rotateClientSpaceToFace(worldDirection) {
        const yaw = Math.atan2(-worldDirection.x, -worldDirection.z);
        this.clientSpace.quaternion.set(0, Math.sin(yaw/2), 0, Math.cos(yaw/2));

        this.teleportTarget.quaternion.copy(this.clientSpace.quaternion);
    }

    /**
     * Get the location where the local client is "standing" in the world.
     * @returns {THREE.Vector3} Position in world space under the camera, at floor height.
     */
     getFootPosition() {
        // Record the position of the camera before the rotation, so we can keep it in exactly the same place.
        const cameraPosition = this.vrCamera.position.clone();
        // Project it down to the floor plane, and convert it to world space.
        cameraPosition.y = 0;
        this.clientSpace.localToWorld(cameraPosition);

        return cameraPosition;
    }

    getHorizontalLookDirection() {
        const direction = new THREE.Vector3();
        this.vrCamera.getWorldDirection(direction);

        direction.normalize();

        return direction;
    }

    /**
     * Moves/rotates the client space to place the camera at a new position/orientation,
     * without interfering with the position/orientation of the camera relative to its sensor
     * coordinate system.
     * @param {THREE.Vector3} floorPositionUnderCamera The desired worldspace location of the user's feet. The camera will teleport to some distance above this.
     * @param {?THREE.Vector3} worldLookDirection The desired worldspace direction the camera should face. Leave this undefined to keep the current orientation.
     */
    teleportClientSpace(floorPositionUnderCamera, worldLookDirection) {
        // Remember where the mouse camera was relative to the clience space.
        const mouseCameraOffset = this.mouseCamera.position.clone();
        this.clientSpace.worldToLocal(mouseCameraOffset);

        if (worldLookDirection) {

            // Get the direction our camera is currently looking 
            // along the horizontal plane, relative to the client space orientation.
            const lookDirection = new THREE.Vector3(0, 0, -1);
            lookDirection.applyQuaternion(this.vrCamera.quaternion);
            lookDirection.y = 0;
            lookDirection.normalize();

            // Compute the horizontal rotation difference between camera's look direction and client forward.
            const forward = new THREE.Vector3(0, 0, -1);
            const rotationOffset = new THREE.Quaternion();
            rotationOffset.setFromUnitVectors(lookDirection, forward);

            // Get the direction we want the camera to look, and shift it by the camera's rotational offset.
            const targetDirection = worldLookDirection.clone();
            targetDirection.applyQuaternion(rotationOffset);
            
            this.#rotateClientSpaceToFace(targetDirection);      
        }   

        // Get the position of the camera within client space, snapped down to floor level.
        const cameraOffset = this.vrCamera.position.clone();
        cameraOffset.y = 0;

        // Transform this position offset into world space.
        cameraOffset.applyQuaternion(this.clientSpace.quaternion);

        // Subtract this offset from our target floor position,
        // to get the position where the client space needs to be for the camera to be above the target.
        cameraOffset.multiplyScalar(-1);
        cameraOffset.add(floorPositionUnderCamera);

        // Apply the teleported position to the client space.
        this.clientSpace.position.copy(cameraOffset);        
        this.clientSpace.updateMatrixWorld();
        this.vrCamera.updateMatrixWorld();

        // Reposition the mosue camera in the same relative position.
        // TODO: also adjust its rotation?
        this.clientSpace.localToWorld(mouseCameraOffset);
        this.mouseCamera.position.copy(mouseCameraOffset);
    }

    /**
     * Rotates client space around the camera position as its pivot.
     * @param {number} radianDelta Angle in radians to rotate counter-clockwise about the vertical axis.
     */
    rotateClientSpace (radianDelta) {
        const cameraPosition = this.getFootPosition();

        // Rotate client space on the y only.
        this.clientSpace.rotation.y += radianDelta;
        this.clientSpace.updateMatrixWorld();

        // Teleport so our camera is back where it was originally.
        this.teleportClientSpace(cameraPosition);
    }

    /**
     * Call this function when leaving VR to reset the clientSpace orientation
     * for mouse & keyboard control. Puts the camera back at a standard height above
     * the origin of client space, with no roll rotation, while preserving the viewpoint.
     */
    handleExitVR() {
        const footPosition = this.getFootPosition();        

        const lookDirection = new THREE.Vector3();
        cameraPosition.getWorldDirection(lookDirection);        

        this.clientSpace.position.set(footPosition);
        this.#rotateClientSpaceToFace(lookDirection);

        this.vrCamera.position.set(0, this.playerHeight, 0);
        this.vrCamera.rotation.z = 0;
    }

    #updateTeleportTargetFromRaycast() {
        //print(`ray origin: ${vectorToString(this.raycaster.ray.origin)}`);
        //print(`ray direction: ${vectorToString(this.raycaster.ray.direction)}`);

        this.raycaster.firstHitOnly = true;
        const hit = this.raycaster.intersectObjects(this.walkable)[0];
        if (hit) {
            //print(`hit: ${vectorToString(hit.point)}`);
            this.teleportTarget.position.copy(hit.point);
            this.teleportTarget.visible = true;
            return hit.position;
        }
        // print(`no hit`);

        this.teleportTarget.visible = false;
        return null;
    }

    updateTeleportTargetFromMouse(mouse) {
        this.raycaster.setFromCamera(mouse, this.mouseCamera);
        return this.#updateTeleportTargetFromRaycast();
    }

    updateTeleportTargetFromRay(origin, direction) {        
        this.raycaster.set(origin, direction);
        return this.#updateTeleportTargetFromRaycast();
    }

    tryTeleportToTarget() {
        if (this.teleportTarget.visible == false)
            return false;
        
        this.teleportClientSpace(this.teleportTarget.position);
        this.cancelTeleport();
        return true;        
    }

    cancelTeleport() {
        this.teleportTarget.visible = false;
    }
}

// Export our world class to be used elsewhere.
export { World };