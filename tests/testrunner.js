const exec = require('child_process').exec;
exec('"../node_modules/.bin/tape" ./tests/test-*.js'
	(error, stdout, stderr) => {
		console.log(`${stdout}`);
	});	