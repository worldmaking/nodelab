// create an array containing 150 objects

let array = [
    { index: 1},
    { index: 2},
    { index: 3},
    { index: 4},
    { index: 5},
    { index: 6},
    { index: 7},
    { index: 8},
    { index: 9}
]

let chunks = 4
// first check if dividing by 4 will give a remainder:
let remainder = array.length % chunks
let remainderChunk;
console.log(remainder)

let chunkedArray = []
if(remainder> 0){
    remStart = array.length - remainder

    remainderChunk = array.splice(remStart, (remStart + remainder))

    let quarter = Math.ceil(array.length / chunks);
    let start = 0
    for(i=0; i<chunks; i++){
        chunkedArray.push(array.splice(start, quarter))
    }
    chunkedArray.push(remainderChunk)
    console.log(chunkedArray, '\nfirst', chunkedArray[0], '\netc...', '\nremainderChunk', remainderChunk)

} else {
    let quarter = Math.ceil(array.length / chunks);
    let start = 0

    let quarter = Math.ceil(array.length / chunks);
    let start = 0
    for(i=0; i<chunks; i++){
        chunkedArray.push(array.splice(start, quarter))
    }
}




