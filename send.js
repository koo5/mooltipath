"use strict";



var END_IS_NEAR



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


//const receiver_command = ("wc -c")
const receiver_command = ("cat > ~/cacat")

//const join_command = w.shlex.split("ssh localhost mooltipath join")
//const join_command = w.shlex.split("ssh localhost NODE_ENV=production node --prof /home/koom/mooltipath/main.js join")
const join_command = w.shlex.split("cat");


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
				w.d(`remaining drains: ${drains.length}`);
				if (drains.length === 0)
				{
					w.d(`done.`);
				}
			});
		});

		drains.forEach(p =>
		{
			p.stdin.on('drain', () =>
			{
				process.stdin.resume();
			});
		});

		process.stdin.on('data', data =>
		{
			//w.d(`I got some ${data.length} bytes`);
			chunks.push({'id': next_chunk_id++, 'data': data});
			const max = 10;
			if (chunks.length > max)
			{
				w.d(`chunks buffer has more than ${max} items.`);
				//process.stdin.pause();
			}

			if (try_send_chunks() === false)
			{
				w.d('all drains are busy');
				{
					//w.d(`all drains are busy and chunks buffer has more than ${max} items, pausing stdin.`);
					process.stdin.pause();
				}
			}
		});

		process.stdin.on('close', () =>
		{
			w.d(`This is the end of data piped to sender.`);
			setInterval(flush, 1000);
		});
		
		function flush()
		{
			w.d(`sender flush..`);
			if (try_send_chunks())
			{
				w.d(`try_send_chunks ok`);
				w.d(`remaining drains: ${drains.length}`);
				drains.forEach((p) =>
				{
					p.stdin.end();
				});
			}
		}
		
	});



function send_cmd(cmd)
{
	cmd.id = next_chunk_id++;
	w.d(`write: ${JSON.stringify(cmd)}`);
	do_write(joiner.stdin, cmd);
}

function do_write(stream, json)
{
	const bytes = w.serialize(json);
	w.d(`write ${bytes.length} bytes..`);
	return stream.write(bytes, (err) =>
	{
		if (err)
			w.d(err)
		else
			w.d(`${JSON.stringify(bytes.length)} written successfulllly`)
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
	const msg = {'id': ch.id, 'data': ch.data};
	return do_write(pipe, msg);
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
	w.d('no free drains.');
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

