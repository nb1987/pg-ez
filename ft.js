

const db = require('./index.js')('postgresql://postgres:Munoknam123$@localhost:5432/mydb');
const JSONStream = require('JSONStream');


// methods:

// exec - nearly identical to query()
// stream 
// transaction 

// pg-ez -- node-postgres made easy. 


// querying 
var query = 'SELECT $1 AS first_name, $2::VARCHAR AS last_name, $3::INT AS age', 
	params =  ['Peter', 'Gibbons', 32];
	
// async / await
(async () => {
	try {
		debugger;
		const result = await db.exec(query, params);
		debugger;
		console.log(result.rows);
	} catch (err) {
		debugger;
		console.error('ERR: ' + err);
	}
})();

// promise
db.exec(query, params)
	.then(result => {
		console.log(result.rows);
	})
	.catch(err => {
		console.error('ERR: ' + err);
	});
	
// callback 
db.exec(query, params, (err, result) => {
	if (err) console.error('ERR: ' + err);
	else console.log(result.rows);
});




// transactions

// transactions are handled intuitively: 
// simply wrap all your desired statements within a transaction() block 
// transaction returns a promise, so you can do follow-up processing with then() , or 
// you can use await if it's wrapped in an async function 
// and any errors will automatically trigger a rollback, but you can also attach a catch() 
// to do additional handling 

// async 
(async () => {
	console.log('before');
	try {
		await	db.transaction(async (client) => {
			await client.query('INSERT INTO web_user VALUES ($1, $2)', [1, 'Peter_Gibbons']);
			await client.query('INSERT INTO web_user_permission VALUES ($1, $2)', ['app:data:update']);
		});
	} catch (err) {
		console.log('ERR: ' + err);
	}
	console.log('after');
})();

// promise
db.transaction(async (client) => {
	debugger;
	await client.exec('INSERT INTO web_user VALUES ($1, $2)', [1, 'Peter_Gibbons']);
	await client.exec('INSERT INTO web_user_permission VALUES ($1, $2)', ['app:data:update']);
})
.then(function() {
	console.log('Done!');
})
.catch(function(err) {
	console.log('ERR: ' + err);
});




// streaming

// when you stream data, the expectation is that you want to stream that data to some destination, whether it be 
// to an HTTP response, to a file, to standard output, or to some transform stream. 

const fs = require('fs');
const file = fs.createWriteStream('query-output.txt');

var Writable = require('stream').Writable;

var memStore = { };

// The stream method returns a Node promise, not stream; however, 
// the promise object has a pipe method defined on it, 
// allowing you to 
db.stream({text: 'SELECT * FROM generate_series(0, $1) num', values: [10], rowMode: 'array'})
	.pipe(JSONStream.stringify())
	.pipe(process.stdin)
	.then(() => {
		var firstChunk = process.stdin.read();
		console.log(firstChunk);
	})
	.catch(err => {
		console.error('ERR: ' + err);
	});

/*
// pipe to file 
const fs = require('fs');
const file = fs.createWriteStream('query-output.txt');
db.stream('SELECT * FROM generate_series(0, $1) num', [1000000]).to(file).on('finish', () => {
	
});

// pipe to http server response 
const http = require('http');
const server = http.createServer((req, res) => {
	db.stream('SELECT * FROM generate_series(0, $1) num', [1000000]).to(res);
}).listen(1337);

db.stream('SELECT * FROM generate_series(0, $1) num', [1000000], function(data) {
	
});
*/