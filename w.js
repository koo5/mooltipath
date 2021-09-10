"use strict";

const JSONStream = require('JSONStream')
const child_process = require('child_process');
const fs = require('fs');
const buffer = require('buffer');
const shlex = require("shlex");
const cbor = require('cbor')
const {Command} = require('commander');
const program = new Command().version('0.0.1');

exports.program = program;
exports.shlex = shlex;
exports.cbor = cbor;
exports.buffer = buffer;
exports.fs = fs;
exports.child_process = child_process;

const child_processess = [];

function spawn(cmd, opts)
{
	if (opts === undefined)
		opts = {};
		
	const file = cmd[0];
	const args = cmd.slice(1);

	const proc = child_process.spawn(file, args, opts);

	console.debug(`spawned ${file} with args ${args} with pid ${proc.pid}`);
	child_processess.push(proc);


	proc.on('close', (code) =>
	{
		child_processess.splice(child_processess.indexOf(proc),1)
		console.debug(`child process ${cmd} (${proc.pid}) exited with code ${code}, remaining subprocessess: ${child_processess.length} `);
	});

	proc.stdout.on('data', (data) =>
	{
		console.debug(`(${proc.pid})stdout: ${data}`);
	});

	proc.stderr.on('data', (data) =>
	{
		console.error(`(${proc.pid})stderr: ${data}`);
	});

	return proc;
}

exports.spawn = spawn;



/*
exports.serialize = cbor.encode;
exports.new_deserializer = ()
{
	return new w.cbor.Decoder()
}
*/

exports.serialize = JSON.stringify;
exports.new_deserializer = () =>
{
	return JSONStream.parse();
}
