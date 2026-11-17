const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'asistencia',
  port: process.env.DB_PORT || 5432,
  }),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('Base de datos conectada correctamente.');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el cliente de PostgreSQL:', err);
  process.exit(-1);
});

module.exports = pool;
