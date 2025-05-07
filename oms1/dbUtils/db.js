const { readFileSync } = require('fs');
const { createPool } = require('mysql');
const util = require('util');
const dotenv = require('dotenv');
dotenv.config();

let DB_Credentials = {};
if (process.env.NODE_ENV === 'Production' || process.env.NODE_ENV === 'QA' || process.env.NODE_ENV === 'Development') {
    DB_Credentials = JSON.parse(readFileSync('/run/secrets/db_credentials.json', 'utf8'));
} else {
    DB_Credentials = JSON.parse(readFileSync('./secrets/db_credentials.json', 'utf8'));
}

const pool = createPool({
    host: DB_Credentials?.host,
    user: DB_Credentials?.user,
    password: DB_Credentials?.password,
    database: DB_Credentials?.database,
    charset: 'utf8mb4',
    connectionLimit: 1000,
    connectTimeout: 60 * 60 * 1000,
    acquireTimeout: 60 * 60 * 1000,
    timeout: 60 * 60 * 1000,
});

const query = util.promisify(pool.query).bind(pool);

/**
 * Executes a SQL query against the database with optional parameters.
 *
 * @param {string} queryStatement - The SQL query string to be executed.
 * @param {Array} [params] - An optional array of parameters to be bound to the query.
 *                            If no parameters are needed, this can be omitted or passed as an empty array.
 * @returns {Promise} A promise that resolves to the result of the query execution.
 * @throws Throws an error if there is a problem executing the query.
 */
const executeQuery = async (queryStatement, params) => {
    try {
        let result;
        if (params && params.length > 0) {
            result = await query({ sql: queryStatement, values: params });
        } else {
            result = await query(queryStatement);
        }

        return result;
    } catch (err) {
        console.error('Error in db.executeQuery service', err);
        throw err;
    }
};

module.exports = { executeQuery };
