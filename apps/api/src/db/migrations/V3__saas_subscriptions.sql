-- V3__saas_subscriptions.sql
-- Create subscription plans and update schools table for SaaS

CREATE TABLE IF NOT EXISTS subscription_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  monthly_fee  BIGINT NOT NULL DEFAULT 0,
  max_students INT,
  max_teachers INT,
  features     TEXT[],
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default plans
INSERT INTO subscription_plans (name, monthly_fee, max_students, max_teachers, features) VALUES
  ('Starter', 500000, 300, 15, ARRAY['core_erp', 'basic_support']),
  ('Professional', 1500000, 1000, 50, ARRAY['core_erp', 'library', 'transport', 'priority_support']),
  ('Enterprise', 3000000, NULL, NULL, ARRAY['core_erp', 'library', 'transport', 'hostel', 'inventory', 'dedicated_support'])
ON CONFLICT (name) DO NOTHING;

-- Alter schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES subscription_plans(id);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled'));
ALTER TABLE schools ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Assign existing schools to 'Enterprise' plan and 'active' status
DO $$
DECLARE
  v_ent_plan UUID;
BEGIN
  SELECT id INTO v_ent_plan FROM subscription_plans WHERE name = 'Enterprise' LIMIT 1;
  IF v_ent_plan IS NOT NULL THEN
    UPDATE schools SET plan_id = v_ent_plan, subscription_status = 'active', trial_ends_at = NULL WHERE plan_id IS NULL;
  END IF;
END $$;
