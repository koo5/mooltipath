"use strict";

const w = require('./w.js');


w.d(`process ${process.pid} here.`);
process.on('exit', (code) => {
  w.d(`${process.pid} about to exit with code: ${code}`);
});


setInterval(console.log, 1000);
w.cbor.decodeFirst(w.fs.createReadStream('cb'), {extendedResults:true}, (x) => console.log(x));

