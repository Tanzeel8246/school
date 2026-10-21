/**
 * Hostel service — multi-tenant, all queries scoped to actor.schoolId.
 * Money (monthly_fee) is BIGINT minor units throughout.
 * Soft-delete via deleted_at; all reads filter deleted_at IS NULL.
 * withTransaction for multi-step mutations (allocations).
 */
import { query, withTransaction } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound, unprocessable } from '../../utils/http-error.js';
import type {
  ListHostelsQuery,
  CreateHostelInput,
  UpdateHostelInput,
  ListHostelRoomsQuery,
  CreateHostelRoomInput,
  UpdateHostelRoomInput,
  ListAllocationsQuery,
  CreateHostelAllocationInput,
  VacateAllocationInput,
  UpsertMessMenuInput,
} from './hostel.schema.js';

// ── Row types ──────────────────────────────────────────────────────────────

interface HostelRow {
  id: string;
  school_id: string;
  name: string;
  hostel_type: string;
  address: string | null;
  warden_id: string | null;
  warden_name: string | null;
  total_capacity: number;
  occupied_count: number;
  created_at: string;
}

interface HostelRoomRow {
  id: string;
  school_id: string;
  hostel_id: string;
  hostel_name: string | null;
  room_no: string;
  room_type: string;
  floor: number;
  capacity: number;
  occupied: number;
  monthly_fee: string | number;
  is_active: boolean;
  created_at: string;
}

