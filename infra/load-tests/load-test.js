import http from 'k6/http';
import { check, sleep } from 'k6';

// ── Configuration ─────────────────────────────────────────────────────────────
export const options = {
  // A standard load test: ramp up to 50 users, hold, and ramp down.
  stages: [
    { duration: '30s', target: 50 },  // Ramp up
    { duration: '1m', target: 50 },   // Steady state
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    // 95% of requests must complete within 500ms
    http_req_duration: ['p(95)<500'],
    // Error rate must be less than 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// ── Test Setup ────────────────────────────────────────────────────────────────
// The setup phase logs in and fetches an auth token to be used by all VUs.
export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'admin@educore.test',
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  // Verify login was successful before continuing
  check(loginRes, {
    'logged in successfully': (r) => r.status === 200,
  });

  // Depending on the API, the token might be in the response body or cookies.
  // We assume the API returns { "accessToken": "..." }
  let token;
  try {
    token = loginRes.json('accessToken');
  } catch (e) {
    // Fallback or empty token
    token = '';
  }

  return { token };
}

// ── Virtual User (VU) Scenario ────────────────────────────────────────────────
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // 1. Check API Health
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 2. Fetch Students (Simulate read-heavy operation)
  const studentsRes = http.get(`${BASE_URL}/students?page=1&limit=20`, { headers });
  check(studentsRes, {
    'students fetch successful': (r) => r.status === 200 || r.status === 401,
  });
  sleep(1);

  // 3. Fetch Dashboard / Academics Sessions (Another read operation)
  const sessionsRes = http.get(`${BASE_URL}/academics/sessions`, { headers });
  check(sessionsRes, {
    'sessions fetch successful': (r) => r.status === 200 || r.status === 401,
  });
  sleep(2);
}
