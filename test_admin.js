const http = require('http');
const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 1, role: 'admin' }, 'your-very-secure-jwt-secret-key-that-should-be-long-and-random-in-production', { expiresIn: '1h' });

const urls = ['/api/admin/users', '/api/admin/public-decks', '/api/admin/submissions'];

urls.forEach(u => {
    http.get({
        hostname: 'localhost',
        port: 3000,
        path: u,
        headers: { 'Authorization': 'Bearer 
    }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => console.log(u, res.statusCode, data.substring(0,50)));
    });
});
