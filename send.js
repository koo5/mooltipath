"use strict";



const chunks = [];
var next_chunk_id = 0;
let drains = [];
var current_drain_id = 0;
const w = require('./w.js');
var joiner;


const fifo_paths = [
//	'/tmp/mooltipath_stream1',
//	'/tmp/mooltipath_stream2',
];

const pipe_commands = fifo_paths.map(p => `ssh localhost cat > "${p}"`);


const receiver_command = ("wc -c")
const join_command = w.shlex.split("ssh localhost mooltipath join")



w.program
	.command('send')
	.action(() =>
	{
		joiner = w.spawn(join_command);
		send_cmd({'cmd':'spawn_receiver','args':receiver_command});
		drains.push(joiner);
		fifo_paths.forEach(p =>
		{
			send_cmd({'cmd':'add_pipe','args':p});
		});
		
		let named_fifo_writers_procs = pipe_commands.map(c => w.spawn(w.shlex.split(c)));
		
		named_fifo_writers_procs.forEach((d) =>
		{
			drains.push(d);
			d.stdin.on('close', (code) =>
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
						p.stdin.once('drain', () =>
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
			console.debug(`This is the end of data piped to sender.`);
			drains.forEach((p) =>
			{
				//p.stdin.end();
				// not until all chunks are written.
				//p.kill('SIGHUP');
			});
		});
	});

function send_cmd(cmd)
{
	cmd.id = next_chunk_id++;

	joiner.stdin.write(w.serialize(cmd), (err) =>
	{
		if (err)
			console.debug(err)
		else
			console.debug(`${JSON.stringify(cmd)} written successfulllly`)
	});
}

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
	const bytes = w.serialize(msg);
	pipe.write(bytes, (err) =>
	{
		if (err)
			console.debug(err)
		else
			console.debug(`${JSON.stringify(bytes.length)} written successfulllly`)
	});


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
		const p = current_drain().stdin;
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

