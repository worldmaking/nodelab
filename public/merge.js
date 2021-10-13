// import the Three.js module:
import * as THREE from "https://unpkg.com/three@0.126.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.126.0/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "https://unpkg.com/three@0.126.0/examples/jsm/controls/TransformControls.js";

let project = {};

// usual stuff
// create a renderer with better than default quality:
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
// make it fill the page
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x222322, 1);
renderer.shadowMap.enabled = true;
//renderer.shadowMap.soft = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // default THREE.PCFShadowMap
//renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// create and add the <canvas>
document.body.appendChild(renderer.domElement);
// create a perspective camera
const camera = new THREE.PerspectiveCamera(
  75, // this camera has a 75 degree field of view in the vertical axis
  window.innerWidth / window.innerHeight, // the aspect ratio matches the size of the window
  0.05, // anything less than 5cm from the eye will not be drawn
  100 // anything more than 100m from the eye will not be drawn
);
// position the camera 2m in the Z axis and 1.5m in the Y axis
// the Y axis points up from the ground
// the Z axis point out of the screen toward you
camera.position.y = 1.5;
camera.position.z = 3;
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.y = 1.5;
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

// create the root of a scene graph
const scene = new THREE.Scene();

{
  const hemiLight = new THREE.HemisphereLight(0x999999, 0x333333, 1);
  hemiLight.position.set(10, 10, 10);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(0, 5, 0);
  dirLight.castShadow = true;
  scene.add(dirLight);
  //Set up shadow properties for the light
  dirLight.shadow.mapSize.width = 512; // default
  dirLight.shadow.mapSize.height = 512; // default
  dirLight.shadow.camera.near = 0.5; // default
  dirLight.shadow.camera.far = 20; // default

  const floorPlane = new THREE.PlaneGeometry(30, 30, 30, 30);
  floorPlane.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(
    floorPlane,
    new THREE.ShadowMaterial({
      opacity: 0.5
    })
  );
  floor.castShadow = false;
  floor.receiveShadow = true;
  scene.add(floor);

  const floorGrid = new THREE.PolarGridHelper();
  scene.add(floorGrid);

  const democube = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial()
  );
  democube.position.set(-1, 3, -1);
  democube.castShadow = true;
  scene.add(democube);
}

const control = new TransformControls(camera, renderer.domElement);
scene.add(control);
control.addEventListener("change", function (event) {
  project = world.toJSON();
  console.log("changed");
});

control.addEventListener("dragging-changed", function (event) {
  orbit.enabled = !event.value;
});

window.addEventListener("keydown", function (event) {
  switch (event.keyCode) {
    case 81: // Q
      control.setSpace(control.space === "local" ? "world" : "local");
      break;

    case 16: // Shift
      control.setTranslationSnap(1);
      control.setRotationSnap(THREE.MathUtils.degToRad(15));
      control.setScaleSnap(0.25);
      break;

    case 87: // W
      control.setMode("translate");
      break;

    case 69: // E
      control.setMode("rotate");
      break;

    case 82: // R
      control.setMode("scale");
      break;

    case 67: // C
      const position = currentCamera.position.clone();

      currentCamera = currentCamera.isPerspectiveCamera
        ? cameraOrtho
        : cameraPersp;
      currentCamera.position.copy(position);

      orbit.object = currentCamera;
      control.camera = currentCamera;

      currentCamera.lookAt(orbit.target.x, orbit.target.y, orbit.target.z);
      onWindowResize();
      break;

    case 86: // V
      const randomFoV = Math.random() + 0.1;
      const randomZoom = Math.random() + 0.1;

      cameraPersp.fov = randomFoV * 160;
      cameraOrtho.bottom = -randomFoV * 500;
      cameraOrtho.top = randomFoV * 500;

      cameraPersp.zoom = randomZoom * 5;
      cameraOrtho.zoom = randomZoom * 5;
      onWindowResize();
      break;

    case 187:
    case 107: // +, =, num+
      control.setSize(control.size + 0.1);
      break;

    case 189:
    case 109: // -, _, num-
      control.setSize(Math.max(control.size - 0.1, 0.1));
      break;

    case 88: // X
      control.showX = !control.showX;
      break;

    case 89: // Y
      control.showY = !control.showY;
      break;

    case 90: // Z
      control.showZ = !control.showZ;
      break;

    case 32: // Spacebar
      control.enabled = !control.enabled;
      break;
  }
});

