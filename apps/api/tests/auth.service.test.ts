/**
 * Unit tests for apps/api/src/modules/auth/auth.service.ts
 *
 * All external dependencies (database, bcrypt, jwt) are fully mocked so these
 * tests run without a real database or network connection.
 *
 * IMPORTANT: env vars must be set before any module that transitively loads
 * env.ts is imported — Vitest hoists vi.mock() calls but top-level import
 * statements run after vi.mock() factories, so the env assignment below fires
 * before env.ts's safeParse(process.env).
 */

// ── 1. Set required env vars before any import that loads env.ts ─────────────
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['JWT_ACCESS_SECRET'] = 'a'.repeat(32);
process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(32);
process.env['NODE_ENV'] = 'test';

// ── 2. Vitest imports ─────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── 3. Mock all external dependencies BEFORE importing the module under test ──
vi.mock('../src/config/db.js', () => ({
  query: vi.fn(),
  withTransaction: vi.fn((fn: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
    fn({ query: vi.fn() }),
  ),
}));

vi.mock('../src/utils/password.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2b$hashed'),
  verifyPassword: vi.fn(),
}));

vi.mock('../src/utils/jwt.js', () => ({
  signAccessToken: vi.fn().mockReturnValue('mock.access.token'),
  newRefreshToken: vi.fn().mockReturnValue({ raw: 'raw-refresh', hash: 'hashed-refresh' }),
  hashRefresh: vi.fn().mockReturnValue('hashed-refresh'),
}));

// Mock createDefaultRoles so it does not execute real SQL inside the transaction
vi.mock('../src/modules/schools/defaultRoles.js', () => ({
  createDefaultRoles: vi.fn().mockResolvedValue({ super_admin: 'role-uuid-super-admin' }),
}));

// ── 4. Import the module under test and the mocked utilities ─────────────────
import * as authService from '../src/modules/auth/auth.service.js';
import * as db from '../src/config/db.js';
import * as passwordUtils from '../src/utils/password.js';
import * as jwtUtils from '../src/utils/jwt.js';
import { HttpError } from '../src/utils/http-error.js';

// ── Typed helpers so TypeScript doesn't complain about vi.fn() ────────────────
const mockQuery = db.query as ReturnType<typeof vi.fn>;
const mockWithTransaction = db.withTransaction as ReturnType<typeof vi.fn>;
const mockVerifyPassword = passwordUtils.verifyPassword as ReturnType<typeof vi.fn>;
const mockSignAccessToken = jwtUtils.signAccessToken as ReturnType<typeof vi.fn>;
const mockNewRefreshToken = jwtUtils.newRefreshToken as ReturnType<typeof vi.fn>;

// ── Reusable test fixture ─────────────────────────────────────────────────────
const ACTIVE_USER = {
  id: 'user-uuid',
  school_id: 'school-uuid',
  password_hash: '$2b$real_hash',
  is_active: true,
  full_name: 'Alice Admin',
  role_name: 'principal',
  permissions: ['students:read', 'fees:read'],
};

