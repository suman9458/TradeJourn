// Simple bridge: automatically forwards any traffic on 5174 to 5173 so the user never gets ERR_CONNECTION_REFUSED
const http = require('http');

const PORT = 5174;
const TARGET = 'http://localhost:5173';

const server = http.createServer((req, res) => {
  const destination = `${TARGET}${req.url || '/'}`;
  res.writeHead(302, {
    Location: destination,
    'Cache-Control': 'no-cache'
  });
  res.end();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // Port 5174 already in use or taken, ignore
    process.exit(0);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Port ${PORT} redirector active -> ${TARGET}`);
});
