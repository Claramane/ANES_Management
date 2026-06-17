-- Phase 0: shift_rules — 工時規則表
-- 用於換班驗證（validate_swap）和排班生成的工時限制
-- 規則以 identity（護理身份別）為單位設定

CREATE TABLE public.shift_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity         TEXT NOT NULL UNIQUE, -- 麻醉專科護理師 / 恢復室護理師 / 麻醉科Leader / 麻醉科書記
  -- 連班限制
  max_consecutive_work_days  INT NOT NULL DEFAULT 6,   -- 最多連續上班天數
  min_rest_hours_after_night INT NOT NULL DEFAULT 11,  -- 大夜班後最少休息時數
  min_rest_hours_after_eve   INT NOT NULL DEFAULT 8,   -- 小夜班後最少休息時數
  -- 夜班限制
  max_night_per_month        INT,                      -- 每月最多大夜次數（NULL=不限）
  max_eve_per_month          INT,                      -- 每月最多小夜次數（NULL=不限）
  -- 換班限制
  swap_allowed_shift_types   TEXT[] NOT NULL DEFAULT '{}', -- 允許換班的班別清單（空=全允許）
  -- 備用欄位
  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER shift_rules_set_updated_at
  BEFORE UPDATE ON public.shift_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.shift_rules IS
  '工時規則，以護理身份別為單位。validate_swap PL/pgSQL 在換班驗證時讀取，排班生成 Worker 亦參考此表。';

ALTER TABLE public.shift_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shift_rules FROM anon, authenticated;
GRANT SELECT ON public.shift_rules TO authenticated;
GRANT ALL    ON public.shift_rules TO service_role;

CREATE POLICY shift_rules_read ON public.shift_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY shift_rules_admin_write ON public.shift_rules
  FOR ALL TO authenticated
  USING (public.has_permission('manage_schedule'))
  WITH CHECK (public.has_permission('manage_schedule'));

-- 初始規則（根據現有 ANES 系統的 identity 分類）
INSERT INTO public.shift_rules (identity, max_consecutive_work_days, min_rest_hours_after_night, min_rest_hours_after_eve, swap_allowed_shift_types) VALUES
  ('麻醉專科護理師', 6, 11, 8, ARRAY['D','A','N','C']),
  ('恢復室護理師',   6, 11, 8, ARRAY['A','K','C','F']),
  ('麻醉科Leader',  6, 11, 8, ARRAY['A','E']),
  ('麻醉科書記',    6, 11, 8, ARRAY['B','E']);
