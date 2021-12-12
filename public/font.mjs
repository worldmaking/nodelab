import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';

// Load a font that we can use to display user names of other users, 
// and prepare a material to use for text rendering.
const loader = new THREE.FontLoader();
/** @type {THREE.Font} */
let font;
loader.load('fonts/Roboto_Regular.json', function (loadedFont) {
    font = loadedFont;
});

export { font }