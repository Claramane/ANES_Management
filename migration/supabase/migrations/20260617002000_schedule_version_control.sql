-- Phase 0: 版本控制核心表群（對齊 DoctorShiftManagement EAD-94 設計）
-- schedule_commits → schedule_heads → schedule_changes → schedule_branches → merge_requests

-- ─── 1. schedule_commits：整月快照 ─────────────────────────────────────────
CREATE TABLE public.schedule_commits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month        TEXT NOT NULL,             -- 'YYYY-MM'
  parent_id    UUID REFERENCES public.schedule_commits(id),
  branch_id    UUID,                      -- 填入後（EAD-95 intra-branch commits）
  author_id    UUID REFERENCES public.user_profiles(id),
  author_name  TEXT,
  message      TEXT,
  kind         TEXT NOT NULL DEFAULT 'manual'
                 CHECK (kind IN ('manual', 'restore', 'merge', 'branch_commit', 'generate')),
  snapshot     JSONB NOT NULL DEFAULT '{}',
  -- snapshot key 規範：
  --   '{user_id}_{YYYY-MM-DD}'          = shift_type（主班別）
  --   '{user_id}_{YYYY-MM-DD}:area'     = area_code
  --   '{user_id}_{YYYY-MM-DD}:special'  = special_type (SNP/LNP)
  merged_from_branch_id UUID,             -- kind='merge' 時填入來源 branch
  committed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedule_commits_month
  ON public.schedule_commits (month, committed_at DESC);
CREATE INDEX idx_schedule_commits_parent
  ON public.schedule_commits (parent_id);
CREATE INDEX idx_schedule_commits_branch
  ON public.schedule_commits (branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON TABLE public.schedule_commits IS
  '整月班表快照。snapshot JSONB 以 {user_id}_{date} 為 key 儲存班別。kind=merge 代表 branch 合併進 main 的事件。';

ALTER TABLE public.schedule_commits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schedule_commits FROM anon, authenticated;
GRANT SELECT ON public.schedule_commits TO authenticated;
GRANT ALL    ON public.schedule_commits TO service_role;

CREATE POLICY schedule_commits_read ON public.schedule_commits
  FOR SELECT TO authenticated USING (true);

-- ─── 2. schedule_heads：每月 HEAD 指標 ─────────────────────────────────────
CREATE TABLE public.schedule_heads (
  month      TEXT PRIMARY KEY,            -- 'YYYY-MM'
  commit_id  UUID NOT NULL REFERENCES public.schedule_commits(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_heads IS
  '每個月份的 HEAD commit 指標。merge_branch RPC 更新此表並刷新 monthly_schedules。';

CREATE TRIGGER schedule_heads_set_updated_at
  BEFORE UPDATE ON public.schedule_heads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.schedule_heads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schedule_heads FROM anon, authenticated;
GRANT SELECT ON public.schedule_heads TO authenticated;
GRANT ALL    ON public.schedule_heads TO service_role;

CREATE POLICY schedule_heads_read ON public.schedule_heads
  FOR SELECT TO authenticated USING (true);

-- ─── 3. schedule_changes：每格寫入 audit trail ─────────────────────────────
-- 所有對 monthly_schedules 的實際修改都記錄於此（trigger 或 RPC 寫入）
CREATE TABLE public.schedule_changes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID,                      -- NULL = main / system write；非 NULL = branch 上的 pending change
  user_id      UUID REFERENCES public.user_profiles(id),  -- 被排班的護理師
  date         DATE NOT NULL,
  field        TEXT NOT NULL,             -- 'shift_type' | 'area_code' | 'special_type'
  old_value    TEXT,
  new_value    TEXT,
  op           TEXT NOT NULL DEFAULT 'set'
                 CHECK (op IN ('set', 'delete')),
  actor_id     UUID REFERENCES public.user_profiles(id),  -- 操作者
  change_source TEXT,                     -- 'admin_edit' | 'generate' | 'restore' | 'merge' | 'swap' | 'cron'
  related_entity_table TEXT,             -- 連動還原用（如 shift_swap_requests）
  related_entity_id    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedule_changes_branch
  ON public.schedule_changes (branch_id, id)
  WHERE branch_id IS NOT NULL;
CREATE INDEX idx_schedule_changes_user_date
  ON public.schedule_changes (user_id, date);
CREATE INDEX idx_schedule_changes_date
  ON public.schedule_changes (date);

COMMENT ON COLUMN public.schedule_changes.branch_id IS
  'NULL = 已合併到 main 的操作；非 NULL = branch 上的 pending change，合併前不影響 monthly_schedules。';

ALTER TABLE public.schedule_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schedule_changes FROM anon, authenticated;
GRANT SELECT ON public.schedule_changes TO authenticated;
GRANT ALL    ON public.schedule_changes TO service_role;

CREATE POLICY schedule_changes_read ON public.schedule_changes
  FOR SELECT TO authenticated USING (true);

-- ─── 4. schedule_branches：草稿 / PR 分支 ──────────────────────────────────
CREATE TABLE public.schedule_branches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month                 TEXT NOT NULL,   -- 'YYYY-MM'
  name                  TEXT NOT NULL,
  kind                  TEXT NOT NULL
                          CHECK (kind IN ('admin_edit', 'swap_request', 'generate', 'other')),
  base_commit_id        UUID REFERENCES public.schedule_commits(id),
  head_commit_id        UUID REFERENCES public.schedule_commits(id),  -- intra-branch commits (EAD-95)
  owner_user_id         UUID NOT NULL REFERENCES public.user_profiles(id),
  status                TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'merged', 'closed')),
  related_entity_table  TEXT,
  related_entity_id     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  merged_at             TIMESTAMPTZ,
  merged_into_commit_id UUID REFERENCES public.schedule_commits(id),
  closed_at             TIMESTAMPTZ,
  closed_reason         TEXT,

  CONSTRAINT branches_merged_fields_ck CHECK (
    status <> 'merged'
    OR (merged_at IS NOT NULL AND merged_into_commit_id IS NOT NULL)
  ),
  CONSTRAINT branches_closed_fields_ck CHECK (
    status <> 'closed' OR closed_at IS NOT NULL
  )
);

