const db = require('../index.js')();
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

var queries = [
  {text: 'DROP TABLE IF EXISTS pg_ez_test_transaction', values: []},
  {text: 'CREATE TEMP TABLE pg_ez_test_transaction (id SERIAL, first_name VARCHAR(255), last_name VARCHAR(255))', values: []},
  {text: 'DELETE FROM pg_ez_test_transaction', values: []},
  {text: 'INSERT INTO pg_ez_test_transaction (first_name, last_name)  VALUES ($1, $2)', values: ['Michael', 'Bolton']},
], goodQueryToRollback = {
  text: 'INSERT INTO pg_ez_test_transaction (first_name, last_name)  VALUES ($1, $2)', 
  values: ['Samir', 'Nagheenanajar']
}, badQueryToRollback = {
  text: 'INSERT INTO pg_ez_test_transaction (first_name, last_name)  VALUES ($1, $2)', 
  values: ['Peter']
}, testQuery = {
  text: 'SELECT 1 FROM pg_ez_test_transaction WHERE first_name = $1 and last_name = $2',
  values: ['Michael', 'Bolton']
}, testRollbackQuery = {
  text: 'SELECT 1 FROM pg_ez_test_transaction WHERE first_name = $1 and last_name = $2',
  values: ['Samir', 'Nagheenanajar']
};

test('test async-based successful transaction', async function(t) {
  await db.transaction(async (client) => {
    for (var i = 0; i < queries.length; i++) {
      await client.exec(queries[i]);
    }
  });
  // test for value 
  var result = await db.exec(testQuery);
  t.equals(result.rows.length, 1);
});

test('test promise-based successful transaction', function(t) {
  return db.transaction(async (client) => {
    for (var i = 0; i < queries.length; i++) {
      await client.exec(queries[i]);
    } 
  })
  .then(async function() {
    // test for value 
    var result = await db.exec(testQuery);
    t.equals(result.rows.length, 1);
  });
});

test('test async-based transaction rollback', async function(t) {
  try {
    await db.transaction(async (client) => {
      await client.exec(goodQueryToRollback);
      await client.exec(badQueryToRollback);
    });
  } catch (e) {
    var result = await db.exec(testRollbackQuery);
    t.equals(result.rows.length, 0);
  }
});

test('test promise-based transaction rollback', function(t) {
  return db.transaction(async (client) => {
    await client.exec(goodQueryToRollback);
    await client.exec(badQueryToRollback);
  })
  .catch(function(err) {
    // test for value 
    db.exec(testRollbackQuery).then(function(result) {
      t.equals(result.rows.length, 0);
    });
  });
});