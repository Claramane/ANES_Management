-- Phase 0: monthly_schedules — main branch 的物化 cache
-- 每一 row = 一位護理師在某天的排班狀態（HEAD / main 版本）
-- 版本歷史改由 schedule_commits + schedule_branches 管理，本表不含 version_id

CREATE TABLE public.monthly_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  shift_type   TEXT NOT NULL,  -- D=日班 A=小夜 N=大夜 C=中班 O=休假 K=早班 F=晚班 E=半班 B=書記日班
  area_code    TEXT,           -- OR / DR / 3F（A 班護理師工作分配）
  special_type TEXT,           -- SNP=小夜包班 / LNP=大夜包班
  work_time    TEXT,           -- 工作時間紀錄（選填）
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT monthly_schedules_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX idx_monthly_schedules_date
  ON public.monthly_schedules (date);
CREATE INDEX idx_monthly_schedules_user_date
  ON public.monthly_schedules (user_id, date);
-- 月份查詢走 date range（WHERE date >= '2026-06-01' AND date < '2026-07-01'）
-- date_trunc 非 IMMUTABLE，不能建函式索引；date 索引已足夠

COMMENT ON TABLE public.monthly_schedules IS
  'main branch 物化 cache：每位護理師每日一 row，代表目前對外可見的班表（HEAD）。版本歷史與草稿由 schedule_commits / schedule_branches 管理，合併時由 merge_branch RPC 刷新本表。';

CREATE TRIGGER monthly_schedules_set_updated_at
  BEFORE UPDATE ON public.monthly_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.monthly_schedules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.monthly_schedules FROM anon, authenticated;
GRANT SELECT ON public.monthly_schedules TO authenticated;
GRANT ALL    ON public.monthly_schedules TO service_role;

-- 所有登入使用者可讀（護理師看自己的班 / 護理長看全月）
CREATE POLICY monthly_schedules_authenticated_read ON public.monthly_schedules
  FOR SELECT TO authenticated USING (true);

-- 寫入只透過 SECURITY DEFINER RPC（merge_branch / generate_schedule），前端不直接寫
-- admin / head_nurse 亦透過 RPC，不開放 direct INSERT/UPDATE
