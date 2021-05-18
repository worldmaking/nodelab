const path = require("path")
const express = require("express")

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

console.log("ok")

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));