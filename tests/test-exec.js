const db = require('../index.js')();
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

var query = 'SELECT $1::VARCHAR AS first_name, $2::VARCHAR AS last_name, $3::INT AS age',
	badQuery = 'SELECT $1 AS first_name, $2::VARCHAR AS last_name, $3::INT AS age',
	params = ['Peter', 'Gibbons', 32],
	expectedRows = [{ first_name: 'Peter', last_name: 'Gibbons', age: 32 }];

test('test successful async exec', async function(t) {
	const result = await db.exec(query, params);
	t.deepEqual(result.rows, expectedRows);
});

test('test error async exec', async function(t) {
	try {
		await db.exec(badQuery, params);
	} catch (err) {
		t.equal(err.toString(), 'error: could not determine data type of parameter $1');
	}
});

test('test successful promise-based exec', function(t) {
	return db.exec(query, params).then(function(result) {
		t.deepEqual(result.rows, expectedRows);
	});
});

test('test error promise-based exec', function(t) {
	return db.exec(badQuery, params).catch(function(err) {
		t.equal(err.toString(), 'error: could not determine data type of parameter $1');
	});
});

test('test successful callback-based exec', function(t) {	
	var p = new Promise(function(resolve, reject) {
		db.exec(query, params, function(err, result) {
			resolve(result);
		});
	});
	return p.then(function(result) {
		t.deepEqual(result.rows, expectedRows);
	});
});

test('test error callback-based exec', function(t) {
	var p = new Promise(function(resolve, reject) {
		db.exec(badQuery, params, function(err, result) {
			reject(err);
		});
	});
	return p.catch(function(err) {
		t.equal(err.toString(), 'error: could not determine data type of parameter $1');
	});
});