const express = require('express');
const router = express.Router();

// TODO: wire these routes into server.js and implement using existing DB logic

router.get('/', async (req, res) => {
    res.json({ message: 'Decks route placeholder' });
});

router.post('/', async (req, res) => {
    res.status(501).json({ error: 'Not implemented in scaffold' });
});

module.exports = router;
