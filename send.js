"use strict";


const pipe_commands = [
	'ssh localhost "cat > /tmp/mooltipath_stream1"',
	'ssh localhost "cat > /tmp/mooltipath_stream2"',
];

const join_command = "ssh localhost mooltipath join -p /tmp/mooltipath_stream1 /tmp/mooltipath_stream2 -c wc -c"


const chunks = [];
var next_chunk_id = 0;
let drains = [];
var current_drain_id = 0;
const w = require('./w.js');

w.program
	.command('send')
	.action(() =>
	{
		console.debug('send..');
		w.spawn(w.shlex.split(join_command));

		drains = [w.spawn(w.shlex.split(pipe_commands[0])), w.spawn(w.shlex.split(pipe_commands[1]))];
		drains.forEach((d) =>
		{
			d.on('close', (code) =>
			{
				drains.splice(drains.indexOf(d),1);
				console.debug(`remaining drains: ${drains.length}`);
				if (drains.length === 0)
				{
					console.debug(`done.`);
				}
			});

		});

		process.stdin.on('data', data =>
		{
			console.debug(`I got some ${data.length} bytes`);
			chunks.push({'id': next_chunk_id++, 'data': data});
			if (try_send_chunks() === false)
			{
				console.debug('all drains are busy');
				if (chunks.length > 100000)
				{
					process.stdin.pause();
					drains.forEach((p) =>
					{
						p.once('drain', () =>
						{
							process.stdin.resume();
							try_send_chunks();
						})
					})
				}
			}
		});

		process.stdin.on('close', () =>
		{
			console.debug(`This is the end of stdin.`);
			drains.forEach((p) =>
			{
				//p.stdin.end();
				// not until all chunks are written.
				//p.kill('SIGHUP');
			});
		});
	});


function try_send_chunks()
{
	let ch = chunks.shift();
	while (ch != undefined)
	{
		if (!try_send_chunk(ch))
			return false;
		ch = chunks.shift();
	}
	return true;
}

function try_send_chunk(ch)
{
	if (!try_pick_next_free_drain())
		return false;
	const pipe = current_drain().stdin;
	//pipe.write(JSON.stringify({'id': ch.id, 'size': ch.data.length}))
	//pipe.write(ch.data);

	const msg = {'id': ch.id, 'data': ch.data};
	const bytes = w.cbor.encode(msg);
	pipe.write(bytes);
	//console.debug(`wrote: ${JSON.stringify(msg)}`);
	console.debug(`wrote ${bytes.length} bytes..`);

	return true;
}


function try_pick_next_free_drain()
{
	let tried_pipes = [];
	while (tried_pipes.length < drains.length)
	{
		pick_next_drain();
		const p = current_drain();
		if (!p.writableNeedDrain)
			return true;
		tried_pipes.push(p);
	}
	return false;
}

function pick_next_drain()
{
	current_drain_id += 1;
	if (current_drain_id > drains.length - 1)
		current_drain_id = 0;
}

function current_drain()
{
	return drains[current_drain_id];
}

