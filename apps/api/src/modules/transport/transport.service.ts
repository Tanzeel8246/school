/**
 * Transport service — multi-tenant, all queries scoped to actor.schoolId.
 * Soft-delete via deleted_at; all reads filter deleted_at IS NULL.
 * withTransaction for multi-step mutations (upsert student assignment).
 */
import { query, withTransaction } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound, conflict } from '../../utils/http-error.js';
import type {
  ListVehiclesQuery,
  CreateVehicleInput,
  UpdateVehicleInput,
  ListRoutesQuery,
  CreateRouteInput,
  UpdateRouteInput,
  CreateRouteStopInput,
  ListStudentTransportQuery,
  CreateStudentTransportInput,
} from './transport.schema.js';

// ── Row types ──────────────────────────────────────────────────────────────

interface VehicleRow {
  id: string;
  school_id: string;
  reg_no: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  capacity: number;
  driver_id: string | null;
  driver_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface RouteRow {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  vehicle_id: string | null;
  vehicle_reg_no: string | null;
  monthly_fee: string | number;
  is_active: boolean;
  stop_count: number;
  student_count: number;
  created_at: string;
}

interface RouteStopRow {
  id: string;
  route_id: string;
  name: string;
  stop_order: number;
  pickup_time: string | null;
  drop_time: string | null;
}

interface StudentTransportRow {
  id: string;
  school_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string | null;
  route_id: string;
  route_name: string | null;
  stop_id: string | null;
  stop_name: string | null;
  monthly_fee: string | number;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
}

// ── DTO mappers ─────────────────────────────────────────────────────────────

const toVehicleDto = (r: VehicleRow) => ({
  id:          r.id,
  schoolId:    r.school_id,
  regNo:       r.reg_no,
  vehicleType: r.vehicle_type,
  make:        r.make,
  model:       r.model,
  capacity:    r.capacity,
  driverId:    r.driver_id,
  driverName:  r.driver_name,
  isActive:    r.is_active,
  createdAt:   r.created_at,
});

const toRouteDto = (r: RouteRow) => ({
  id:           r.id,
  schoolId:     r.school_id,
  name:         r.name,
  description:  r.description,
  vehicleId:    r.vehicle_id,
  vehicleRegNo: r.vehicle_reg_no,
  monthlyFee:   Number(r.monthly_fee),
  isActive:     r.is_active,
  stopCount:    Number(r.stop_count),
  studentCount: Number(r.student_count),
  createdAt:    r.created_at,
});

const toRouteStopDto = (r: RouteStopRow) => ({
  id:         r.id,
  routeId:    r.route_id,
  name:       r.name,
  stopOrder:  r.stop_order,
  pickupTime: r.pickup_time,
  dropTime:   r.drop_time,
});

const toStudentTransportDto = (r: StudentTransportRow) => ({
  id:           r.id,
  schoolId:     r.school_id,
  studentId:    r.student_id,
  studentName:  r.student_name,
  admissionNo:  r.admission_no,
  routeId:      r.route_id,
  routeName:    r.route_name,
  stopId:       r.stop_id,
  stopName:     r.stop_name,
  monthlyFee:   Number(r.monthly_fee),
  validFrom:    r.valid_from,
  validTo:      r.valid_to,
  isActive:     r.is_active,
});

// ═══════════════════════════════════════════════════════════════════════════
// VEHICLES
// ═══════════════════════════════════════════════════════════════════════════

const VEHICLE_SELECT = `
  v.id, v.school_id, v.reg_no, v.vehicle_type, v.make, v.model, v.capacity,
  v.driver_id, s.full_name AS driver_name, v.is_active, v.created_at`;

export async function listVehicles(actor: AccessClaims, q: ListVehiclesQuery) {
  // Multi-tenant: scoped to actor.schoolId, soft-delete filtered.
  const where: string[] = ['v.school_id = $1', 'v.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`(v.reg_no ILIKE $${params.length} OR v.make ILIKE $${params.length} OR v.model ILIKE $${params.length})`);
  }
  if (q.isActive !== undefined) {
    params.push(q.isActive);
    where.push(`v.is_active = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<VehicleRow>(
      `SELECT ${VEHICLE_SELECT}
         FROM vehicles v
         LEFT JOIN staff s ON s.id = v.driver_id
        WHERE ${whereSql}
        ORDER BY v.reg_no
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM vehicles v WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toVehicleDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createVehicle(actor: AccessClaims, input: CreateVehicleInput) {
  const { rows } = await query<VehicleRow>(
    `INSERT INTO vehicles (school_id, reg_no, vehicle_type, make, model, capacity, driver_id, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, school_id, reg_no, vehicle_type, make, model, capacity,
               driver_id, NULL::text AS driver_name, is_active, created_at`,
    [
      actor.schoolId, input.regNo, input.vehicleType ?? 'bus',
      input.make ?? null, input.model ?? null,
      input.capacity ?? 40, input.driverId ?? null,
      input.isActive ?? true,
    ],
  ).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw conflict('A vehicle with this registration number already exists');
    }
    throw err;
  });

  // Fetch driver name if driverId provided.
  if (rows[0].driver_id) {
    const { rows: staffRows } = await query<{ full_name: string }>(
      `SELECT full_name FROM staff WHERE id = $1`, [rows[0].driver_id],
    );
    return toVehicleDto({ ...rows[0], driver_name: staffRows[0]?.full_name ?? null });
  }
  return toVehicleDto(rows[0]);
}

export async function updateVehicle(actor: AccessClaims, id: string, input: UpdateVehicleInput) {
  const { rows: before } = await query<VehicleRow>(
    `SELECT ${VEHICLE_SELECT} FROM vehicles v LEFT JOIN staff s ON s.id = v.driver_id
      WHERE v.id = $1 AND v.school_id = $2 AND v.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Vehicle not found');

  const { rows } = await query<VehicleRow>(
    `UPDATE vehicles
        SET reg_no       = COALESCE($3, reg_no),
            vehicle_type = COALESCE($4, vehicle_type),
            make         = COALESCE($5, make),
            model        = COALESCE($6, model),
            capacity     = COALESCE($7, capacity),
            driver_id    = COALESCE($8, driver_id),
            is_active    = COALESCE($9, is_active)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, reg_no, vehicle_type, make, model, capacity,
                driver_id, NULL::text AS driver_name, is_active, created_at`,
    [
      id, actor.schoolId,
      input.regNo ?? null, input.vehicleType ?? null,
      input.make ?? null, input.model ?? null,
      input.capacity ?? null, input.driverId ?? null,
      input.isActive ?? null,
    ],
  );
  return { before: toVehicleDto(before[0]), after: toVehicleDto({ ...rows[0], driver_name: before[0].driver_name }) };
}

export async function deleteVehicle(actor: AccessClaims, id: string) {
  const { rows } = await query<VehicleRow>(
    `UPDATE vehicles SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, reg_no, vehicle_type, make, model, capacity,
                driver_id, NULL::text AS driver_name, is_active, created_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Vehicle not found');
  return toVehicleDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

const ROUTE_SELECT = `
  r.id, r.school_id, r.name, r.description, r.vehicle_id,
  v.reg_no AS vehicle_reg_no, r.monthly_fee, r.is_active,
  (SELECT count(*) FROM route_stops rs WHERE rs.route_id = r.id)::int AS stop_count,
  (SELECT count(*) FROM student_transport st WHERE st.route_id = r.id AND st.is_active = true AND st.deleted_at IS NULL)::int AS student_count,
  r.created_at`;

export async function listRoutes(actor: AccessClaims, q: ListRoutesQuery) {
  const where: string[] = ['r.school_id = $1', 'r.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`r.name ILIKE $${params.length}`);
  }
  if (q.isActive !== undefined) {
    params.push(q.isActive);
    where.push(`r.is_active = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<RouteRow>(
      `SELECT ${ROUTE_SELECT}
         FROM routes r
         LEFT JOIN vehicles v ON v.id = r.vehicle_id
        WHERE ${whereSql}
        ORDER BY r.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM routes r WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toRouteDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createRoute(actor: AccessClaims, input: CreateRouteInput) {
  const { rows } = await query<RouteRow>(
    `INSERT INTO routes (school_id, name, description, vehicle_id, monthly_fee, is_active)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, school_id, name, description, vehicle_id,
               NULL::text AS vehicle_reg_no, monthly_fee, is_active, 0 AS stop_count, 0 AS student_count, created_at`,
    [
      actor.schoolId, input.name, input.description ?? null,
      input.vehicleId ?? null, input.monthlyFee ?? 0, input.isActive ?? true,
    ],
  ).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw conflict('A route with this name already exists');
    }
    throw err;
  });
  return toRouteDto(rows[0]);
}

export async function updateRoute(actor: AccessClaims, id: string, input: UpdateRouteInput) {
  const { rows: before } = await query<RouteRow>(
    `SELECT ${ROUTE_SELECT} FROM routes r LEFT JOIN vehicles v ON v.id = r.vehicle_id
      WHERE r.id = $1 AND r.school_id = $2 AND r.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Route not found');

  const { rows } = await query<RouteRow>(
    `UPDATE routes
        SET name        = COALESCE($3, name),
            description = COALESCE($4, description),
            vehicle_id  = COALESCE($5, vehicle_id),
            monthly_fee = COALESCE($6, monthly_fee),
            is_active   = COALESCE($7, is_active)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, name, description, vehicle_id,
                NULL::text AS vehicle_reg_no, monthly_fee, is_active, 0 AS stop_count, 0 AS student_count, created_at`,
    [
      id, actor.schoolId,
      input.name ?? null, input.description ?? null,
      input.vehicleId ?? null, input.monthlyFee ?? null,
      input.isActive ?? null,
    ],
  );
  return { before: toRouteDto(before[0]), after: toRouteDto({ ...rows[0], vehicle_reg_no: before[0].vehicle_reg_no }) };
}

export async function deleteRoute(actor: AccessClaims, id: string) {
  const { rows } = await query<RouteRow>(
    `UPDATE routes SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, name, description, vehicle_id,
                NULL::text AS vehicle_reg_no, monthly_fee, is_active, 0 AS stop_count, 0 AS student_count, created_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Route not found');
  return toRouteDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// STOPS (sub-resource of route)
// ═══════════════════════════════════════════════════════════════════════════

export async function listRouteStops(actor: AccessClaims, routeId: string) {
  // Verify route belongs to this school (multi-tenant).
  const { rows: routeRows } = await query<{ id: string }>(
    `SELECT id FROM routes WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [routeId, actor.schoolId],
  );
  if (!routeRows[0]) throw notFound('Route not found');

  const { rows } = await query<RouteStopRow>(
    `SELECT id, route_id, name, stop_order, pickup_time, drop_time
       FROM route_stops WHERE route_id = $1 ORDER BY stop_order`,
    [routeId],
  );
  return { data: rows.map(toRouteStopDto) };
}

export async function createRouteStop(
  actor: AccessClaims,
  routeId: string,
  input: CreateRouteStopInput,
) {
  // Verify route belongs to this school.
  const { rows: routeRows } = await query<{ id: string }>(
    `SELECT id FROM routes WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [routeId, actor.schoolId],
  );
  if (!routeRows[0]) throw notFound('Route not found');

  const { rows } = await query<RouteStopRow>(
    `INSERT INTO route_stops (route_id, school_id, name, stop_order, pickup_time, drop_time)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, route_id, name, stop_order, pickup_time, drop_time`,
    [
      routeId, actor.schoolId, input.name,
      input.stopOrder ?? 1, input.pickupTime ?? null, input.dropTime ?? null,
    ],
  );
  return toRouteStopDto(rows[0]);
}

export async function deleteRouteStop(actor: AccessClaims, routeId: string, stopId: string) {
  // Verify route belongs to this school then delete the stop.
  const { rows: routeRows } = await query<{ id: string }>(
    `SELECT id FROM routes WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [routeId, actor.schoolId],
  );
  if (!routeRows[0]) throw notFound('Route not found');

  const { rows } = await query<{ id: string }>(
    `DELETE FROM route_stops WHERE id = $1 AND route_id = $2 RETURNING id`,
    [stopId, routeId],
  );
  if (!rows[0]) throw notFound('Stop not found');
  return { id: rows[0].id };
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT TRANSPORT
// ═══════════════════════════════════════════════════════════════════════════

const ST_SELECT = `
  st.id, st.school_id, st.student_id,
  s.full_name AS student_name, s.admission_no,
  st.route_id, r.name AS route_name,
  st.stop_id, rs.name AS stop_name,
  r.monthly_fee, st.valid_from, st.valid_to, st.is_active`;

export async function listStudentTransport(
  actor: AccessClaims,
  q: ListStudentTransportQuery,
) {
  const where: string[] = ['st.school_id = $1', 'st.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.routeId) {
    params.push(q.routeId);
    where.push(`st.route_id = $${params.length}`);
  }
  if (q.isActive !== undefined) {
    params.push(q.isActive);
    where.push(`st.is_active = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<StudentTransportRow>(
      `SELECT ${ST_SELECT}
         FROM student_transport st
         JOIN students s ON s.id = st.student_id
         JOIN routes r ON r.id = st.route_id
         LEFT JOIN route_stops rs ON rs.id = st.stop_id
        WHERE ${whereSql}
        ORDER BY s.full_name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM student_transport st WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toStudentTransportDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function assignStudentTransport(
  actor: AccessClaims,
  input: CreateStudentTransportInput,
) {
  // Upsert: deactivate existing active assignment, then insert new. Transactional.
  return withTransaction(async (client) => {
    // Verify student belongs to this school (multi-tenant).
    const { rows: stuRows } = await client.query<{ id: string }>(
      `SELECT id FROM students WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.studentId, actor.schoolId],
    );
    if (!stuRows[0]) throw notFound('Student not found');

    // Deactivate any existing active assignment for this student.
    await client.query(
      `UPDATE student_transport
          SET is_active = false, deleted_at = now()
        WHERE school_id = $1 AND student_id = $2 AND is_active = true AND deleted_at IS NULL`,
      [actor.schoolId, input.studentId],
    );

    // Fetch route's monthly_fee for the DTO.
    const { rows: routeRows } = await client.query<{ monthly_fee: string }>(
      `SELECT monthly_fee FROM routes WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.routeId, actor.schoolId],
    );
    if (!routeRows[0]) throw notFound('Route not found');

    const { rows } = await client.query<StudentTransportRow>(
      `INSERT INTO student_transport (school_id, student_id, route_id, stop_id, valid_from, valid_to, is_active)
       VALUES ($1,$2,$3,$4,COALESCE($5::date, current_date),$6,true)
       RETURNING id, school_id, student_id, NULL::text AS student_name, NULL::text AS admission_no,
                 route_id, NULL::text AS route_name, stop_id, NULL::text AS stop_name,
                 $7::bigint AS monthly_fee, valid_from, valid_to, is_active`,
      [
        actor.schoolId, input.studentId, input.routeId,
        input.stopId ?? null, input.validFrom ?? null,
        input.validTo ?? null, routeRows[0].monthly_fee,
      ],
    );

    return toStudentTransportDto(rows[0]);
  });
}

export async function removeStudentTransport(actor: AccessClaims, id: string) {
  // Soft-delete (deactivate).
  const { rows } = await query<{ id: string }>(
    `UPDATE student_transport SET is_active = false, deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Student transport assignment not found');
  return { id: rows[0].id };
}
