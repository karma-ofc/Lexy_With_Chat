require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chat',
  password: process.env.DB_PASSWORD || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  ssl: false
});

async function seed() {
  try {
    await pool.query("INSERT INTO users (id, name, username, password, avatar) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [1, 'Test User 1', 'testuser1', 'pass1', '👤']);
    await pool.query("INSERT INTO users (id, name, username, password, avatar) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [2, 'Test User 2', 'testuser2', 'pass2', '👤']);
    console.log('Seeded users id=1 and id=2');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
