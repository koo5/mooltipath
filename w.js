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


function spawn(cmd)
{
	const file = cmd[0];
	const args = cmd.slice(1);
	console.debug(`spawn ${file} with args ${args}`);
	const proc = child_process.spawn(file, args);

	proc.on('close', (code) =>
	{
		console.debug(`child process exited with code ${code}`);
	});

	proc.stdout.on('data', (data) =>
	{
		console.debug(`stdout: ${data}`);
	});

	proc.stderr.on('data', (data) =>
	{
		console.error(`stderr: ${data}`);
	});

	return proc;
}

exports.spawn = spawn;
