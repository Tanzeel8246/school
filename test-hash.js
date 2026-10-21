const bcrypt = require('bcryptjs');

const hash = '$2a$12$XWn9oEO7Vf21.jv6ON5QHu1sczVqYZviVBHEU5JW0QaQ1SCVAZIiW';
const ok = bcrypt.compareSync('Passw0rd!', hash);
console.log('Match?', ok);
