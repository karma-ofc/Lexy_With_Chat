const { Pool } = require('pg');
require('dotenv').config();
(async ()=>{
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'lexy',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432
  });
  try{
    const r = await pool.query(`SELECT u.id, u.username, u.name, r.name as role, u.banned_until IS NOT NULL as banned FROM users u LEFT JOIN roles r ON u.role_id=r.id ORDER BY u.id`);
    console.log(JSON.stringify(r.rows, null, 2));
  }catch(e){ console.error('ERR', e.message); } finally { await pool.end(); }
})();
