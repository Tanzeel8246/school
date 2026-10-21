const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://educore:educore@localhost:5432/educore' });

async function check() {
  const { rows } = await pool.query(`SELECT u.id, u.school_id, u.email, u.password_hash, u.is_active, u.full_name, u.theme,
            r.name AS role_name, r.permissions
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE (u.email = $1 OR u.username = $1) AND u.deleted_at IS NULL`, ['admin@demo.edu']);
  console.log(rows);
  const bcrypt = require('bcryptjs');
  if (rows[0]) {
    console.log('Password check:', bcrypt.compareSync('Passw0rd!', rows[0].password_hash));
  }
}
check().catch(console.error).finally(() => pool.end());
