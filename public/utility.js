/**
 * 
 * @param {number} colourHex 
 * @returns 
 */
function colourHexToTriplet(colourHex) {
    const output = [0,0,0];
    i = 2;
    while(colourHex > 0) {
        const byte = colourHex & 0xFF;
        output[i] = byte/255.0;
        colourHex >>= 8;
        i--;
    }
    return output;
}

function colourTripletToHex(triplet) {
    let output = 0;
    for (let i = 0; i < 3; i++) {
        output += Math.floor(triplet[2 - i] * 0xFF) << (8 * i);
    }
    return output;
}