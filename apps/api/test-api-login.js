const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({ connectionString: 'postgresql://educore:educore@postgres:5432/educore' });

async function check() {
  const { rows } = await pool.query(`SELECT u.id, u.school_id, u.email, u.password_hash, u.is_active, u.full_name, u.theme,
            r.name AS role_name, r.permissions
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE (u.email = $1 OR u.username = $1) AND u.deleted_at IS NULL`, ['admin@demo.edu']);
  const user = rows[0];
  console.log('User found:', !!user);
  if (user) {
    console.log('is_active:', user.is_active);
    console.log('hash:', user.password_hash);
    const ok = await bcrypt.compare('Passw0rd!', user.password_hash);
    console.log('password check:', ok);
    console.log('success = !!(user && user.is_active && ok):', !!(user && user.is_active && ok));
  }
}
check().catch(console.error).finally(() => pool.end());
