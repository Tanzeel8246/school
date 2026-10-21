/** Shared option lists for the Staff module. */
// staff_type is free-text in the DB; these cover the seeded + blueprint categories.
export const STAFF_TYPES = ['teacher', 'admin', 'accountant', 'clerk', 'security', 'driver', 'helper'] as const;

export const LEAVE_TYPES = ['casual', 'sick', 'annual', 'unpaid'] as const;

// Matches the backend attendance status enum (present|absent|leave|late|half_day).
export const ATTENDANCE_STATUSES = ['present', 'absent', 'leave', 'late', 'half_day'] as const;
