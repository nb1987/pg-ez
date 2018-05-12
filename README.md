
# pg-ez - node-postgres made easy
[node-postgres](https://github.com/brianc/node-postgres) is not particularly difficult to use and has [a well-documented API](https://node-postgres.com), but as that documentation states, "node-postgres strives to be low level an un-opinionated." pg-ez, on the other hand, strives to be high-level and (more) opinionated, allowing you to get up and querying within seconds rather than minutes. It uses best practices as recommend by node-postgres, so you don't have to concern yourself with things like releasing clients back to a pool. 

## Installation

`npm install pg-ez`

## Testing

`npm test`

The tests test `pg-ez`'s integration with `node-postgres` but run quickly. The tests require you to have defined environment variables for  `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, and `PGDATABASE`.

## Documentation

* Establishing a database connection 
*** Example 1: passing in a connection string
*** Example 2: passing in a connection object
*** Example 3: passing in nothing
* Querying
*** Example 1: using `async` / `await`
*** Example 2: using promises
*** Example 3: using callbacks
* Streaming
** Example 1: streaming JSON transform of results to `http` response
** Example 2: streaming comma-delimited transform of results to CSV file
* Transactions
** Example 1: Using `async` / `await`
** Example 2: Using promises

### Establishing a database connection
Requiring `pg-ez` and establishing a database connection is done in a single line. Like `pg`, you can pass to it a connection string or a connection object; if you pass neither, `pg-ez` will, like `pg`, try to establish a connection using environment variables.

#### Example 1: passing in a connection string
```javascript
const db = require('pg-ez')('postgresql://admin:sekrit@localhost:5432/mydb');
```

#### Example 2: passing in a connection object
```javascript
const db = require('pg-ez')({user: 'admin', password: 'sekrit', host: 'localhost', port: 5432, database: 'mydb'});
```			

// Example 3: passing in nothing 
```javascript
// NOTE: requires that there are defined environment variables for  PGUSER, PGPASSWORD, PGHOST, PGPORT, and PGDATABASE
const db = require('pg-ez')();
```

### Queries
Querying in `pg-ez` is nearly the same as querying in `pg`: simply call the `exec` method and pass to it a query string and parameters, or pass to it a query configuration object. Like `pg`, `pg-ez` supports 3 flavors of asynchronous querying: `async` / `await`, promises, and callbacks. 

#### Example 1: using `async` / `await`
```javascript
// using async / await
(async () => {
	try {
		const result = await db.exec('SELECT $1::VARCHAR AS first_name, $2::VARCHAR AS last_name, $3::INT AS age', ['Peter', 'Gibbons', 32]);
		console.log(result.rows);
	} catch (err) {
		console.error('ERR: ' + err);
	}
})();
```

#### Example 2: using promises
```javascript
db.exec('SELECT $1::VARCHAR AS first_name, $2::VARCHAR AS last_name, $3::INT AS age', ['Peter', 'Gibbons', 32])
	.then(result => {
		console.log(result.rows);
	})
	.catch(err => {
		console.error('ERR: ' + err);
	});
```
	
#### Example 3: using callbacks
```javascript
db.exec('SELECT $1::VARCHAR AS first_name, $2::VARCHAR AS last_name, $3::INT AS age', ['Peter', 'Gibbons', 32], (err, result) => {
	if (err) console.error('ERR: ' + err);
	else console.log(result.rows);
});
```

### Streams
Big data can bring big problems. If you have a query yielding millions of rows, you probably don't want to put the query results into memory and thereby spike your memory usage. Streams to the rescue! The `stream` method returns a native promise, not a stream; however, this particular promise supports a `pipe` method, allowing you to pass data through and chain together pipes just as though you were dealing with a stream. An error thrown at any point in the pipeline will propagate and can be caught - as any promise error can be - with a `catch` method (if using promises) or a `try` / `catch` block (if using `async` / `await`). 

#### Example 1: stream JSON transform of results to `http` response
```javascript
const JSONStream = require('JSONStream');
const http = require('http');
http.createServer((req, res) => {
	res.setHeader('Content-Type', 'application/json');
	db.stream('SELECT generate_series(0, $1, 1) x, generate_series(0, $1, 2) y', [1000])
		.pipe(JSONStream.stringify())
		.pipe(res);
}).listen(1337);
```

#### Example 2: stream comma-delimited transform of results to CSV file
```javascript
const csvStream =  require('csv-write-stream')({headers: ['x', 'y']});
const fs = require('fs');
const fileStream = fs.createWriteStream('./query-output.csv');

db.stream({text: 'SELECT generate_series(0, $1, 1) x, generate_series(0, $1, 2) y', values: [1000], rowMode: 'array'})
	.pipe(csvStream)
	.pipe(fileStream)
	.then(() => {
		console.log('Streaming complete!');
	})
	.catch(err => {
		console.error('ERR: ' + err);
	});
```

### Transactions

#### Example 1: Using `async` / `await`
```javascript
(async () => {
	try {
		await db.transaction(async (client) => {
			// NOTE: It's important that you execute queries against the client passed in as the lone argument to this callback function
			await client.exec('CREATE TEMP TABLE pg_ez_test_transaction (id SERIAL, first_name VARCHAR(255), last_name VARCHAR(255))');
			await client.exec('INSERT INTO pg_ez_test_transaction (first_name, last_name)  VALUES ($1, $2)', ['Michael', 'Bolton']);
		});
		console.log('Done!');
	} catch (err) {
		console.error('ERR: ' + err);
	}
})();
```

#### Example 2: Using promises
```javascript
db.transaction(async (client) => {
	// NOTE: It's important that you execute queries against the client passed in as the lone argument to this callback function
	await client.exec('CREATE TEMP TABLE pg_ez_test_transaction (id SERIAL, first_name VARCHAR(255), last_name VARCHAR(255))');
	await client.exec('INSERT INTO pg_ez_test_transaction (first_name, last_name)  VALUES ($1, $2)', ['Michael', 'Bolton']);
})
.then(function() {
	console.log('Done!');
})
.catch(function(err) {
	console.error('ERR: ' + err);
```
