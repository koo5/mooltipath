"use strict";

const w = require('./w.js');


w.d(`process ${process.pid} here.`);
process.on('exit', (code) => {
  w.d(`${process.pid} about to exit with code: ${code}`);
});


setInterval(console.log, 1000);
w.cbor.decodeFirst(w.fs.createReadStream('cb'), {extendedResults:true}, (x) => console.log(x));






/*
// This will wait until we know the readable stream is actually valid before piping
  readStream.on('open', function () {
    // This just pipes the read stream to the response object (which goes to the client)
    readStream.pipe(res);
  });

// This catches any errors that happen while creating the readable stream (usually invalid names)
  readStream.on('error', function(err) {
    res.end(err);
  });
  
 */

/*
https://gist.github.com/ndelangen/3b2b981a4795e51ef4f8cf583764eb8a








 */
