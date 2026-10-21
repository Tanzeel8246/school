ALTER TABLE subscription_plans RENAME COLUMN monthly_fee TO fee;
ALTER TABLE subscription_plans ADD COLUMN billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'lifetime'));

CREATE TABLE IF NOT EXISTS subscription_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_id        UUID NOT NULL REFERENCES subscription_plans(id),
  requested_by   UUID REFERENCES users(id),
  transaction_id TEXT,
  screenshot_url TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DELETE FROM subscription_plans;

INSERT INTO subscription_plans (name, fee, billing_cycle, max_students, max_teachers, features) VALUES
    ('Starter (Monthly)', 500000, 'monthly', 500, 20, ARRAY['students', 'attendance', 'fees']),
    ('Professional (Monthly)', 1500000, 'monthly', 2000, 100, ARRAY['students', 'attendance', 'fees', 'exams', 'payroll']),
    ('Enterprise (Monthly)', 3000000, 'monthly', NULL, NULL, ARRAY['students', 'attendance', 'fees', 'exams', 'payroll', 'library', 'transport', 'hostel']),
    ('Starter (Yearly)', 5000000, 'yearly', 500, 20, ARRAY['students', 'attendance', 'fees']),
    ('Professional (Yearly)', 15000000, 'yearly', 2000, 100, ARRAY['students', 'attendance', 'fees', 'exams', 'payroll']),
    ('Enterprise (Yearly)', 30000000, 'yearly', NULL, NULL, ARRAY['students', 'attendance', 'fees', 'exams', 'payroll', 'library', 'transport', 'hostel']),
    ('Lifetime Basic', 50000000, 'lifetime', 1000, 50, ARRAY['students', 'attendance', 'fees', 'exams']),
    ('Lifetime Ultimate', 150000000, 'lifetime', NULL, NULL, ARRAY['students', 'attendance', 'fees', 'exams', 'payroll', 'library', 'transport', 'hostel']);

UPDATE schools SET plan_id = (SELECT id FROM subscription_plans WHERE name = 'Professional (Monthly)') WHERE code = 'DPS';
