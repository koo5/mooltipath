"use strict";

const w = require('./w.js');


/* a list of byte arrays. Serves as a buffer for stdin data that come to us through a callback, which we have little control over. We should also have another list for a cache of transmitted messages, to be used to look up past chunks that the receiving end missed and is requesting.*/
const chunks = [];

/* id for the next message that will be transmitted (unless it will be a re-transmit) */
var next_msg_id = 0;

/* list of processess on the remote machine that we spawned. We can write messages into their stdin */
let drains = [];

/* id of the drain that was last used. We try to round-robbin them. */
var current_drain_id = 0;



/* "mooltipath join" process on the receiving machine */
var joiner;


/* additional fifo's on the receiving machine */
const fifo_paths = [
//	'/tmp/mooltipath_stream1',
//	'/tmp/mooltipath_stream2',
];

/* a list of commands for writing to additional fifos on the receiving machine */
const fifo_commands = fifo_paths.map(p => `ssh localhost cat > "${p}"`);



//const receiver_command = ("wc -c")
const receiver_command = ("cat > ~/cacat")


const join_command = w.shlex.split("ssh localhost mooltipath join")
//const join_command = w.shlex.split("ssh localhost NODE_ENV=production node --prof /home/koom/mooltipath/main.js join")
//const join_command = w.shlex.split("cat");


w.program
	.command('send')
	/*
	receiver_command should be an option.
	ssh commands for fifo_commands should be an option
	*/
	.action(() =>
	{
		joiner = w.spawn(join_command);
		
		/* currently, commands always go straight to the master process. But convievably, they could be sent in parallell through the other streams too. This may be helpful when the original ssh connection is severed*/
		send_cmd({'cmd':'spawn_receiver','args':receiver_command});
		drains.push(joiner);
		fifo_paths.forEach(p =>
		{
			send_cmd({'cmd':'add_pipe','args':p});
		});
		
		let named_fifo_writers_procs = fifo_commands.map(c => w.spawn(w.shlex.split(c)));
		
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
			/* when there is an empty drain, resume data intake */
			p.stdin.on('drain', () =>
			{
				process.stdin.resume();
			});
		});

		process.stdin.on('data', data =>
		{
			//w.d(`I got some ${data.length} bytes`);
			chunks.push({'id': next_msg_id++, 'data': data});
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
	cmd.id = next_msg_id++;
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
	//const msg = {'id': ch.id, 'data': ch.data.slice(0,65480)};
	//const msg = {'id': ch.id, 'data': ch.data.slice(0,65481)};
	//const msg = {'id': ch.id, 'data': ch.data.slice(0,6580)};
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

