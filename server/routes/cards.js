const express = require('express');
const router = express.Router();

// TODO: implement card management handlers and integrate with server.js

router.get('/', async (req, res) => {
    res.json({ message: 'Cards route placeholder' });
});

router.post('/', async (req, res) => {
    res.status(501).json({ error: 'Not implemented in scaffold' });
});

module.exports = router;