// ─────────────────────────────────────────────────────────────────────────────
describe('auth.service — login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: newRefreshToken always returns the same stub values
    mockNewRefreshToken.mockReturnValue({ raw: 'raw-refresh', hash: 'hashed-refresh' });
    // Default signAccessToken return
    mockSignAccessToken.mockReturnValue('mock.access.token');
  });

  it('returns accessToken, refreshToken, and user on valid credentials', async () => {
    // Arrange: user found, password correct, subsequent queries succeed
    mockQuery
      .mockResolvedValueOnce({ rows: [ACTIVE_USER] }) // SELECT user
      .mockResolvedValueOnce({ rows: [] })            // INSERT login_history (fire-and-forget)
      .mockResolvedValueOnce({ rows: [] })            // INSERT refresh_tokens
      .mockResolvedValueOnce({ rows: [] });           // UPDATE last_login_at
    mockVerifyPassword.mockResolvedValue(true);

    // Act
    const result = await authService.login(
      { email: 'alice@school.test', password: 'correct-pass' },
      { ip: '127.0.0.1', userAgent: 'test-agent' },
    );

    // Assert tokens and user shape
    expect(result.accessToken).toBe('mock.access.token');
    expect(result.refreshToken).toBe('raw-refresh');
    expect(result.user.id).toBe(ACTIVE_USER.id);
    expect(result.user.name).toBe(ACTIVE_USER.full_name);
    expect(result.user.role).toBe(ACTIVE_USER.role_name);

    // Assert signAccessToken was called with the correct payload shape
    expect(mockSignAccessToken).toHaveBeenCalledWith({
      sub: ACTIVE_USER.id,
      schoolId: ACTIVE_USER.school_id,
      role: ACTIVE_USER.role_name,
      permissions: ACTIVE_USER.permissions,
    });
  });

  it('throws unauthorized (401) when user is not found', async () => {
    // Arrange: no user row returned
    mockQuery
      .mockResolvedValueOnce({ rows: [] })  // SELECT user → empty
      .mockResolvedValue({ rows: [] });     // login_history (fire-and-forget)
    mockVerifyPassword.mockResolvedValue(false);

    // Act & Assert
    await expect(
      authService.login({ email: 'nobody@school.test', password: 'any-pass' }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof HttpError && err.status === 401,
    );
  });

  it('throws unauthorized (401) when password is wrong', async () => {
    // Arrange: user found but password check fails
    mockQuery
      .mockResolvedValueOnce({ rows: [ACTIVE_USER] })
      .mockResolvedValue({ rows: [] });
    mockVerifyPassword.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'alice@school.test', password: 'wrong-pass' }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof HttpError && err.status === 401,
    );
  });

  it('throws unauthorized (401) when user is_active is false', async () => {
    // Arrange: user found, password matches, but account is deactivated
    const inactiveUser = { ...ACTIVE_USER, is_active: false };
    mockQuery
      .mockResolvedValueOnce({ rows: [inactiveUser] })
      .mockResolvedValue({ rows: [] });
    mockVerifyPassword.mockResolvedValue(true);

    await expect(
      authService.login({ email: 'alice@school.test', password: 'correct-pass' }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof HttpError && err.status === 401,
    );
  });

  it('writes a login_history INSERT for both a successful and a failed login', async () => {
    // ── Successful login ──────────────────────────────────────────────────────
    mockQuery
      .mockResolvedValueOnce({ rows: [ACTIVE_USER] }) // SELECT user
      .mockResolvedValue({ rows: [] });               // all subsequent queries
    mockVerifyPassword.mockResolvedValue(true);

    await authService.login({ email: 'alice@school.test', password: 'correct-pass' });

    // Allow the fire-and-forget login_history promise to settle
    await new Promise((resolve) => setImmediate(resolve));

    const successLoginHistoryCalls = mockQuery.mock.calls.filter(
      (args: unknown[]) =>
        typeof args[0] === 'string' && args[0].includes('INSERT INTO login_history'),
    );
    expect(successLoginHistoryCalls.length).toBeGreaterThanOrEqual(1);
    // The fifth element (index 3) of the VALUES is the `success` flag
    const successArgs = successLoginHistoryCalls[0][1] as unknown[];
    expect(successArgs[3]).toBe(true);

    vi.clearAllMocks();

    // ── Failed login (wrong password) ─────────────────────────────────────────
    mockQuery
      .mockResolvedValueOnce({ rows: [ACTIVE_USER] })
      .mockResolvedValue({ rows: [] });
    mockVerifyPassword.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'alice@school.test', password: 'wrong-pass' }),
    ).rejects.toBeInstanceOf(HttpError);

    await new Promise((resolve) => setImmediate(resolve));

    const failLoginHistoryCalls = mockQuery.mock.calls.filter(
      (args: unknown[]) =>
        typeof args[0] === 'string' && args[0].includes('INSERT INTO login_history'),
    );
    expect(failLoginHistoryCalls.length).toBeGreaterThanOrEqual(1);
    const failArgs = failLoginHistoryCalls[0][1] as unknown[];
    expect(failArgs[3]).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('auth.service — register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNewRefreshToken.mockReturnValue({ raw: 'raw-refresh', hash: 'hashed-refresh' });
    mockSignAccessToken.mockReturnValue('mock.access.token');
  });

  it('creates school + roles + user in a transaction and returns tokens with super_admin role', async () => {
    // Arrange: withTransaction calls fn with a mock client whose query returns
    // appropriate rows for each step inside register().
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })                            // dupCode check → no duplicate
        .mockResolvedValueOnce({ rows: [{ id: 'school-uuid' }] })       // INSERT schools RETURNING id
        // createDefaultRoles is mocked at module level — no client.query calls for roles
        .mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }] }),        // INSERT users RETURNING id
    };
    mockWithTransaction.mockImplementation(
      (fn: (client: typeof mockClient) => Promise<unknown>) => fn(mockClient),
    );
    // After transaction, query is called for INSERT refresh_tokens
    mockQuery.mockResolvedValue({ rows: [] });

    // Act
    const result = await authService.register({
      schoolName: 'Test School',
      schoolCode: 'TST01',
      adminName: 'Alice Admin',
      email: 'alice@test.edu',
      password: 'SecurePass1!',
    });

    // Assert token shape
    expect(result.accessToken).toBe('mock.access.token');
    expect(result.refreshToken).toBe('raw-refresh');

    // Assert super_admin role and correct user shape
    expect(result.user.role).toBe('super_admin');
    expect(result.user.id).toBe('user-uuid');
    expect(result.user.schoolId).toBe('school-uuid');
    expect(result.user.name).toBe('Alice Admin');

    // signAccessToken must be called with super_admin + wildcard permissions
    expect(mockSignAccessToken).toHaveBeenCalledWith({
      sub: 'user-uuid',
      schoolId: 'school-uuid',
      role: 'super_admin',
      permissions: ['*'],
    });
  });

  it('throws conflict (409) when the school code is already in use', async () => {
    // Arrange: duplicate code check returns a row
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }), // SELECT 1 FROM schools WHERE code = $1
    };
    mockWithTransaction.mockImplementation(
      (fn: (client: typeof mockClient) => Promise<unknown>) => fn(mockClient),
    );

    // Act & Assert
    await expect(
      authService.register({
        schoolName: 'Duplicate School',
        schoolCode: 'DUP01',
        adminName: 'Bob',
        email: 'bob@dup.edu',
        password: 'SecurePass1!',
      }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof HttpError && err.status === 409,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('auth.service — logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when no token is provided', async () => {
    // logout(undefined) should resolve silently
    await expect(authService.logout(undefined)).resolves.toBeUndefined();
    // No DB calls should be made
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('revokes the refresh token family via an UPDATE query', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    await authService.logout('raw-token');

    // At least one call to query must contain UPDATE refresh_tokens
    const updateCalls = mockQuery.mock.calls.filter(
      (args: unknown[]) =>
        typeof args[0] === 'string' && args[0].includes('UPDATE refresh_tokens'),
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    // The token hash should be passed as the first parameter
    const params = updateCalls[0][1] as unknown[];
    expect(params[0]).toBe('hashed-refresh'); // hashRefresh is mocked to return 'hashed-refresh'
  });
});
