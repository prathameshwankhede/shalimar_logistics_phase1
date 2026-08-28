// scratch/execute_create_company_units_table.mjs
// Diagnostic tool to test company_units_plants table creation directly

import mysql from 'mysql2/promise';

async function createTable() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'u704836459_shalimar_app',
    password: '', // will test via endpoint
    database: 'u704836459_shalimar_logi'
  });
}

createTable();
