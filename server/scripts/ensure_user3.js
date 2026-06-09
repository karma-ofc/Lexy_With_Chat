require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: false
});
(async ()=>{
  try{
    await pool.query("INSERT INTO users (id, name, username, password, avatar) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [3, 'System', 'system', 'pass3', '🤖']);
    console.log('Ensured user id=3 in server DB');
  }catch(e){console.error('Error inserting user3:', e)}finally{await pool.end()}
})();
