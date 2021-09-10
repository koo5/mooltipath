"use strict";

const SortedList = require('sortedlist');
const w = require('./w.js');


var chunks = new SortedList({
	compare: (a, b) =>
	{
		return a.id - b.id
	}
});
var next_chunk_id = 0;
var receiver;
const sources = [];

w.program
	.command('join')
	.action(() =>
	{
		
		add_message_stream(process.stdin);
		
		function add_message_stream(readable)
		{
			
			let decoder = w.new_deserializer();
			const source = {stream:decoder}
			sources.push(source);
			w.d(`add_message_stream: ${(decoder)}`);
			w.d(`sources: ${sources.length}`);
			
			decoder.on('end', () =>
			{
				w.d(`This is the end of decoder.`);
				sources.splice(sources.indexOf(source), 1);
				w.d(`sources: ${sources.length}`);
				if (sources.length < 1)
					setInterval(final_flush, 1000);
			});
			
			function final_flush()
			{
				w.d(`final_flush`);
				try_pop();
				if (chunks.length < 1)
					receiver.stdin.end();
			}
			
			decoder.on('error', function (err)
			{
				console.error(err);
			});
			
			decoder.on('data', (d) =>
			{
				const chunk_id = d.id;
				//w.d(`got chunk_id: ${chunk_id}`);
				d.data = json_buffer_serialization_fixup(d.data);
				maybe_process_command(d);
				if (next_chunk_id === d.id)
				{
					if (process_chunk(d))
						try_pop();
					else
						decoder.pause();
				}
				else
				{
					chunks.insertOne(d);
					if (!try_pop())
						decoder.pause();
				}
			})
			
			readable.pipe(decoder);
			
		}
		
		
		function maybe_process_command(d)
		{
			if (d.cmd)
				w.d(`cmd: ${d.cmd}, args: ${d.args}`);
			else
				return;
			if (d.cmd === 'spawn_receiver')
				spawn_receiver(d.args)
			if (d.cmd === 'add_pipe')
				add_unix_named_pipe(d.args)
		}
		
		function add_unix_named_pipe(fn)
		{
			w.d(`add pipe: ${fn}`);
			add_message_stream(w.fs.createReadStream(fn));
		}
		
	});

function try_pop()
{
	//w.d(`try_pop(${JSON.stringify(chunks.length)})`);
	//w.d(`try_pop(${JSON.stringify(chunks)})`);
	//w.d(`next_chunk_id:${JSON.stringify(next_chunk_id)}`);
	
	var d = chunks[0];
	while (d && next_chunk_id === d.id)
	{
		chunks.shift();
		if (!process_chunk(d))
			return false;
		d = chunks[0];
	}
	if (chunks.length > 5)
		console.warn(`still waiting for chunk ${next_chunk_id}..`);
	//w.d(`done try_pop(${JSON.stringify(chunks)})`);
	//w.d(`done try_pop(${JSON.stringify(chunks.length)})`);
	return true;
}

function process_chunk(d)
{
	next_chunk_id += 1;
	if (d.data !== undefined)
		if (!receiver.stdin.write((d.data)))
		{
			w.d('buffer full, take a break..');
			return false;
		}
	return true;
}

function spawn_receiver(command)
{
	w.d(`receiver command: ${command}`);
	receiver = w.spawn([command], {'shell': true});
	receiver.stdin.on('drain', () =>
	{
		unpause_sources();
		try_pop();
	});
	receiver.on('close', (code) =>
	{
		w.d(`${receiver.pid} closed with code ${code}. exiting.`);
		process.exit(code);
	});
}

function unpause_sources()
{
	sources.forEach(({stream}) =>
	{
		stream.resume();
	})

}

function json_buffer_serialization_fixup(d)
{
	if (!d)
		return;
	if (!(d instanceof Buffer))
		d = Buffer.from(d.data);
	return d
	
}
