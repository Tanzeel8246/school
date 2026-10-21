import type { PoolClient } from 'pg';

/**
 * Canonical seed permission sets per role (blueprint §6 — RBAC).
 * These MUST stay in lockstep with db/seed.sql so a school created via the API
 * gets exactly the same roles/permissions as the demo tenant.
 */
const DEFAULT_ROLES: { name: string; isSystem: boolean; permissions: string[] }[] = [
  // super_admin owns everything via the '*' wildcard (matched in rbac.requirePermission).
  { name: 'super_admin', isSystem: true, permissions: ['*'] },
  {
    name: 'principal',
    isSystem: false,
    permissions: [
      'students:read',
      'fees:read',
      'results:read',
      'audit:read',
      'settings:manage',
      'teachers:read',
      'staff:read',
      'leaves:read',
      'payroll:read',
      'accounting:read',
      'library:read',
      'transport:read',
      'hostel:read',
      'inventory:read',
      'communications:read',
      'reports:read',
      'academics:read',
      'attendance:read',
    ],
  },
  {
    name: 'manager',
    isSystem: false,
    permissions: [
      'students:read',
      'students:write',
      'attendance:mark',
      'fees:read',
      'fees:collect',
      'fees:write',
      'results:read',
      'exams:enter_marks',
      'exams:write',
      'exams:manage',
      'teachers:read',
      'teachers:write',
      'staff:read',
      'staff:write',
      'staff_attendance:mark',
      'leaves:read',
      'leaves:manage',
      'payroll:read',
      'payroll:manage',
      'accounting:read',
      'accounting:post',
      'library:read',
      'library:write',
      'library:manage',
      'transport:read',
      'transport:write',
      'hostel:read',
      'hostel:write',
      'inventory:read',
      'inventory:write',
      'inventory:manage',
      'communications:read',
      'communications:write',
      'communications:manage',
      'reports:read',
      'academics:read',
      'academics:write',
      'attendance:read',
    ],
  },
  {
    name: 'accountant',
    isSystem: false,
    permissions: [
      'fees:read',
      'fees:collect',
      'fees:write',
      'payroll:run',
      'accounting:post',
      'students:read',
      // HR / payroll visibility (Phase 3)
      'staff:read',
      'payroll:read',
      'leaves:read',
      // Phase 4: accounting read, payroll manage
      'accounting:read',
      'payroll:manage',
      // Phase 6: read access + inventory manage for purchase orders
      'library:read',
      'transport:read',
      'hostel:read',
      'inventory:read',
      'inventory:manage',
      // Phase 7: communication read access
      'communications:read',
      // Phase 8: reports read access
      'reports:read',
    ],
  },
  {
    name: 'teacher',
    isSystem: false,
    permissions: [
      'students:read',
      'attendance:mark',
      'attendance:read',
      'exams:enter_marks',
      'results:read',
      'leaves:read',
      'academics:read',
    ],
  },
  { name: 'student', isSystem: false, permissions: ['results:read', 'fees:read'] },
  { name: 'parent', isSystem: false, permissions: ['results:read', 'fees:read', 'parent:read'] },
];

/**
 * Insert the six standard roles for a freshly-created tenant and return a map of
 * role name -> role id. Shared by auth.register and POST /schools so role creation
 * lives in exactly one place (DRY). Must run inside the caller's transaction.
 */
export async function createDefaultRoles(
  client: PoolClient,
  schoolId: string,
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const role of DEFAULT_ROLES) {
    const { rows } = await client.query<{ id: string; name: string }>(
      `INSERT INTO roles (school_id, name, is_system, permissions)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name`,
      [schoolId, role.name, role.isSystem, role.permissions],
    );
    ids[rows[0].name] = rows[0].id;
  }
  return ids;
}
