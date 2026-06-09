const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'lexy',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
    ssl: false
});
async function clean() {
    try {
        await pool.query('DROP TABLE IF EXISTS user_decks, public_decks, user_cards, public_cards, decks, cards, deck_images, public_deck_images CASCADE');
        console.log('Successfully dropped old deck tables. Next server start will recreate them.');
        process.exit(0);
    } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}
clean();
