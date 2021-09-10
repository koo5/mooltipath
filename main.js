"use strict";

const send = require('./send.js');
const join = require('./join.js');
const w = require('./w.js');


w.d(`process ${process.pid} here.`);


process.on('exit', (code) => {
  w.d(`${process.pid} about to exit with code: ${code}`);
});


w.program.parse();

