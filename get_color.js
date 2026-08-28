const fs = require('fs');
const buffer = fs.readFileSync('image.png');
// PNG signature: 89 50 4e 47 0d 0a 1a 0a
// Just load it in Jimp or something to get the center pixel color.
