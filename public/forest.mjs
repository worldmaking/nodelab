import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { World }    from './world.mjs';
import { MeshSurfaceSampler } from 'https://cdn.skypack.dev/three/examples/jsm/math/MeshSurfaceSampler.js';
import openSimplexNoise from "https://cdn.skypack.dev/open-simplex-noise";
import * as Tone from "https://cdn.skypack.dev/tone";
import {print} from './utility.mjs';
//import * mqtt from 'https://unpkg.com/mqtt/dist/mqtt.min.js';
//import * as mqtt from './mqttshitr.js';
//import { outsider } from './shiftr.js';


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

// shiftr

let outsider = 0;


const client = mqtt.connect(
  "wss://poetryai:605k8jiP5ZQXyMEJ@poetryai.cloud.shiftr.io",
  {
    clientId: "DIGM5520"
  }
);

client.on("connect", function () {
  console.log("connected to Wind!");
  client.subscribe("Wind", outsider);
});

client.on("message", function (topic0, message0) {
  outsider = parseFloat(message0);
  console.log ("float: Wind", outsider);
});


let noise = openSimplexNoise.makeNoise4D(Date.now());

function buildForest(world) {

    const woods = new THREE.Group();
    const fogColor = new THREE.Color(0xffcccc);
    //const fog = new THREE.FogExp2(0xffcccc, 0.02);
    world.scene.add(woods);
    world.scene.background = fogColor;
    //world.scene.fog = new THREE.Fog(fogColor, 0.0025, 20);
    world.scene.fog = new THREE.FogExp2(fogColor, 0.05);
    
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

    // ! ----------------------------------------- APPLES
    // setup shapes for sampled meshes
    const sphereGeometry = new THREE.SphereBufferGeometry(0.1, 6, 6);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: "purple" });
    //const apples = new THREE.InstancedMesh(sphereGeometry,sphereMaterial,20);  // ! <------------------------  apples

    // set array for each point
    let points = [];

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

    function generateTrees() {
        // Go through the position array of the plane and place trees
        for (let x = -5; x < 5; x++) {
            for (let z = -5; z < 5; z++) {
                // Tree Geometry
                let foliageGeo = new THREE.BufferGeometry();
                const count = outsider; // number of triangles
                const positionsArray = new Float32Array(count * 3 * 3); // each traingle will have 3 points each with 3 elements (x,y,z)
                for (let j = 0; j < count * 3 * 3; j++) {
                    positionsArray[j] = Math.random() * 4.4 - 2.2; // position each point between -3 and 3 units
                }
                const positionsAttribute = new THREE.BufferAttribute(positionsArray, 3);
                foliageGeo.setAttribute("position", positionsAttribute); // Combine the positions with the geometry
                const auraMtrl = new THREE.MeshBasicMaterial( { color: 0xffff00, transparent: true, opacity: 0.1 } );
                const auraGeo = new THREE.SphereGeometry( 12, 32, 16 );
                const innerAuraMtrl = new THREE.MeshBasicMaterial( { color: 0xffff00, transparent: true, opacity: 0.3} );
                const innerAuraGeo = new THREE.SphereGeometry( 5, 16, 8 );
              //  moreFoliageGeo.setAttribute("position", positionsAttribute);
            
                // Create the mesh for the tree (foliage and trunk) and position it
                const foliageMesh = new THREE.Mesh(foliageGeo, foliageMtrl);
                const aura = new THREE.Mesh (auraGeo, auraMtrl);
                const innerAura = new THREE.Mesh (innerAuraGeo, innerAuraMtrl);
                const trunkMesh = new THREE.Mesh(trunkGeo, trunkMtrl);
                const bubbleMesh = new THREE.Mesh(bubbleGeometry, bubbleMtrl);

                // !-------------------------> SAMPLED MESHES
                // Generate apples on bubbleMesh using SurfaceSampler.js
                // Initialize sampler
                const sampler = new MeshSurfaceSampler(bubbleMesh).build();
                
                // // setup shapes for sampled meshes
                // const sphereGeometry = new THREE.SphereBufferGeometry(0.1, 6, 6);
                // const sphereMaterial = new THREE.MeshBasicMaterial({ color: "blue" });

                // generate the instances
                // ! Do I need this? It's created above
                const apples = new THREE.InstancedMesh(sphereGeometry,sphereMaterial,20);
                apples.name = "apples"
                //scene.add(apples);

                // dummy vector to store sampled random coordinates
                const tempPosition = new THREE.Vector3();

                // dummy object to generate the matrix of each sphere
                const tempObject = new THREE.Object3D();

                // loop sampled elements
                for (let i = 0; i <10; i++) {
                    // sample random point on the surface of bubbleMesh
                    sampler.sample(tempPosition);
                    // store point coordinates in tempObject
                    tempObject.position.set(tempPosition.x, tempPosition.y, tempPosition.z);

                    //console.log(tempObject.position.x, tempObject.position.y,tempObject.position.z);

                    points.push(new THREE.Vector3(tempObject.position.x, tempObject.position.y,tempObject.position.z));
                    // define a random scale for the instanced apples
                    tempObject.scale.setScalar(Math.random() * 3 + 0.5);
                    // update the matrix and insert it into instancedMesh matrix
                    tempObject.updateMatrix();
                    apples.setMatrixAt(i, tempObject.matrix);
                    
                }	

                // ! -------------------------> SAMPLED MESHES END



                foliageMesh.position.y += 2;
                aura.position.y += 2;
                //innerAura.position.y += 2;
                trunkMesh.position.y -= 3;
                bubbleMesh.position.y = 3;

                bubbleMesh.name = "bubbles";
                bubbleMesh.add(apples);

                // add a frequency property to the foliage of the tree (used for synth made during collision detection)
                foliageMesh.userData.frequency = getRandomInt(300, 1700);
            
                const tree = new THREE.Group();
                tree.add(foliageMesh, aura, trunkMesh, bubbleMesh);
                //tree.add(foliageMesh, aura, innerAura, trunkMesh, bubbleMesh);
                // Create position and normal vectors for the tree based on the plane position
                
                
                // Add the position and normal vectors to the tree
                tree.position.set(10 * (x + Math.random()), 2, 10 * (z + Math.random()));
                
                obstructions.push(tree);
                tree.scale.set(0.45, 0.45, 0.45);
                woods.add(tree);
            }
        }
    }

    let bubbleTime = 0;
    function renderBubble(t, dt) {
        let v3 = new THREE.Vector3();
       // let t = clock.getElapsedTime()*outsider/35;

        let bubbleSpec = {
            speed: 1.0,
            radius: 5.0,
            detail: 2.0
        };      


        bubbleTime += dt * (Math.sin(t) * 0.5 + 1.0) * 2.0;

        bubbleGeometry.userData.nPos.forEach((p, idx) => {
            let leafFluttr = 0.1*Math.sin(outsider + idx)
            let ns = noise(p.x, p.y, p.z, bubbleTime + leafFluttr);
            v3.copy(p).multiplyScalar(bubbleSpec.radius).addScaledVector(p, ns);
            bubblePositions.setXYZ(idx, v3.x, v3.y, v3.z);
        });

        // loop over every nPos element in the array. p = vertex position, idx = vertex index position
       
/*        bubbleGeometry.userData.nPos.forEach((p, idx) => {
            let ns = noise(p.x, p.y, p.z, bubbleTime);
            v3.copy(p).multiplyScalar(bubbleSpec.radius).addScaledVector(p, ns);
            bubblePositions.setXYZ(idx, v3.x, v3.y, v3.z);
        });
        */
        bubbleGeometry.computeVertexNormals();
        bubblePositions.needsUpdate = true;
    }

    let listener = new THREE.AudioListener();
    world.vrCamera.add(listener);

    function makeSynth() {
        return new Tone.Synth({
            oscillator: {
                type: "fattriangle"
            },
            envelope: {
                attack: 2,
                decay: 0.1,
                sustain: 0.5, 
                release: 100
            }
        });
    }

    let sound = new THREE.PositionalAudio(listener);
    Tone.setContext(sound.context);
    let synth = makeSynth();
    sound.setNodeSource(synth);

    let collidedTree = null;
    function updateForest(t, dt) {
        renderBubble(t, dt);

        let newTreeCollision = null;
        const v = new THREE.Vector3();
        for (let tree of woods.children) {
            world.vrCamera.getWorldPosition(v);
            v.sub(tree.position);
            v.y = 0;

            if (v.lengthSq() < 5) {
                newTreeCollision = tree;
            }

            // get the InstancedMesh:
            let bubbles = tree.getObjectByName("apples")
            bubbles.rotation.x += dt* 0.1;
            bubbles.rotation.y += dt* 0.05*0.012345;
            bubbles.rotation.z += dt* 0.05*0.076543;

            bubbles.instanceMatrix.needsUpdate = true;

        }

        if (newTreeCollision != collidedTree) {
            if (collidedTree != null) {
                const {foliage, bubble} = getTreeElements(collidedTree);
                foliage.material = foliageMtrl;
                bubble.material = bubbleMtrl;
            }

            if (newTreeCollision != null) {
                const {foliage, bubble} = getTreeElements(newTreeCollision);
                synth.triggerAttackRelease(
                    foliage.userData.frequency,
                    "2n"
                    );
                    foliage.add(sound);
                foliage.material = synthAvatarMtrl;
                bubble.material = synthTreeMtrl;
            }

            collidedTree = newTreeCollision;
        }    
            if (collidedTree) {
                let outsider = 70;
                const {foliage, bubble} = getTreeElements(collidedTree);
                const position = foliage.geometry.getAttribute("position");
                const amp = 0.05;

                for (let i = 0; i < position.array.length; i += 3) {
                    let noise = openSimplexNoise.makeNoise2D(Date.now());
                const offset =
                    noise(
                        position.array[i] + outsider * 0.0003,
                        position.array[i + 1] + outsider * 0.0003
                    ) *
                    outsider *
                    amp;
                position.array[i + 2] = offset;
            }
            position.needsUpdate = true;
            }
    }

    generateTrees();

    return updateForest;
}

function getTreeElements(tree) {
    const foliage = tree.children[0];
    const bubble = tree.children[2];

    return {foliage, bubble};
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

export {buildForest}