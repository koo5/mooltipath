//CHUNK_SIZE_BYTES = 1000000000; // 1GB


pipe_commands = [
	'ssh localhost "mbuffer > /tmp/mooltipath_stream1"',
	'ssh localhost "mbuffer > /tmp/mooltipath_stream2"',
];

// receiver_end = shlex_quote("wc -c");
join_command = 'ssh localhost mooltipath join -p /tmp/mooltipath_stream1 /tmp/mooltipath_stream2 -c /home/koom/x.sh '


chunks = [];
var next_chunk_id = 0;
drains = [];
var current_drain_id = 0;

const child_process = require('child_process');
const fs = require('fs');
const shlex = require("shlex");
const {Command} = require('commander');
const program = new Command().version('0.0.1');

program
	.command('send')
	.action(() =>
	{
		console.debug('send..');
		spawn(shlex.split(join_command));

		drains = [create_pipe(shlex.split(pipe_commands[0])), create_pipe(shlex.split(pipe_commands[1]))];

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


program
	.command('join')
	.option('-p, --pipes [pipes...]', 'pipes to read')
	.option('-c, --command <string>', 'command to run')
	.action(({pipes, command}) =>
	{
		console.debug('pipes:');
		console.debug(pipes);
		pipes.forEach((p) =>
		{
			const s = fs.createReadStream(p);
			s.on('error', function(err) {
    			console.error(err);
  			});
			s.on('data', (d) =>
			{
				console.log(d);
			})
		});
		console.log(`command: ${command}`);
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
	const proc = child_process.spawn(cmd[0], cmd.slice(1));

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

program.parse();

