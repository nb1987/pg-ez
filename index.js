'use strict';

const { Client, Pool } = require('pg');
const QueryStream = require('pg-query-stream');
const { Transform } = require('stream');

function PgEz(connection) {
	var self = this;
	
	function makeConnectionString() {
		var connectionString;
		if (typeof connection === 'string') {
			connectionString = connection;
		} else if (typeof connection === 'object') {
			if ('ssl' in connection) {
				self._isSSLConnection = true;
			} else {
				connectionString = `postgresql://${connection.user}:${connection.password}@${connection.host}:${connection.port}/${connection.database}`;
			}
		} else if (typeof connection === 'undefined') {
			if (['PGHOST', 'PGUSER', 'PGDATABASE', 'PGPASSWORD', 'PGPORT'].some(function(prop) { return typeof process.env[prop] === 'undefined' })) {
				throw new Error('If no connection string or object passed in, the environment variables PGHOST, PGUSER, PGDATABASE, PGPASSWORD, and PGPORT must all be defined');
			} else {
				connectionString = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;
			}
		}
		return connectionString;
	};
	
	function makeQueryObject(query, params) {
		var queryConfig;
        if (typeof query === 'string') {
            queryConfig = {
                text: query,
                values: params || []
            };
        } else {
            queryConfig = query;
			if (!('values' in queryConfig) && typeof params !== 'undefined') {
				queryConfig.values = params;
			}
        }
		return queryConfig;
	}
	
	if (self._isSSLConnection) {
		self._pool = new Pool(connection);
	} else {
		self._connectionString = makeConnectionString();
		self._pool = new Pool({ connectionString: self._connectionString });
	}
	self._pool.on('error', function(err, client) {
		console.error('Unexpected error on idle client', err);
		process.exit(-1);
	});
	
	/**
     * Executes a query.
     * @param {string|Object} query - The query string or query configuration object
     * @param {array|function} paramsOrCallback - The query parameters or a callback function to be invoked following execution 
     * @param {function} callback - Callback function to be invoked following query execution 
     * @return {Promise|undefined} Promise or undefined (if callback passed in)
     */
    this.exec = function (query, paramsOrCallback, callback) {

		// if exec called inside transaction block, client is assigned to this, ensuring 
		// that the same client instance is used for all statements within the transaction
		var client = Object.is(self, this) ? self._pool : this;

		if (typeof paramsOrCallback === 'function') {
			client.query(makeQueryObject(query, []), function(err, result) {
				callback(err, result);
			});
		} else if (typeof callback === 'function') {
			client.query(makeQueryObject(query, paramsOrCallback), function(err, result) {
				callback(err, result);
			});
		} else {
			return new Promise(function(resolve, reject) {
				client.query(makeQueryObject(query, paramsOrCallback)).then(function(result) {
					resolve(result);
				}).catch(function(err) {
					reject(err);
				});
			});
		}
    };
	
	/**
     * Executes a function wrapped in a transaction block.
     * @param {function} callback - Function encapsulating all of the work to do within the transaction
     * @return {Promise} Promise
     */
	this.transaction = function (callback) {
		return new Promise(function(resolve, reject) {
			self._pool.connect(function(err, client, release) {
				if (err) {
					reject(err);
				} else {
					var rollback = function(err) {
						client.query('ROLLBACK')
						.then(function() {
							release();
							reject(err);
						})
						.catch(function(rollbackErr) {
							release();
							reject(rollbackErr);
						});
					};
									
					client.query('BEGIN')
					.then(function() {
						callback(Object.assign(client, {'exec': self.exec}))
						.then(function() {
							client.query('COMMIT')
							.then(function() {
								release();
								resolve();
							})
							.catch(function(err) {
								rollback(err);
							});
						}).catch(function(err) {
							rollback(err);
						});
					})
					.catch(function(err) {
						rollback(err);
					});
				}
			});
		});
    };
	
	/**
     * Opens a query stream.
     * @param {string|Object} query - The query string or query configuration object
     * @param {array} params - The query parameters (optional)
     * @return {StreamAbstraction} Instance of StreamAbstraction
     */
	this.stream = function (query, params) {
		return new StreamAbstraction(self._pool, query, params);		
    };	
}

function StreamAbstraction(pool, query, params) {
	var self = this;
	self._currentInputStream;
	self._queue = [];
	
	// query object deconstruction 
	if (typeof query === 'object') {
		self.transformToArray = query.rowMode === 'array';
		if ('values' in query) {
			params = query.values;
		}
		query = query.text;
	}
	
	self.pipe = self.to = function(outputStream) {
		 var promise = new Promise(function(resolve, reject) {
			pool.connect(function(err, client, release) {
				if (err) {
					 reject(err);
				} else {
					var queryStream = new QueryStream(query, params || []);
					var stream = client.query(queryStream); 
					stream.on('end', function() {
						release();
						resolve();
					});
					stream.on('error', function(err) {
						release();
						reject(err);
					});
					self._currentInputStream = stream;
					self._queue.unshift(outputStream);
					if (self.transformToArray) {
						self._queue.unshift(new Transform({
							readableObjectMode: true,
							writableObjectMode: true,
							transform(chunk, encoding, callback) {
								this.push(Object.values(chunk));
								callback();
							}
						}));
					}
					while (self._queue.length > 0) {
						var newOutputStream = self._queue.shift();
						newOutputStream.on('error', function(err) {
							this.destroy();
							reject(err);
						});
						self._currentInputStream.pipe(newOutputStream);
						self._currentInputStream = newOutputStream;
					}
				}	
			});
		});
		// enable pipe chaining
		promise.pipe = promise.thenTo = promise.to = function(stream) { 
			self._queue.push(stream);
			return promise;
		};
		return promise;
	};
}

module.exports = function (connection) {
	return new PgEz(connection);
};