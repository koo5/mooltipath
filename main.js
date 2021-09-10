CHUNK_SIZE_BYTES = 1000000000; // 1GB


pipe_commands = [
	'ssh localhost mooltipath join stream1',
	'ssh localhost mooltipath join stream1',
];

chunks = [];
var next_chunk_id = 0;
drains = [];
var current_drain_id = 0;

const {spawn} = require('child_process');

const {Command} = require('commander');
const program = new Command();
program.version('0.0.1')
	.command('split')
	.action(() =>
	{

		drains = [create_pipe(), create_pipe()];

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
			drains.forEach((p) => p.stdin.end());
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
	pipe.write(JSON.stringify({'id': ch.id, 'size': ch.data.length}))
	pipe.write(ch.data);
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

function create_pipe(cmd)
{
	const proc = spawn('ssh', ['localhost', 'wc', '-c']);

	proc.on('close', (code) =>
	{
		console.log(`child process exited with code ${code}`);
	});

	proc.stdout.on('data', (data) =>
	{
		console.log(`stdout: ${data}`);
	});

	proc.stderr.on('data', (data) =>
	{
		console.error(`stderr: ${data}`);
	});
	return proc;
}

program.parse();

