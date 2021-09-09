CHUNK_SIZE_BYTES = 1000000000; // 1GB

const { spawn } = require('child_process');

const { Command } = require('commander');
const program = new Command();
program.version('0.0.1')
	.command('split')
	.action(() =>
	{
		const proc = spawn('ssh', ['localhost', 'wc', '-c']);

		proc.on('close', (code) => {
		  console.log(`child process exited with code ${code}`);
		});

		proc.stdout.on('data', (data) => {
		  console.log(`stdout: ${data}`);
		});

		proc.stderr.on('data', (data) => {
		  console.error(`stderr: ${data}`);
		});

		current_pipe = proc.stdin;

		process.stdin.on('data', data => {
		  console.log(`I got some ${data.length} bytes`);
		  current_pipe.write(data);
		});

		process.stdin.on('close', () => {
		  console.log(`This is the end of stdin.`);
		  current_pipe.end();
		});


	});




program.
	parse();
