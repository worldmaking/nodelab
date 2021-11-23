import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { World }    from './world.mjs';
import openSimplexNoise from "https://cdn.skypack.dev/open-simplex-noise";
import {print} from './utility.mjs';

const vshader = `
#include <common>
#include <lights_pars_begin>
varying vec3 vPosition;
varying mat4 vModelMatrix;
varying vec3 vWorldNormal;
varying vec3 vLightIntensity;
void main() {
  vec3 vLightFront;
  vec3 vIndirectFront;
  vec3 objectNormal = normal;
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <lights_lambert_vertex>
  vLightIntensity = vLightFront + ambientLightColor;
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vPosition = position;
  vModelMatrix = modelMatrix;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;
const fshader = `
uniform vec3 u_color;
uniform vec3 u_light_position;
uniform vec3 u_rim_color;
uniform float u_rim_strength;
uniform float u_rim_width;
// Example varyings passed from the vertex shader
varying vec3 vPosition;
varying vec3 vWorldNormal;
varying mat4 vModelMatrix;
varying vec3 vLightIntensity;
void main()
{
  vec3 worldPosition = ( vModelMatrix * vec4( vPosition, 1.0 )).xyz;
  vec3 viewVector = normalize(cameraPosition - worldPosition);
  float rimNdotV =  max(0.0, u_rim_width - clamp(dot(vWorldNormal, viewVector), 0.0, 1.0));
  vec3 rimLight = rimNdotV * u_rim_color * u_rim_strength;
  vec3 color = vLightIntensity * u_color + rimLight;
  gl_FragColor = vec4( color, 1.0 );
}
`;

const woods = new THREE.Group();
let world;
const obstructions = [];
let noise = openSimplexNoise.makeNoise4D(Date.now());

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
let bubblePositions = bubbleGeometry.attributes.position;
{
    let nPos = [];
    let v3 = new THREE.Vector3();


    for (let x = 0; x < bubblePositions.count; x++) {
        v3.fromBufferAttribute(bubblePositions, x).normalize();
        nPos.push(v3.clone());
    }
    // save custom user data about the Object3D
    // in this case, save the position attributes into the npos array
    bubbleGeometry.userData.nPos = nPos;
}

const bubbleMtrl = new THREE.MeshPhongMaterial({
    color: 0x008080,
    wireframe: true
});


// Synth Change
const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib["common"],
    THREE.UniformsLib["lights"]
  ]);
  uniforms.u_color = { value: new THREE.Color(0x00aeae) };
  uniforms.u_light_position = { value: new THREE.Vector3(0, 1, 0) };
  uniforms.u_rim_color = { value: new THREE.Color(0x00aeae) };
  uniforms.u_rim_strength = { value: 15 };
  uniforms.u_rim_width = { value: 3 };
  
  const synthTreeMtrl = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vshader,
    fragmentShader: fshader,
    lights: true,
    wireframe: true
  });
  
  const synthAvatarMtrl = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vshader,
    fragmentShader: fshader,
    lights: true,
    wireframe: false
  });
  

function buildForest(targetWorld) {
    world = targetWorld;
    world.scene.add(woods);

    generateTrees();
}

function getTreeElements(tree) {
    const foliage = tree.children[0];
    const bubble = tree.children[2];

    return {foliage, bubble};
}


let collidedTree = null;

function updateForest(t, dt) {
    renderBubble(t, dt);

    let newTreeCollision = null;
    const v = new THREE.Vector3();
    for (let tree of woods.children) {
        world.vrCamera.getWorldPosition(v);
        v.sub(tree.position);
        v.y = 0;

        if (v.lengthSq() < 0.5) {
            newTreeCollision = tree;
        }
    }

    if (newTreeCollision != collidedTree) {
        if (collidedTree != null) {
            const {foliage, bubble} = getTreeElements(collidedTree);
            foliage.material = foliageMtrl;
            bubble.material = bubbleMtrl;
        }

        if (newTreeCollision != null) {
            const {foliage, bubble} = getTreeElements(newTreeCollision);

            foliage.material = synthAvatarMtrl;
            bubble.material = synthTreeMtrl;
        }

        collidedTree = newTreeCollision;
    }    
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
            tree.position.set(10 * x, 2, 10 * z);
            const target = treePosition.clone().add(treeNormal.multiplyScalar(10.0));
            //tree.lookAt(target);
            // Rotate the tree and position it to allign with the plane
            //tree.rotation.x = Math.PI / 2;
            //tree.position.z += 5;
            obstructions.push(tree);
            tree.scale.set(0.5, 0.5, 0.5);
            woods.add(tree);
        }
    }
}

let bubbleTime = 0;
function renderBubble(t, dt) {
    let v3 = new THREE.Vector3();

    let bubbleSpec = {
        speed: 1.0,
        radius: 5.0,
        detail: 2.0
    };      


    bubbleTime += dt * (Math.sin(t) * 0.5 + 1.0) * 2.0;

    // loop over every nPos element in the array. p = vertex position, idx = vertex index position
    bubbleGeometry.userData.nPos.forEach((p, idx) => {
        let ns = noise(p.x, p.y, p.z, bubbleTime);
        v3.copy(p).multiplyScalar(bubbleSpec.radius).addScaledVector(p, ns);
        bubblePositions.setXYZ(idx, v3.x, v3.y, v3.z);
    });
    bubbleGeometry.computeVertexNormals();
    bubblePositions.needsUpdate = true;
}


function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

export {buildForest, updateForest}