interface HostelAllocationRow {
  id: string;
  school_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string | null;
  hostel_id: string;
  hostel_name: string | null;
  room_id: string;
  room_no: string | null;
  bed_no: string | null;
  allocated_from: string;
  allocated_to: string | null;
  monthly_fee: string | number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface MessMenuRow {
  hostel_id: string;
  day_of_week: number;
  meal_type: string;
  menu_items: string;
  updated_at: string;
}

// ── DTO mappers ─────────────────────────────────────────────────────────────

const toHostelDto = (r: HostelRow) => ({
  id:            r.id,
  schoolId:      r.school_id,
  name:          r.name,
  hostelType:    r.hostel_type,
  address:       r.address,
  wardenId:      r.warden_id,
  wardenName:    r.warden_name,
  totalCapacity: r.total_capacity,
  occupiedCount: Number(r.occupied_count),
  createdAt:     r.created_at,
});

const toHostelRoomDto = (r: HostelRoomRow) => ({
  id:         r.id,
  schoolId:   r.school_id,
  hostelId:   r.hostel_id,
  hostelName: r.hostel_name,
  roomNo:     r.room_no,
  roomType:   r.room_type,
  floor:      r.floor,
  capacity:   r.capacity,
  occupied:   r.occupied,
  monthlyFee: Number(r.monthly_fee),
  isActive:   r.is_active,
  createdAt:  r.created_at,
});

const toAllocationDto = (r: HostelAllocationRow) => ({
  id:            r.id,
  schoolId:      r.school_id,
  studentId:     r.student_id,
  studentName:   r.student_name,
  admissionNo:   r.admission_no,
  hostelId:      r.hostel_id,
  hostelName:    r.hostel_name,
  roomId:        r.room_id,
  roomNo:        r.room_no,
  bedNo:         r.bed_no,
  allocatedFrom: r.allocated_from,
  allocatedTo:   r.allocated_to,
  monthlyFee:    Number(r.monthly_fee),
  status:        r.status,
  notes:         r.notes,
  createdAt:     r.created_at,
});

const toMessMenuDto = (r: MessMenuRow) => ({
  hostelId:   r.hostel_id,
  dayOfWeek:  r.day_of_week,
  mealType:   r.meal_type,
  menuItems:  r.menu_items,
  updatedAt:  r.updated_at,
});

// ═══════════════════════════════════════════════════════════════════════════
// HOSTELS
// ═══════════════════════════════════════════════════════════════════════════

const HOSTEL_SELECT = `
  h.id, h.school_id, h.name, h.hostel_type, h.address,
  h.warden_id, s.full_name AS warden_name, h.total_capacity,
  (SELECT count(*) FROM hostel_allocations ha
    WHERE ha.hostel_id = h.id AND ha.status = 'active' AND ha.deleted_at IS NULL)::int AS occupied_count,
  h.created_at`;

export async function listHostels(actor: AccessClaims, q: ListHostelsQuery) {
  // Multi-tenant, soft-delete filtered, includes warden name and occupied count.
  const where: string[] = ['h.school_id = $1', 'h.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`h.name ILIKE $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<HostelRow>(
      `SELECT ${HOSTEL_SELECT}
         FROM hostels h
         LEFT JOIN staff s ON s.id = h.warden_id
        WHERE ${whereSql}
        ORDER BY h.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM hostels h WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toHostelDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createHostel(actor: AccessClaims, input: CreateHostelInput) {
  const { rows } = await query<HostelRow>(
    `INSERT INTO hostels (school_id, name, hostel_type, address, warden_id, total_capacity)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, school_id, name, hostel_type, address,
               warden_id, NULL::text AS warden_name, total_capacity, 0 AS occupied_count, created_at`,
    [
      actor.schoolId, input.name, input.hostelType ?? 'boys',
      input.address ?? null, input.wardenId ?? null,
      input.totalCapacity ?? 0,
    ],
  );
  return toHostelDto(rows[0]);
}

export async function updateHostel(actor: AccessClaims, id: string, input: UpdateHostelInput) {
  const { rows: before } = await query<HostelRow>(
    `SELECT ${HOSTEL_SELECT} FROM hostels h LEFT JOIN staff s ON s.id = h.warden_id
      WHERE h.id = $1 AND h.school_id = $2 AND h.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Hostel not found');

  const { rows } = await query<HostelRow>(
    `UPDATE hostels
        SET name           = COALESCE($3, name),
            hostel_type    = COALESCE($4, hostel_type),
            address        = COALESCE($5, address),
            warden_id      = COALESCE($6, warden_id),
            total_capacity = COALESCE($7, total_capacity)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, name, hostel_type, address,
                warden_id, NULL::text AS warden_name, total_capacity, 0 AS occupied_count, created_at`,
    [
      id, actor.schoolId,
      input.name ?? null, input.hostelType ?? null,
      input.address ?? null, input.wardenId ?? null,
      input.totalCapacity ?? null,
    ],
  );
  return { before: toHostelDto(before[0]), after: toHostelDto({ ...rows[0], warden_name: before[0].warden_name, occupied_count: before[0].occupied_count }) };
}

export async function deleteHostel(actor: AccessClaims, id: string) {
  const { rows } = await query<HostelRow>(
    `UPDATE hostels SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, name, hostel_type, address,
                warden_id, NULL::text AS warden_name, total_capacity, 0 AS occupied_count, created_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Hostel not found');
  return toHostelDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOMS
// ═══════════════════════════════════════════════════════════════════════════

export async function listHostelRooms(
  actor: AccessClaims,
  hostelId: string,
  q: ListHostelRoomsQuery,
) {
  // Verify hostel belongs to this school (multi-tenant).
  const { rows: hostelRows } = await query<{ id: string; name: string }>(
    `SELECT id, name FROM hostels WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [hostelId, actor.schoolId],
  );
  if (!hostelRows[0]) throw notFound('Hostel not found');

  const offset = (q.page - 1) * q.limit;
  const [dataRes, countRes] = await Promise.all([
    query<HostelRoomRow>(
      `SELECT hr.id, hr.school_id, hr.hostel_id, $3::text AS hostel_name,
              hr.room_no, hr.room_type, hr.floor, hr.capacity, hr.occupied,
              hr.monthly_fee, hr.is_active, hr.created_at
         FROM hostel_rooms hr
        WHERE hr.hostel_id = $1 AND hr.school_id = $2 AND hr.deleted_at IS NULL
        ORDER BY hr.floor, hr.room_no
        LIMIT $4 OFFSET $5`,
      [hostelId, actor.schoolId, hostelRows[0].name, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM hostel_rooms
        WHERE hostel_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [hostelId, actor.schoolId],
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toHostelRoomDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createHostelRoom(
  actor: AccessClaims,
  hostelId: string,
  input: CreateHostelRoomInput,
) {
  // Verify hostel belongs to this school.
  const { rows: hostelRows } = await query<{ id: string; name: string }>(
    `SELECT id, name FROM hostels WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [hostelId, actor.schoolId],
  );
  if (!hostelRows[0]) throw notFound('Hostel not found');

  const { rows } = await query<HostelRoomRow>(
    `INSERT INTO hostel_rooms (school_id, hostel_id, room_no, room_type, floor, capacity, monthly_fee, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, school_id, hostel_id, room_no, room_type, floor, capacity, occupied, monthly_fee, is_active, created_at`,
    [
      actor.schoolId, hostelId, input.roomNo,
      input.roomType ?? 'double', input.floor ?? 0,
      input.capacity ?? 2, input.monthlyFee ?? 0,
      input.isActive ?? true,
    ],
  ).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw notFound('A room with this number already exists in this hostel');
    }
    throw err;
  });
  return toHostelRoomDto({ ...rows[0], hostel_name: hostelRows[0].name });
}

export async function updateHostelRoom(
  actor: AccessClaims,
  id: string,
  input: UpdateHostelRoomInput,
) {
  const { rows: before } = await query<HostelRoomRow>(
    `SELECT hr.id, hr.school_id, hr.hostel_id, h.name AS hostel_name,
            hr.room_no, hr.room_type, hr.floor, hr.capacity, hr.occupied,
            hr.monthly_fee, hr.is_active, hr.created_at
       FROM hostel_rooms hr JOIN hostels h ON h.id = hr.hostel_id
      WHERE hr.id = $1 AND hr.school_id = $2 AND hr.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Room not found');

  const { rows } = await query<HostelRoomRow>(
    `UPDATE hostel_rooms
        SET room_no    = COALESCE($3, room_no),
            room_type  = COALESCE($4, room_type),
            floor      = COALESCE($5, floor),
            capacity   = COALESCE($6, capacity),
            monthly_fee = COALESCE($7, monthly_fee),
            is_active  = COALESCE($8, is_active)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, hostel_id, room_no, room_type, floor, capacity, occupied, monthly_fee, is_active, created_at`,
    [
      id, actor.schoolId,
      input.roomNo ?? null, input.roomType ?? null,
      input.floor ?? null, input.capacity ?? null,
      input.monthlyFee ?? null, input.isActive ?? null,
    ],
  );
  const after = { ...rows[0], hostel_name: before[0].hostel_name };
  return { before: toHostelRoomDto(before[0]), after: toHostelRoomDto(after) };
}

export async function deleteHostelRoom(actor: AccessClaims, id: string) {
  // Reject if room is occupied (has active allocations).
  const { rows: occupiedRows } = await query<{ occupied: number }>(
    `SELECT occupied FROM hostel_rooms WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!occupiedRows[0]) throw notFound('Room not found');
  if (Number(occupiedRows[0].occupied) > 0) {
    throw unprocessable('Cannot delete an occupied room');
  }

  const { rows } = await query<HostelRoomRow>(
    `UPDATE hostel_rooms SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, hostel_id, room_no, room_type, floor, capacity, occupied, monthly_fee, is_active, created_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Room not found');
  return toHostelRoomDto({ ...rows[0], hostel_name: null });
}

// ═══════════════════════════════════════════════════════════════════════════
// ALLOCATIONS
// ═══════════════════════════════════════════════════════════════════════════

const ALLOC_SELECT = `
  ha.id, ha.school_id, ha.student_id,
  s.full_name AS student_name, s.admission_no,
  ha.hostel_id, h.name AS hostel_name,
  ha.room_id, hr.room_no,
  ha.bed_no, ha.allocated_from, ha.allocated_to,
  ha.monthly_fee, ha.status, ha.notes, ha.created_at`;

export async function listAllocations(actor: AccessClaims, q: ListAllocationsQuery) {
  const where: string[] = ['ha.school_id = $1', 'ha.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.hostelId) {
    params.push(q.hostelId);
    where.push(`ha.hostel_id = $${params.length}`);
  }
  if (q.roomId) {
    params.push(q.roomId);
    where.push(`ha.room_id = $${params.length}`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`ha.status = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<HostelAllocationRow>(
      `SELECT ${ALLOC_SELECT}
         FROM hostel_allocations ha
         JOIN students s ON s.id = ha.student_id
         JOIN hostels h ON h.id = ha.hostel_id
         JOIN hostel_rooms hr ON hr.id = ha.room_id
        WHERE ${whereSql}
        ORDER BY ha.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM hostel_allocations ha WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toAllocationDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function allocateStudent(actor: AccessClaims, input: CreateHostelAllocationInput) {
  // Validate capacity; increment room.occupied. Transactional.
  return withTransaction(async (client) => {
    // Verify student belongs to this school (multi-tenant).
    const { rows: stuRows } = await client.query<{ id: string }>(
      `SELECT id FROM students WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.studentId, actor.schoolId],
    );
    if (!stuRows[0]) throw notFound('Student not found');

    // Check room capacity.
    const { rows: roomRows } = await client.query<{ id: string; capacity: number; occupied: number; room_no: string }>(
      `SELECT id, capacity, occupied, room_no FROM hostel_rooms
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.roomId, actor.schoolId],
    );
    if (!roomRows[0]) throw notFound('Room not found');
    if (roomRows[0].occupied >= roomRows[0].capacity) {
      throw unprocessable('Room is at full capacity');
    }

    // Fetch hostel name.
    const { rows: hostelRows } = await client.query<{ name: string }>(
      `SELECT name FROM hostels WHERE id = $1`, [input.hostelId],
    );

    const { rows } = await client.query<HostelAllocationRow>(
      `INSERT INTO hostel_allocations
         (school_id, student_id, hostel_id, room_id, bed_no,
          allocated_from, allocated_to, monthly_fee, status, notes, allocated_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, current_date),$7,$8,'active',$9,$10)
       RETURNING id, school_id, student_id, NULL::text AS student_name, NULL::text AS admission_no,
                 hostel_id, $11::text AS hostel_name, room_id, $12::text AS room_no,
                 bed_no, allocated_from, allocated_to, monthly_fee, status, notes, created_at`,
      [
        actor.schoolId, input.studentId, input.hostelId, input.roomId,
        input.bedNo ?? null, input.allocatedFrom ?? null,
        input.allocatedTo ?? null, input.monthlyFee ?? 0,
        input.notes ?? null, actor.sub,
        hostelRows[0]?.name ?? null, roomRows[0].room_no,
      ],
    );

    // Increment room.occupied.
    await client.query(
      `UPDATE hostel_rooms SET occupied = occupied + 1 WHERE id = $1`,
      [input.roomId],
    );

    return toAllocationDto(rows[0]);
  });
}

export async function vacateAllocation(
  actor: AccessClaims,
  id: string,
  input: VacateAllocationInput,
) {
  // status='vacated'; DECREMENT room.occupied. Transactional.
  return withTransaction(async (client) => {
    const { rows: allocRows } = await client.query<{ id: string; room_id: string; status: string }>(
      `SELECT id, room_id, status FROM hostel_allocations
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [id, actor.schoolId],
    );
    if (!allocRows[0]) throw notFound('Allocation not found');
    if (allocRows[0].status !== 'active') {
      throw unprocessable('Only active allocations can be vacated');
    }

    const { rows } = await client.query<HostelAllocationRow>(
      `UPDATE hostel_allocations
          SET status = 'vacated', notes = COALESCE($3, notes), allocated_to = current_date
        WHERE id = $1 AND school_id = $2
        RETURNING id, school_id, student_id, NULL::text AS student_name, NULL::text AS admission_no,
                  hostel_id, NULL::text AS hostel_name, room_id, NULL::text AS room_no,
                  bed_no, allocated_from, allocated_to, monthly_fee, status, notes, created_at`,
      [id, actor.schoolId, input.notes ?? null],
    );

    // Decrement room.occupied.
    await client.query(
      `UPDATE hostel_rooms SET occupied = GREATEST(0, occupied - 1) WHERE id = $1`,
      [allocRows[0].room_id],
    );

    return toAllocationDto(rows[0]);
  });
}

export async function getCurrentAllocation(actor: AccessClaims, studentId: string) {
  // Current active allocation for a student. Multi-tenant.
  const { rows } = await query<HostelAllocationRow>(
    `SELECT ${ALLOC_SELECT}
       FROM hostel_allocations ha
       JOIN students s ON s.id = ha.student_id
       JOIN hostels h ON h.id = ha.hostel_id
       JOIN hostel_rooms hr ON hr.id = ha.room_id
      WHERE ha.student_id = $1 AND ha.school_id = $2
        AND ha.status = 'active' AND ha.deleted_at IS NULL
      LIMIT 1`,
    [studentId, actor.schoolId],
  );
  if (!rows[0]) throw notFound('No active allocation found for this student');
  return toAllocationDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// MESS MENU
// ═══════════════════════════════════════════════════════════════════════════

export async function getMessMenu(actor: AccessClaims, hostelId: string) {
  // Multi-tenant: verify hostel belongs to school.
  const { rows: hostelRows } = await query<{ id: string }>(
    `SELECT id FROM hostels WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [hostelId, actor.schoolId],
  );
  if (!hostelRows[0]) throw notFound('Hostel not found');

  const { rows } = await query<MessMenuRow>(
    `SELECT hostel_id, day_of_week, meal_type, menu_items, updated_at
       FROM mess_menus WHERE hostel_id = $1
      ORDER BY day_of_week, meal_type`,
    [hostelId],
  );
  return { data: rows.map(toMessMenuDto) };
}

export async function upsertMessMenu(actor: AccessClaims, input: UpsertMessMenuInput) {
  // Upsert each row; ON CONFLICT for idempotent updates. Transactional.
  return withTransaction(async (client) => {
    // Verify hostel belongs to this school (multi-tenant).
    const { rows: hostelRows } = await client.query<{ id: string }>(
      `SELECT id FROM hostels WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.hostelId, actor.schoolId],
    );
    if (!hostelRows[0]) throw notFound('Hostel not found');

    for (const item of input.menu) {
      await client.query(
        `INSERT INTO mess_menus (school_id, hostel_id, day_of_week, meal_type, menu_items, updated_at)
         VALUES ($1,$2,$3,$4,$5,now())
         ON CONFLICT (hostel_id, day_of_week, meal_type)
         DO UPDATE SET menu_items = EXCLUDED.menu_items, updated_at = now()`,
        [actor.schoolId, input.hostelId, item.dayOfWeek, item.mealType, item.menuItems],
      );
    }

    const { rows } = await client.query<MessMenuRow>(
      `SELECT hostel_id, day_of_week, meal_type, menu_items, updated_at
         FROM mess_menus WHERE hostel_id = $1 ORDER BY day_of_week, meal_type`,
      [input.hostelId],
    );
    return { data: rows.map(toMessMenuDto) };
  });
}
