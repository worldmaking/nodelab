import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { World }    from './world.mjs';


const woods = new THREE.Group();
let world;
const obstructions = [];


// Foliage
const foliageMtrl = new THREE.MeshBasicMaterial({
    color: 0xff8080,
    wireframe: true
});

// Trunk
const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 6, 10);

const trunkMtrl = new THREE.MeshBasicMaterial({
    color: 0x008080,
    wireframe: false
});

// Bubbles
const bubbleGeometry = new THREE.IcosahedronGeometry(1, 5); // radius, detail (radius changes dynamically in Render function)

const bubbleMtrl = new THREE.MeshPhongMaterial({
    color: 0x008080,
    wireframe: true
});


function buildForest(targetWorld) {
    world = targetWorld;
    world.scene.add(woods);

    generateTrees();
}


function updateForest() {

}

function generateTrees() {
  

    // Go through the position array of the plane and place trees
    for (let x = -5; x < 5; x++) {
        for (let z = -5; z < 5; z++) {
            // Tree Geometry
            let foliageGeo = new THREE.BufferGeometry();
            const count = 50; // number of triangles
            const positionsArray = new Float32Array(count * 3 * 3); // each traingle will have 3 points each with 3 elements (x,y,z)
            for (let j = 0; j < count * 3 * 3; j++) {
                positionsArray[j] = Math.random() * 4.4 - 2.2; // position each point between -3 and 3 units
            }
            const positionsAttribute = new THREE.BufferAttribute(positionsArray, 3);
            foliageGeo.setAttribute("position", positionsAttribute); // Combine the positions with the geometry
        
            // Create the mesh for the tree (foliage and trunk) and position it
            const foliageMesh = new THREE.Mesh(foliageGeo, foliageMtrl);
            const trunkMesh = new THREE.Mesh(trunkGeo, trunkMtrl);
            const bubbleMesh = new THREE.Mesh(bubbleGeometry, bubbleMtrl);
            foliageMesh.position.y += 2;
            trunkMesh.position.y -= 3;
            bubbleMesh.position.y = 3;
            // add a frequency property to the foliage of the tree (used for synth made during collision detection)
            foliageMesh.userData.frequency = getRandomInt(300, 1700);
        
            const tree = new THREE.Group();
            tree.add(foliageMesh, trunkMesh, bubbleMesh);
            // Create position and normal vectors for the tree based on the plane position
            const treePosition = new THREE.Vector3( );
            const treeNormal = new THREE.Vector3(0, 0, 1);
            // Add the position and normal vectors to the tree
            tree.position.set(10 * x, 5, 10 * z);
            const target = treePosition.clone().add(treeNormal.multiplyScalar(10.0));
            //tree.lookAt(target);
            // Rotate the tree and position it to allign with the plane
            //tree.rotation.x = Math.PI / 2;
            //tree.position.z += 5;
            obstructions.push(tree);
            woods.add(tree);
        }
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

export {buildForest, updateForest}