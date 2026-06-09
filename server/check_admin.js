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
    const r = await pool.query("SELECT u.id,u.username,u.role_id,r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id=r.id WHERE u.username='admin'");
    console.log(JSON.stringify(r.rows,null,2));
  }catch(e){
    console.error('ERR', e.message);
  }finally{ await pool.end(); }
})();
