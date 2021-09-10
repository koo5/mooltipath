

const SortedList = require('sortedlist');
const w = require('./w.js');


var chunks = new SortedList({compare(a,b){return a.id - b.id}});
var next_chunk_id = 0;



w.program
	.command('join')
	.option('-p, --pipes [pipes...]', 'pipes to read')
	.option('-c, --command <string>', 'command to run')
	.action(({pipes, command}) =>
	{
		console.debug(`command: ${command}`);

		receiver = w.spawn(w.shlex.split(command));

		console.debug('pipes:');
		console.debug(pipes);

		const sources = pipes.forEach((p) =>
		{
			const stream = w.fs.createReadStream(p);
			const decoder = new w.cbor.Decoder();
			stream.pipe(decoder);
			const source = {fn:p,buffer:[]}

			process.stdin.on('decoder', () =>
			{
				console.log(`This is the end of decoder.`);
				sources.splice(sources.indexOf(source), 1);
				if (sources.length < 1)
					receiver.stdin.end();
			});

			decoder.on('error', function(err) {
    			console.error(err);
  			});
			decoder.on('data', (d) =>
			{
				const chunk_id = d.id;
				console.log(chunk_id);
				chunks.insertOne(d);
				try_pop();
			})
			return source;
		});
		console.log(`command: ${command}`);
	});

function try_pop()
{
	if (chunks.length === 0)
		return;
	var d = chunks[0];
	while (d && next_chunk_id === d.id)
	{
		chunks.shift();
		receiver.stdin.write(d.data)
		next_chunk_id += 1;
		d = chunks[0];
	}
	if (chunks.length > 5)
		console.warn(`still waiting for chunk ${next_chunk_id}..`);
}
