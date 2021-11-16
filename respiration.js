//original by Eyal. Forked from https://codepen.io/xFlaye/pen/yLoKdJv
//Current working version on codepen here: https://codepen.io/Ka-Vi/pen/XWaqxbj

// import the Three.js module:
import * as THREE from "https://cdn.skypack.dev/three/build/three.module.js";
import { OrbitControls } from "https://cdn.skypack.dev/three/examples/jsm/controls/OrbitControls.js";
import Stats from "https://cdn.skypack.dev/three/examples/jsm/libs/stats.module";
import { GUI } from "https://cdn.skypack.dev/three/examples/jsm/libs/dat.gui.module.js";
import openSimplexNoise from "https://cdn.skypack.dev/open-simplex-noise";
import * as mqqt from "https://unpkg.com/mqtt/dist/mqtt.min.js"; //this looks like an issue!!

//console.clear();
/////// shiftr connect /////////

let outsider = 0;

const client = mqtt.connect(
  "wss://kaviproto:test@kaviproto.cloud.shiftr.io",
  {
    clientId: "clientKavi"
  }
);

client.on("connect", function () {
  console.log("connected!");
  client.subscribe("rsp/1");
  //console.log("rsp/1")
});

client.on("message", function (topic, message) {
  //console.log(topic + ': ' + message.toString());
  outsider = parseFloat(message);
  console.log("heartfloat: ", outsider);
});

// ! add noise elements
let noise = openSimplexNoise.makeNoise4D(Date.now());
let clock = new THREE.Clock();

// add a stats view to the page to monitor performance:
const stats = new Stats();
document.body.appendChild(stats.dom);

// setup Scene
const scene = new THREE.Scene();
// change backround color to red
scene.background = new THREE.Color(0x66ffff);

// setup camera
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.y = 7;
camera.position.z = 15;

// set light params
const light = new THREE.DirectionalLight();
//light.position.set(25, 50, 25);
//light.castShadow = true;
//light.shadow.mapSize.width = 2048; //16384
//light.shadow.mapSize.height = 2048; //16384
//light.shadow.camera.near = 0.5;
//light.shadow.camera.far = 100;
//light.shadow.camera.top = 100;
//light.shadow.camera.bottom = -100;
//light.shadow.camera.left = -100;
//light.shadow.camera.right = 100;
scene.add(light);

// Render setups
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

/*
//ground plane
const phongMaterial = new THREE.MeshPhongMaterial();
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMesh = new THREE.Mesh(groundGeometry, phongMaterial);
groundMesh.rotateX(-Math.PI / 2); // align ground
groundMesh.receiveShadow = true;
scene.add(groundMesh);
*/
// ! Player bubble

console.log("Create bubble");

//const bubbleGeometry = new THREE.SphereBufferGeometry(2,16,16);

let radius = 5;
const bubbleGeometry = new THREE.IcosahedronGeometry(9, 9);

let nPos = [];
let v3 = new THREE.Vector3();
let pos = bubbleGeometry.attributes.position;

for (let x = 0; x < pos.count; x++) {
  v3.fromBufferAttribute(pos, x).normalize();
  nPos.push(v3.clone());
}
// save custom user data about the Object3D
// in this case, save the position attributes into the npos array
bubbleGeometry.userData.nPos = nPos;

const bubbleMat = new THREE.MeshPhongMaterial({ wireframe: true });
const bubbleMesh = new THREE.Mesh(bubbleGeometry, bubbleMat);
bubbleMesh.position.y = 3;

bubbleMesh.castShadow = false;

scene.add(bubbleMesh);

//
function render() {
  // ! WARP BUBBLE ----------------------------------------
  //outsider is the
  let t = clock.getElapsedTime() * 1;

  // loop over every nPos element in the array
  // p is the vertex position
  // idx is the vertex index position
  bubbleGeometry.userData.nPos.forEach((p, idx) => {
    //console.log("p: ",p);

    let ns = noise(p.x, p.y, p.z, t);
    v3.copy(p).multiplyScalar(radius*outsider).addScaledVector(p, ns);
    pos.setXYZ(idx, v3.x, v3.y, v3.z);
  });

  bubbleGeometry.computeVertexNormals();
  pos.needsUpdate = true;

  // update Stats at rendertime
  stats.update();
}

function animate() {
  stats.begin();

  requestAnimationFrame(animate);

  renderer.render(scene, camera);
  controls.update();
  renderer.setAnimationLoop(render);
}

function resize() {
  // do this now and whenever the window is resized()
  window.addEventListener(
    "resize",
    function () {
      // ensure the renderer fills the page, and the camera aspect ratio matches:
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    },
    false
  );
}

// ORBIT CONTROLS (use domElements)
const controls = new OrbitControls(camera, renderer.domElement);
//controls.minDistance = 20;
controls.maxDistance = 1500;
controls.maxPolarAngle = Math.PI / 2;

// Load modules
resize();

animate();
