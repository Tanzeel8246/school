const http = require('http');

const data = JSON.stringify({
  loginId: 'admin@demo.edu',
  password: 'Passw0rd!'
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
