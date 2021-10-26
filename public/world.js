import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/webxr/VRButton.js';

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

    /** @type {THREE.camera} */
    camera;

    /** @type {THREE.Mesh} */
    floor;

    /** @type {THREE.Group} */
    clientSpace;

    /** @type {THREE.material} */
    defaultMaterial;

    constructor() {
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

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.05,
            100
        );
        camera.position.y = 1.5;
        camera.position.z = 0;
        this.camera = camera;

        // Nest the camera in a local coordinate system that we can move around for teleportation.
        this.clientSpace = new THREE.Group();
        this.clientSpace.add(camera);
        scene.add(this.clientSpace);        

        // Handle resizing the canvas when the window size changes, and adapt to initial size.
        function resize() {
            if (!renderer.xr.isPresenting) {
                renderer.setSize(window.innerWidth, window.innerHeight);
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
            }
        }
        resize();
        window.addEventListener('resize', resize, false);

        // Create a basic material for the floor or other structure.
        const material = new THREE.MeshLambertMaterial();
        this.defaultMaterial = material;

        // Set up an attractive fog in the distance, to obscure harsh cutoff where the geometry ends,
        // and to give some atmospheric perspective, to help with depth perception (esp. in non-VR view).
        const fadeColor = 0x5099c5;
        scene.background = new THREE.Color(fadeColor);
        scene.fog = new THREE.FogExp2(fadeColor, 0.15);

        // Create a floor plane marked with a grid to give local landmarks, so you can tell when you move.
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), material);
        floor.receiveShadow = true;
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);
        this.floor = floor;

        const grid = new THREE.GridHelper(35, 35, 0x333366, 0x666666);
        scene.add(grid);

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

    // TODO: Add functions to handle teleporting client space around.
}

// Export our world class to be used elsewhere.
export { World };