fetch('http://localhost:4000/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    loginId: 'admin@demo.edu',
    password: 'Passw0rd!'
  })
}).then(async res => {
  console.log(res.status, await res.text());
}).catch(console.error);
