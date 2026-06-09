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
    await pool.query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS encrypted_payload TEXT");
    await pool.query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS iv TEXT");
    await pool.query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS auth_tag TEXT");
    console.log('Added encrypted columns');
  }catch(e){console.error('Migration error:', e)}finally{await pool.end()}
})();
