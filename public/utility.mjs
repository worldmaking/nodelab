/*
  These snippets are just small utility functions to help with printing data to a div for debugging,
  or generating a random colour hex string for the login form.
*/

/**
 * Converts a vector to a string for debug printing.
 * @param {THREE.Vector3} v Vector to convert.
 * @returns {string} Text represtation of the vector.
 */
function vectorToString(v) {
  return `(${v.x}, ${v.y}, ${v.z})`;
}

// Accumulate text to display.
let toPrint = '';
function print(...params) {
  toPrint += params.join(' ') + '<br/>';
}

// Display the text and clear the buffer for next frame.
function showReadout(readout) {
    readout.innerHTML = toPrint;
    toPrint = '';
}


/**
 * Generates a random colour in hex format.
 * @returns {number} 24-bit number represenging 3 bytes of RGB colour values.
 */
function randomColourHex() {
  const maxVal = 0xFFFFFF;
  const randomNumber = Math.random() * maxVal;         
  return Math.floor(randomNumber);
}

/**
 * Converts a number representing an RGB or RGBA colour into a hexadecimal string.
 * @param {number} colour 
 * @returns {string} Text representation of this number in hexadecimal.
 */
function colourHexToString(colour) {
  return colour.toString(16);
}

/**
 * Unpacks a colour represented by a single 3 or 4-byte number as an array of values 0-1.
 * @param {number} colourHex a number representing a 24-bit RGB colour or 32-bit RGBA colour.
 * @returns {number[]} the colour as an array of RGB(A) values in the range 0-1, in order [R, G, B, (A)].
 */
function colourHexToTriplet(colourHex) {
    const fourBytes = colourHex > 0xFFFFFF;
    const output = fourBytes ? [0, 0, 0, 0] : [0, 0, 0];
    // Detect whether we have a 3 or 4-byte 
    let i =  output.length - 1;
    while(colourHex > 0) {
        const byte = colourHex & 0xFF;
        output[i] = byte/255.0;
        colourHex >>= 8;
        i--;
    }
    return output;
}

/**
 * Packs a triplet of colour values into a single 3-byte number.
 * @param {number[]} triplet an array of RGB values in the range 0-1.
 * @returns {number} a 24-bit unsigned integer representing an RGB colour.
 */
function colourTripletToHex(triplet) {
    let output = 0;
    for (let i = 0; i < 3; i++) {
        output += Math.floor(triplet[2 - i] * 0xFF) << (8 * i);
    }
    return output;
}

export { vectorToString, print, showReadout, randomColourHex, colourHexToString, colourHexToTriplet, colourTripletToHex }