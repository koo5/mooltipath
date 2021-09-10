"use strict";

const send = require('./send.js');
const join = require('./join.js');
const w = require('./w.js');


console.debug(`process ${process.pid} here.`);


process.on('exit', (code) => {
  console.debug(`${process.pid} about to exit with code: ${code}`);
});


w.program.parse();

