require('dotenv').config();
const jwt = require('jsonwebtoken');
const id = process.argv[2] || '1';
const JWT_SECRET = process.env.JWT_SECRET || 'lexy-secret-key-2024';
const token = jwt.sign({ id: Number(id), name: `Test User ${id}`, username: `testuser${id}` }, JWT_SECRET);
console.log(token);