-- merged_from_branch_id 在 schedule_commits 建完後可加 FK
ALTER TABLE public.schedule_commits
  ADD CONSTRAINT schedule_commits_merged_from_branch_fk
    FOREIGN KEY (merged_from_branch_id) REFERENCES public.schedule_branches(id);

-- branch_id FK in schedule_changes
ALTER TABLE public.schedule_changes
  ADD CONSTRAINT schedule_changes_branch_fk
    FOREIGN KEY (branch_id) REFERENCES public.schedule_branches(id) ON DELETE CASCADE;

-- branch_id FK in schedule_commits
ALTER TABLE public.schedule_commits
  ADD CONSTRAINT schedule_commits_branch_fk
    FOREIGN KEY (branch_id) REFERENCES public.schedule_branches(id);

CREATE INDEX idx_branches_month_status ON public.schedule_branches (month, status);
CREATE INDEX idx_branches_owner_status ON public.schedule_branches (owner_user_id, status);
CREATE INDEX idx_branches_related
  ON public.schedule_branches (related_entity_table, related_entity_id)
  WHERE related_entity_table IS NOT NULL;

CREATE TRIGGER schedule_branches_set_updated_at
  BEFORE UPDATE ON public.schedule_branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.schedule_branches IS
  'Git-like branch。branch state = base_commit.snapshot + replay(schedule_changes WHERE branch_id = X)。合併走 merge_branch RPC（3-way merge）。';

ALTER TABLE public.schedule_branches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schedule_branches FROM anon, authenticated;
GRANT SELECT ON public.schedule_branches TO authenticated;
GRANT ALL    ON public.schedule_branches TO service_role;

CREATE POLICY schedule_branches_read ON public.schedule_branches
  FOR SELECT TO authenticated USING (true);

-- ─── 5. merge_requests：PR ─────────────────────────────────────────────────
CREATE TABLE public.merge_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           UUID NOT NULL UNIQUE REFERENCES public.schedule_branches(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'approved', 'rejected', 'merged', 'withdrawn')),
  title               TEXT,
  description         TEXT,
  requested_by        UUID NOT NULL REFERENCES public.user_profiles(id),
  reviewed_by         UUID REFERENCES public.user_profiles(id),
  reviewed_at         TIMESTAMPTZ,
  review_note         TEXT,
  merge_strategy      TEXT,              -- 'fast_forward' | 'three_way'
  conflict_resolution JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merge_requests_status ON public.merge_requests (status, created_at DESC);

CREATE TRIGGER merge_requests_set_updated_at
  BEFORE UPDATE ON public.merge_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.merge_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merge_requests FROM anon, authenticated;
GRANT SELECT ON public.merge_requests TO authenticated;
GRANT ALL    ON public.merge_requests TO service_role;

CREATE POLICY merge_requests_read ON public.merge_requests
  FOR SELECT TO authenticated USING (true);
