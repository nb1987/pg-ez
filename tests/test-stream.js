const db = require('../index.js')('postgresql://postgres:Munoknam123$@localhost:5432/mydb');
const { Writable, Transform } = require('stream');
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

var arrayForTesting = [],
	arrayForTesting2 = [];

function makeTestWritable() {
	return new Writable({
		objectMode: true,
		write(chunk, encoding, callback) {
			arrayForTesting.push(parseInt(chunk));
			callback();
		}
	});
}

function makeBadTestWritable() {
	return new Writable({
		objectMode: true,
		write(chunk, encoding, callback) {
			callback(new Error('Test error'));
		}
	});
}

function makeTestTransform() {
	return new Transform({
		readableObjectMode: true,
		writableObjectMode: true,
		transform(chunk, encoding, callback) {
			if (parseInt(chunk.toString()) > 3) {
				callback(new Error('Test error 2'));
			} else {
				this.push(chunk.toString());
				arrayForTesting2.push(parseInt(chunk.toString()));
				callback();
			}
		}
	});
}

test('test async-based successful stream', async function(t) {
	arrayForTesting.length = 0;
	await db.stream({text: 'SELECT * FROM generate_series(0, $1) num', values: [10], rowMode: 'array'}).pipe(makeTestWritable());		
	t.equals(arrayForTesting.reduce(function(a, b) { return a + b; }), 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10);
});

test('test promise-based successful stream', function(t) {
	arrayForTesting.length = 0;
	return db.stream({text: 'SELECT * FROM generate_series(0, $1) num', values: [10], rowMode: 'array'})
		.pipe(makeTestWritable())
		.then(() => {
			t.equals(arrayForTesting.reduce(function(a, b) { return a + b; }), 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10);
		});
});

test('test async-based catching error in query', async function(t) {
	try {
		await db.stream({text: 'SELECT * FROM generate_series(0, $1) num', values: [], rowMode: 'array'}).pipe(makeTestWritable());
	} catch (err) {
		t.equals(err.toString(), 'error: bind message supplies 0 parameters, but prepared statement "" requires 1');
	}
});

test('test promise-based catching error in query', function(t) {
	return db.stream({text: 'SELECT * FROM generate_series(0, $1) num', values: [], rowMode: 'array'})
		.pipe(makeTestWritable())
		.catch(err => {
			t.equals(err.toString(), 'error: bind message supplies 0 parameters, but prepared statement "" requires 1');
		});
});

test('test async-based catching error in stream', async function(t) {
	try {
		await db.stream({text: 'SELECT * FROM generate_series(0, $1) num', values: [10], rowMode: 'array'}).pipe(makeBadTestWritable());
	} catch (err) {
		t.equals(err.toString(), 'Error: Test error');
	}
});

test('test promise-based catching error in stream', function(t) {
	return db.stream({text: 'SELECT * FROM generate_series(0, $1) num', values: [10], rowMode: 'array'})
		.pipe(makeBadTestWritable())
		.catch(err => {
			t.equals(err.toString(), 'Error: Test error');
		});
});

test('test async-based catching error mid-stream', async function(t) {
	arrayForTesting2.length = 0;
	try {
		await db.stream({text: 'SELECT * FROM generate_series(0, $1) num', values: [10], rowMode: 'array'}).pipe(makeTestTransform()).pipe(makeTestWritable());
	} catch (err) {
		t.equals(arrayForTesting2.reduce(function(a, b) { return a + b; }), 1 + 2 + 3);
	}
});

test('test promise-based catching error mid-stream', function(t) {
	arrayForTesting2.length = 0;
	return db.stream({text: 'SELECT * FROM generate_series(0, $1) num', values: [10], rowMode: 'array'})
		.pipe(makeTestTransform())
		.pipe(makeTestWritable())
		.catch(err => {
			t.equals(arrayForTesting2.reduce(function(a, b) { return a + b; }), 1 + 2 + 3);
		});
});