"use strict";

const SortedList = require('sortedlist');
const w = require('./w.js');


var chunks = new SortedList({compare(a,b){return a.id - b.id}});
var next_chunk_id = 0;
var receiver;


w.program
	.command('join')
	.action(() =>
	{
		const sources = [];
		
		add_message_stream(process.stdin);

		function add_message_stream(readable)
		{

			let decoder = new w.cbor.Decoder();
			const source = {decoder}
			sources.push(source);
			console.debug(`add_message_stream: ${(decoder)}`);
			console.debug(`sources: ${sources.length}`);

			decoder.on('end', () =>
			{
				console.debug(`This is the end of decoder.`);
				sources.splice(sources.indexOf(source), 1);
				console.debug(`sources: ${sources.length}`);
			});

			decoder.on('error', function(err) {
    			console.error(err);
  			});

			decoder.on('data', (d) =>
			{
				const chunk_id = d.id;
				console.debug(`got chunk_id: ${chunk_id}`);
				maybe_process_command(d);
				chunks.insertOne(d);
				try_pop();
			})
			
			readable.pipe(decoder);

		}

	
		function maybe_process_command(d)
		{
			if (d.cmd)
				console.debug(`cmd: ${d.cmd}, args: ${d.args}`);
			if (d.cmd === 'spawn_receiver')
				spawn_receiver(d.args)
			if (d.cmd === 'add_pipe')
				add_unix_named_pipe(d.args)
		}
		
		function add_unix_named_pipe(fn)
		{
			console.debug(`add pipe: ${fn}`);
			const stream = w.fs.createReadStream(fn);
			const decoder = new w.cbor.Decoder();
			stream.pipe(decoder);
			add_message_stream(decoder);
		}

		
	});

function try_pop()
{
	if (chunks.length === 0)
	{
		/*if (sources.length < 1)
			receiver.stdin.end();*/
		return;
	}
	var d = chunks[0];
	while (d && next_chunk_id === d.id)
	{
		chunks.shift();
		if (d.data !== undefined)
			receiver.stdin.write(d.data)
		next_chunk_id += 1;
		d = chunks[0];
	}
	if (chunks.length > 5)
		console.warn(`still waiting for chunk ${next_chunk_id}..`);
}

function spawn_receiver(command)
{
	console.debug(`receiver command: ${command}`);
	receiver = w.spawn(command, {'shell':true});
	receiver.on('close', (code) =>
	{
		console.debug(`${receiver.pid} closed with code ${code}. exiting.`);
		process.exit(code);
	});
}