window.addEventListener("keyup", function (event) {
  switch (event.keyCode) {
    case 16: // Shift
      control.setTranslationSnap(null);
      control.setRotationSnap(null);
      control.setScaleSnap(null);
      break;
  }
});

const MAX_USERS = 64;
const usersInstancedMesh = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(0.3, 3),
  new THREE.MeshPhongMaterial({}),
  MAX_USERS
);
usersInstancedMesh.castShadow = true;
scene.add(usersInstancedMesh);

const clock = new THREE.Clock();
function animate() {
  // get current timing:
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();
  orbit.update(dt);

  let { self, others } = app.world;
  document.getElementById("data").textContent =
    "project: " +
    JSON.stringify(project, null, " ") +
    "self: " +
    JSON.stringify(self, null, " ") +
    "\nothers: " +
    JSON.stringify(others, null, " ");

  // update `self` from camera, so that it gets broadcast to others:
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  camera.matrixWorld.decompose(position, rotation, scale);
  self.pos = position.toArray();
  self.quat = rotation.toArray();

  usersInstancedMesh.count = Math.min(others.length, MAX_USERS);
  others.forEach((mate, i) => {
    if (i >= MAX_USERS) return;
    // mat.pos, mate.quat, mat.user.rgb ... TODO
    let mat = new THREE.Matrix4(); // usersInstancedMesh.getMatrixAt(i);
    //console.log(mate)
    mat.compose(
      new THREE.Vector3().fromArray(mate.pos),
      new THREE.Quaternion().fromArray(mate.quat),
      new THREE.Vector3(1, 1, 1)
    );
    usersInstancedMesh.setMatrixAt(i, mat);
    if (mate.user.rgb) {
      usersInstancedMesh.setColorAt(i, new THREE.Color(...mate.user.rgb));
      usersInstancedMesh.instanceColor.needsUpdate = true;
    }
  });
  usersInstancedMesh.instanceMatrix.needsUpdate = true;

  // draw the scene:
  renderer.render(scene, camera);
}
// start!
renderer.setAnimationLoop(animate);

// scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()))
// scene.toJSON()

let world;

//////////////

function cleanup(world) {
  let trash = new Set();

  function cleanupMaterial(material) {
    if (Array.isArray(material)) {
      material.forEach((m) => cleanupMaterial);
    } else if (material.isMaterial) {
      trash.add(material);
      // We have to check if there are any textures on the material
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
          trash.add(value);
        }
      }
      // We also have to check if any uniforms reference textures or arrays of textures
      if (material.uniforms) {
        for (const value of Object.values(material.uniforms)) {
          if (value) {
            const uniformValue = value.value;
            if (
              uniformValue instanceof THREE.Texture ||
              Array.isArray(uniformValue)
            ) {
              trash.add(uniformValue);
            }
          }
        }
      }
    }
  }

  world.parent.remove(world);
  world.traverse((o) => {
    //console.log("traverse", o);
    const { geometry, material } = o;
    if (geometry) {
      trash.add(geometry);
    }
    if (material) {
      // material could be an array
      cleanupMaterial(material);
    }
    if (o.isMesh) trash.add(o);
  });
  //console.log("TRASH", trash);
  for (let o of trash) {
    //console.log(o);
    if (o.dispose) o.dispose();
  }
}

const app = connectToWorld({
  reload_on_disconnect: true, // useful for local dev
  room: "/kitchen",
  url: location.origin.replace(/^http/, "ws"),

  log(msg) {
    document.getElementById("status").textContent = msg;
  },

  onproject(newproject) {
    console.log("received scene", newproject.threejs);

    project = newproject.threejs;

    if (world) cleanup(world);
    world = new THREE.ObjectLoader().parse(newproject.threejs);
    scene.add(world);

    control.attach(world.children[0]);
  }
});