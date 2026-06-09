require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'lexy',
  password: process.env.DB_PASSWORD || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  ssl: false
});

(async ()=>{
  try{
    await pool.query("INSERT INTO users (id, name, username, password, avatar) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [1, 'Test User 1', 'testuser1', 'pass1', '👤']);
    await pool.query("INSERT INTO users (id, name, username, password, avatar) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [2, 'Test User 2', 'testuser2', 'pass2', '👤']);
    await pool.query("INSERT INTO users (id, name, username, password, avatar) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [3, 'System', 'system', 'pass3', '🤖']);
    console.log('Seeded users id=1,2,3 into server DB');
  }catch(e){console.error('Seed error:', e)}finally{await pool.end()}
})();
