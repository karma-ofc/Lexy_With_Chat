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
    // Ensure admin role exists
    const r = await pool.query("SELECT id FROM roles WHERE name='admin'");
    let adminRoleId;
    if (r.rows.length === 0) {
      const ins = await pool.query("INSERT INTO roles (name) VALUES ('admin') RETURNING id");
      adminRoleId = ins.rows[0].id;
    } else {
      adminRoleId = r.rows[0].id;
    }
    // Update admin user
    const u = await pool.query("UPDATE users SET role_id=$1 WHERE username='admin' RETURNING id, username, role_id", [adminRoleId]);
    console.log('Updated:', u.rows);
  }catch(e){
    console.error('ERR', e.message);
  }finally{ await pool.end(); }
})();
