require('dotenv').config();
const { Pool } = require('pg');
const table = process.argv[2] || 'chat_messages';
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
    const res = await pool.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position", [table]);
    console.log(res.rows);
  }catch(e){console.error(e)}finally{await pool.end()}
})();
