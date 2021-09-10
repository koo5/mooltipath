//CHUNK_SIZE_BYTES = 1000000000; // 1GB


pipe_commands = [
	'ssh localhost "cat > /tmp/mooltipath_stream1"',
	'ssh localhost "cat > /tmp/mooltipath_stream2"',
];

// receiver_end = shlex_quote("wc -c");
join_command = 'ssh localhost mooltipath join -p /tmp/mooltipath_stream1 /tmp/mooltipath_stream2 -c /home/koom/x.sh '


chunks = [];
var next_chunk_id = 0;
drains = [];
var current_drain_id = 0;
const w = require('./w.js');

w.program
	.command('send')
	.action(() =>
	{
		console.debug('send..');
		w.spawn(w.shlex.split(join_command));

		drains = [w.spawn(w.shlex.split(pipe_commands[0])), w.spawn(w.shlex.split(pipe_commands[1]))];
		drains.forEach((p) =>
		{

		});

		process.stdin.on('data', data =>
		{
			console.log(`I got some ${data.length} bytes`);
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
			console.log(`This is the end of stdin.`);
			drains.forEach((p) =>
			{
				p.stdin.end();
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
	pipe.write(w.cbor.encode(msg));
	console.info(`wrote: ${JSON.stringify(msg)}`);

	return true;
}


function try_pick_next_free_drain()
{
	tried_pipes = [];
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

