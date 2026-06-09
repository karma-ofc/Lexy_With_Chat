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
(async ()=>{
  try{
    await pool.query("INSERT INTO users (id, name, username, password, avatar) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [3, 'System', 'system', 'pass3', '🤖']);
    console.log('Inserted user id=3');
  }catch(e){console.error('Insert error:', e)}finally{await pool.end()}
})();
