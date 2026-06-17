-- Phase 5: shift_swap_requests + 調班 RPCs
-- ANES 調班系統：以 user_id UUID 識別護理師，一人一日一筆 monthly_schedules
-- 兩段式審核：pending_target → pending_admin → approved / rejected / cancelled / invalidated
-- area_code 隨班別一起對調

-- ─── 1. app_private 內部 branch helpers ──────────────────────────────────────
-- 供 RPC 內部使用，跳過公開函式的 manage_schedule 與 owner 權限檢查

CREATE OR REPLACE FUNCTION app_private.open_branch_internal(
  p_month                TEXT,
  p_kind                 TEXT,
  p_name                 TEXT,
  p_owner                UUID,
  p_related_entity_table TEXT DEFAULT NULL,
  p_related_entity_id    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_head_commit_id UUID;
  v_branch_id      UUID;
BEGIN
  SELECT commit_id INTO v_head_commit_id
  FROM public.schedule_heads
  WHERE month = p_month;

  INSERT INTO public.schedule_branches
    (month, name, kind, base_commit_id, owner_user_id, status,
     related_entity_table, related_entity_id)
  VALUES
    (p_month, p_name, p_kind, v_head_commit_id, p_owner, 'open',
     p_related_entity_table, p_related_entity_id)
  RETURNING id INTO v_branch_id;

  RETURN v_branch_id;
END;
$$;

REVOKE ALL ON FUNCTION app_private.open_branch_internal(TEXT, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.open_branch_internal(TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_private.write_to_branch_internal(
  p_branch_id UUID,
  p_user_id   UUID,
  p_date      DATE,
  p_field     TEXT,
  p_op        TEXT,
  p_old_value TEXT,
  p_new_value TEXT,
  p_actor_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.schedule_changes
    (branch_id, user_id, date, field, op, old_value, new_value, actor_id,
     change_source,
     related_entity_table, related_entity_id)
  VALUES
    (p_branch_id, p_user_id, p_date, p_field, p_op, p_old_value, p_new_value,
     p_actor_id,
     current_setting('app.change_source',        true),
     current_setting('app.related_entity_table', true),
     current_setting('app.related_entity_id',    true));
END;
$$;

REVOKE ALL ON FUNCTION app_private.write_to_branch_internal(UUID, UUID, DATE, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.write_to_branch_internal(UUID, UUID, DATE, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_private.close_branch_internal(
  p_branch_id UUID,
  p_reason    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.schedule_branches
  SET status     = 'closed',
      closed_at  = now(),
      closed_reason = p_reason,
      updated_at = now()
  WHERE id = p_branch_id;

  UPDATE public.merge_requests
  SET status     = 'withdrawn',
      updated_at = now()
  WHERE branch_id = p_branch_id AND status = 'open';
END;
$$;

REVOKE ALL ON FUNCTION app_private.close_branch_internal(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.close_branch_internal(UUID, TEXT) TO service_role;

-- ─── 2. shift_swap_requests 表 ──────────────────────────────────────────────

CREATE TABLE public.shift_swap_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 申請者
  requester_user_id    UUID NOT NULL REFERENCES public.user_profiles(id),
  requester_full_name  TEXT NOT NULL,
  requester_date       DATE NOT NULL,
  requester_shift_type TEXT NOT NULL,
  requester_area_code  TEXT,
  -- 被申請者
  target_user_id       UUID NOT NULL REFERENCES public.user_profiles(id),
  target_full_name     TEXT NOT NULL,
  target_date          DATE NOT NULL,
  target_shift_type    TEXT NOT NULL,
  target_area_code     TEXT,
  -- 換後預覽：{"requester_after": {"shift_type":"A","area_code":"3F"}, "target_after": {...}}
  swap_plan            JSONB,
  -- 審核狀態
  status               TEXT NOT NULL DEFAULT 'pending_target'
                         CHECK (status IN (
                           'pending_target', 'pending_admin',
                           'approved',
                           'rejected_by_target', 'rejected_by_admin',
                           'invalidated', 'cancelled'
                         )),
  -- 關聯 branch / merge_request
  branch_ids           UUID[] NOT NULL DEFAULT '{}',
  merge_request_ids    UUID[] NOT NULL DEFAULT '{}',
  -- 其他
  memo                 TEXT,
  invalidated_reason   TEXT,
  reviewed_by_target   UUID REFERENCES public.user_profiles(id),
  target_reviewed_at   TIMESTAMPTZ,
  reviewed_by_admin    UUID REFERENCES public.user_profiles(id),
  admin_reviewed_at    TIMESTAMPTZ,
  admin_review_note    TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 同一人同一日只能有一筆進行中的換班申請（雙向鎖定）
CREATE UNIQUE INDEX ssr_requester_active_unique
  ON public.shift_swap_requests (requester_user_id, requester_date)
  WHERE status IN ('pending_target', 'pending_admin');

CREATE UNIQUE INDEX ssr_target_active_unique
  ON public.shift_swap_requests (target_user_id, target_date)
  WHERE status IN ('pending_target', 'pending_admin');

CREATE INDEX ssr_status    ON public.shift_swap_requests (status);
CREATE INDEX ssr_requester ON public.shift_swap_requests (requester_user_id, created_at DESC);
CREATE INDEX ssr_target    ON public.shift_swap_requests (target_user_id, created_at DESC);

CREATE TRIGGER shift_swap_requests_set_updated_at
  BEFORE UPDATE ON public.shift_swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.shift_swap_requests IS
  '調班申請：兩段式審核（被申請者同意 → admin 核准 → merge branch）。area_code 隨班別一起對調。';

-- ─── 3. app_private.validate_swap ───────────────────────────────────────────
-- 驗證換班可行性：雙方身份 swap_allowed_shift_types 互相相容

CREATE OR REPLACE FUNCTION app_private.validate_swap(
  p_requester_id   UUID,
  p_requester_date DATE,
  p_target_id      UUID,
  p_target_date    DATE
)
RETURNS TABLE (ok BOOLEAN, error_code TEXT, error_msg TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_shift   TEXT;
  v_req_area    TEXT;
  v_req_ident   TEXT;
  v_tgt_shift   TEXT;
  v_tgt_area    TEXT;
  v_tgt_ident   TEXT;
  v_req_allowed TEXT[];
  v_tgt_allowed TEXT[];
BEGIN
  -- 不能和自己換班
  IF p_requester_id = p_target_id THEN
    RETURN QUERY SELECT false, 'SELF_SWAP'::TEXT, '不能和自己換班'::TEXT;
    RETURN;
  END IF;

  -- 取申請者排班 + 身份
  SELECT ms.shift_type, ms.area_code, up.identity
  INTO v_req_shift, v_req_area, v_req_ident
  FROM public.monthly_schedules ms
  JOIN public.user_profiles up ON up.id = ms.user_id
  WHERE ms.user_id = p_requester_id AND ms.date = p_requester_date
    AND up.is_active = true;

  IF v_req_shift IS NULL THEN
    RETURN QUERY SELECT false, 'NO_SCHEDULE_REQUESTER'::TEXT,
      '申請者在指定日期沒有排班記錄'::TEXT;
    RETURN;
  END IF;

  -- 取被申請者排班 + 身份
  SELECT ms.shift_type, ms.area_code, up.identity
  INTO v_tgt_shift, v_tgt_area, v_tgt_ident
  FROM public.monthly_schedules ms
  JOIN public.user_profiles up ON up.id = ms.user_id
  WHERE ms.user_id = p_target_id AND ms.date = p_target_date
    AND up.is_active = true;

  IF v_tgt_shift IS NULL THEN
    RETURN QUERY SELECT false, 'NO_SCHEDULE_TARGET'::TEXT,
      '被申請者在指定日期沒有排班記錄'::TEXT;
    RETURN;
  END IF;

  -- 取班別規則（依 identity）
  SELECT swap_allowed_shift_types INTO v_req_allowed
  FROM public.shift_rules WHERE identity = v_req_ident;

  SELECT swap_allowed_shift_types INTO v_tgt_allowed
  FROM public.shift_rules WHERE identity = v_tgt_ident;

  -- 申請者目前班別是否在可換班清單
  IF v_req_allowed IS NOT NULL
     AND NOT (v_req_shift = ANY(v_req_allowed)) THEN
    RETURN QUERY SELECT false, 'SHIFT_NOT_SWAPPABLE_REQUESTER'::TEXT,
      format('申請者的 %s 班不在可換班清單中', v_req_shift)::TEXT;
    RETURN;
  END IF;

  -- 被申請者目前班別是否在可換班清單
  IF v_tgt_allowed IS NOT NULL
     AND NOT (v_tgt_shift = ANY(v_tgt_allowed)) THEN
    RETURN QUERY SELECT false, 'SHIFT_NOT_SWAPPABLE_TARGET'::TEXT,
      format('被申請者的 %s 班不在可換班清單中', v_tgt_shift)::TEXT;
    RETURN;
  END IF;

  -- 申請者換來的班別與其身份相符？
  IF v_req_allowed IS NOT NULL
     AND NOT (v_tgt_shift = ANY(v_req_allowed)) THEN
    RETURN QUERY SELECT false, 'INCOMPATIBLE_SHIFT_FOR_REQUESTER'::TEXT,
      format('申請者身份不支援 %s 班', v_tgt_shift)::TEXT;
    RETURN;
  END IF;

  -- 被申請者換來的班別與其身份相符？
  IF v_tgt_allowed IS NOT NULL
     AND NOT (v_req_shift = ANY(v_tgt_allowed)) THEN
    RETURN QUERY SELECT false, 'INCOMPATIBLE_SHIFT_FOR_TARGET'::TEXT,
      format('被申請者身份不支援 %s 班', v_req_shift)::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION app_private.validate_swap(UUID, DATE, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.validate_swap(UUID, DATE, UUID, DATE) TO service_role;

-- ─── 4. submit_swap_request ──────────────────────────────────────────────────
-- 申請者（auth.uid()）向 target_user_id 發起換班申請
-- 每個受影響的月份開一個 swap_request branch，寫入 shift_type + area_code 的變更

CREATE OR REPLACE FUNCTION public.submit_swap_request(
  p_target_user_id UUID,
  p_requester_date DATE,
  p_target_date    DATE,
  p_memo           TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id  UUID := auth.uid();
  v_req_name      TEXT;
  v_tgt_name      TEXT;
  v_req_shift     TEXT;
  v_req_area      TEXT;
  v_tgt_shift     TEXT;
  v_tgt_area      TEXT;
  v_req_month     TEXT := to_char(p_requester_date, 'YYYY-MM');
  v_tgt_month     TEXT := to_char(p_target_date,    'YYYY-MM');
  v_swap_id       UUID := gen_random_uuid();
  v_branch_ids    UUID[] := '{}';
  v_mr_ids        UUID[] := '{}';
  v_branch_req    UUID;
  v_branch_tgt    UUID;
  v_mr_id         UUID;
  v_val_ok        BOOLEAN;
  v_val_err       TEXT;
  v_val_msg       TEXT;
  v_branch_name   TEXT;
BEGIN
  -- 必須登入
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF v_requester_id = p_target_user_id THEN
    RAISE EXCEPTION 'SELF_SWAP';
  END IF;

  -- 取申請者姓名（確認帳號存在且啟用）
  SELECT full_name INTO v_req_name
  FROM public.user_profiles
  WHERE id = v_requester_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;

  -- 取被申請者姓名
  SELECT full_name INTO v_tgt_name
  FROM public.user_profiles
  WHERE id = p_target_user_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_USER_NOT_FOUND'; END IF;

  -- 驗證換班合法性
  SELECT ok, error_code, error_msg
  INTO v_val_ok, v_val_err, v_val_msg
  FROM app_private.validate_swap(
    v_requester_id, p_requester_date, p_target_user_id, p_target_date
  );
  IF NOT v_val_ok THEN
    RAISE EXCEPTION USING MESSAGE = v_val_msg, ERRCODE = 'P0001', HINT = v_val_err;
  END IF;

  -- 取目前排班快照（validate_swap 已確認存在）
  SELECT shift_type, area_code INTO v_req_shift, v_req_area
  FROM public.monthly_schedules
  WHERE user_id = v_requester_id AND date = p_requester_date;

  SELECT shift_type, area_code INTO v_tgt_shift, v_tgt_area
  FROM public.monthly_schedules
  WHERE user_id = p_target_user_id AND date = p_target_date;

  -- 設定 audit GUC（write_to_branch_internal 會讀取）
  PERFORM set_config('app.change_source',        'swap_request',          true);
  PERFORM set_config('app.related_entity_table', 'shift_swap_requests',   true);
  PERFORM set_config('app.related_entity_id',     v_swap_id::TEXT,        true);

  v_branch_name := format('%s 與 %s 換班（%s ↔ %s）',
    v_req_name, v_tgt_name, p_requester_date::TEXT, p_target_date::TEXT);

  -- 開申請者月份的 branch
  v_branch_req := app_private.open_branch_internal(
    v_req_month, 'swap_request', v_branch_name, v_requester_id,
    'shift_swap_requests', v_swap_id::TEXT
  );
  v_branch_ids := v_branch_ids || v_branch_req;

  -- 若跨月，開被申請者月份的 branch
  IF v_req_month <> v_tgt_month THEN
    v_branch_tgt := app_private.open_branch_internal(
      v_tgt_month, 'swap_request', v_branch_name, v_requester_id,
      'shift_swap_requests', v_swap_id::TEXT
    );
    v_branch_ids := v_branch_ids || v_branch_tgt;
  ELSE
    v_branch_tgt := v_branch_req;
  END IF;

  -- 寫申請者日期的 branch changes（shift_type + area_code）
  PERFORM app_private.write_to_branch_internal(
    v_branch_req, v_requester_id, p_requester_date,
    'shift_type', 'set', v_req_shift, v_tgt_shift, v_requester_id
  );
  IF v_req_area IS DISTINCT FROM v_tgt_area THEN
    PERFORM app_private.write_to_branch_internal(
      v_branch_req, v_requester_id, p_requester_date,
      'area_code', 'set', v_req_area, v_tgt_area, v_requester_id
    );
  END IF;

  -- 寫被申請者日期的 branch changes（shift_type + area_code）
  PERFORM app_private.write_to_branch_internal(
    v_branch_tgt, p_target_user_id, p_target_date,
    'shift_type', 'set', v_tgt_shift, v_req_shift, v_requester_id
  );
  IF v_tgt_area IS DISTINCT FROM v_req_area THEN
    PERFORM app_private.write_to_branch_internal(
      v_branch_tgt, p_target_user_id, p_target_date,
      'area_code', 'set', v_tgt_area, v_req_area, v_requester_id
    );
  END IF;

  -- 建 merge_requests（每個 branch 一個）
  INSERT INTO public.merge_requests (branch_id, status, title, description, requested_by)
  VALUES (v_branch_req, 'open', v_branch_name, p_memo, v_requester_id)
  RETURNING id INTO v_mr_id;
  v_mr_ids := v_mr_ids || v_mr_id;

  IF v_req_month <> v_tgt_month THEN
    INSERT INTO public.merge_requests (branch_id, status, title, description, requested_by)
    VALUES (v_branch_tgt, 'open', v_branch_name, p_memo, v_requester_id)
    RETURNING id INTO v_mr_id;
    v_mr_ids := v_mr_ids || v_mr_id;
  END IF;

  -- 插入換班申請（使用預先產生的 v_swap_id，讓 GUC 和 branch related_entity_id 一致）
  INSERT INTO public.shift_swap_requests (
    id,
    requester_user_id, requester_full_name, requester_date,
    requester_shift_type, requester_area_code,
    target_user_id, target_full_name, target_date,
    target_shift_type, target_area_code,
    swap_plan,
    status, branch_ids, merge_request_ids, memo
  ) VALUES (
    v_swap_id,
    v_requester_id, v_req_name, p_requester_date,
    v_req_shift, v_req_area,
    p_target_user_id, v_tgt_name, p_target_date,
    v_tgt_shift, v_tgt_area,
    jsonb_build_object(
      'requester_after', jsonb_build_object('shift_type', v_tgt_shift, 'area_code', v_tgt_area),
      'target_after',    jsonb_build_object('shift_type', v_req_shift, 'area_code', v_req_area)
    ),
    'pending_target', v_branch_ids, v_mr_ids, p_memo
  );

  RETURN v_swap_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_swap_request(UUID, DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_swap_request(UUID, DATE, DATE, TEXT) TO authenticated;

-- ─── 5. decide_swap_request_as_target ────────────────────────────────────────
-- 被申請者同意或拒絕
-- approved → 重驗一次（班表可能已變動），通過 → pending_admin，失敗 → invalidated
-- rejected → close branches → rejected_by_target

CREATE OR REPLACE FUNCTION public.decide_swap_request_as_target(
  p_id       UUID,
  p_decision TEXT   -- 'approved' | 'rejected'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor   UUID := auth.uid();
  v_req     public.shift_swap_requests%ROWTYPE;
  v_val_ok  BOOLEAN;
  v_val_err TEXT;
  v_val_msg TEXT;
  v_bid     UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_req FROM public.shift_swap_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  -- 只有被申請者可以決定
  IF v_req.target_user_id <> v_actor THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- 必須是 pending_target 狀態
  IF v_req.status <> 'pending_target' THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_STATUS',
      DETAIL = format('current status is %s', v_req.status);
  END IF;

  IF p_decision = 'rejected' THEN
    FOREACH v_bid IN ARRAY v_req.branch_ids LOOP
      PERFORM app_private.close_branch_internal(v_bid, '被申請者拒絕');
    END LOOP;

    UPDATE public.shift_swap_requests
    SET status             = 'rejected_by_target',
        reviewed_by_target = v_actor,
        target_reviewed_at = now()
    WHERE id = p_id;

  ELSIF p_decision = 'approved' THEN
    -- 重新驗證（班表可能已變動）
    SELECT ok, error_code, error_msg
    INTO v_val_ok, v_val_err, v_val_msg
    FROM app_private.validate_swap(
      v_req.requester_user_id, v_req.requester_date,
      v_req.target_user_id,    v_req.target_date
    );

    IF NOT v_val_ok THEN
      FOREACH v_bid IN ARRAY v_req.branch_ids LOOP
        PERFORM app_private.close_branch_internal(
          v_bid, format('重新驗證失敗：%s', v_val_msg)
        );
      END LOOP;

      UPDATE public.shift_swap_requests
      SET status             = 'invalidated',
          invalidated_reason = v_val_msg,
          reviewed_by_target = v_actor,
          target_reviewed_at = now()
      WHERE id = p_id;
    ELSE
      UPDATE public.shift_swap_requests
      SET status             = 'pending_admin',
          reviewed_by_target = v_actor,
          target_reviewed_at = now()
      WHERE id = p_id;
    END IF;

  ELSE
    RAISE EXCEPTION 'INVALID_DECISION: must be approved or rejected';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_swap_request_as_target(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_swap_request_as_target(UUID, TEXT) TO authenticated;

-- ─── 6. review_swap_request ──────────────────────────────────────────────────
-- Admin 核准或拒絕（需要 manage_schedule 權限）
-- approved → merge 所有 branches（3-way merge）
-- rejected → close branches → rejected_by_admin

CREATE OR REPLACE FUNCTION public.review_swap_request(
  p_id                  UUID,
  p_decision            TEXT,
  p_conflict_resolution JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_req   public.shift_swap_requests%ROWTYPE;
  v_bid   UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_permission('manage_schedule') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_req FROM public.shift_swap_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  IF v_req.status <> 'pending_admin' THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_STATUS',
      DETAIL = format('current status is %s', v_req.status);
  END IF;

  IF p_decision = 'rejected' THEN
    FOREACH v_bid IN ARRAY v_req.branch_ids LOOP
      PERFORM app_private.close_branch_internal(v_bid, 'Admin 拒絕');
    END LOOP;

    UPDATE public.shift_swap_requests
    SET status            = 'rejected_by_admin',
        reviewed_by_admin = v_actor,
        admin_reviewed_at = now()
    WHERE id = p_id;

  ELSIF p_decision = 'approved' THEN
    -- merge 每個 branch（merge_branch_internal 會自動更新 merge_requests.status）
    FOREACH v_bid IN ARRAY v_req.branch_ids LOOP
      PERFORM app_private.merge_branch_internal(
        v_bid,
        format('換班核准：%s (%s ↔ %s)',
               p_id, v_req.requester_date::TEXT, v_req.target_date::TEXT),
        v_actor,
        p_conflict_resolution
      );
    END LOOP;

    UPDATE public.shift_swap_requests
    SET status            = 'approved',
        reviewed_by_admin = v_actor,
        admin_reviewed_at = now()
    WHERE id = p_id;

  ELSE
    RAISE EXCEPTION 'INVALID_DECISION: must be approved or rejected';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_swap_request(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_swap_request(UUID, TEXT, JSONB) TO authenticated;

-- ─── 7. cancel_swap_request ──────────────────────────────────────────────────
-- 申請者在 pending_target 或 pending_admin 階段取消

CREATE OR REPLACE FUNCTION public.cancel_swap_request(
  p_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_req   public.shift_swap_requests%ROWTYPE;
  v_bid   UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_req FROM public.shift_swap_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  -- 只有申請者可以取消
  IF v_req.requester_user_id <> v_actor THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- 只能在 pending 階段取消
  IF v_req.status NOT IN ('pending_target', 'pending_admin') THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_STATUS',
      DETAIL = format('cannot cancel in status %s', v_req.status);
  END IF;

  FOREACH v_bid IN ARRAY v_req.branch_ids LOOP
    PERFORM app_private.close_branch_internal(v_bid, '申請者取消');
  END LOOP;

  UPDATE public.shift_swap_requests
  SET status = 'cancelled'
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_swap_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_swap_request(UUID) TO authenticated;

-- ─── 8. RLS：shift_swap_requests ─────────────────────────────────────────────

ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shift_swap_requests FROM anon, authenticated;
GRANT SELECT ON public.shift_swap_requests TO authenticated;
GRANT ALL    ON public.shift_swap_requests TO service_role;

-- 申請者或被申請者可以看到自己相關的記錄
CREATE POLICY ssr_participant_read ON public.shift_swap_requests
  FOR SELECT TO authenticated
  USING (
    requester_user_id = auth.uid()
    OR target_user_id = auth.uid()
  );

-- 有 manage_schedule 權限者可以看到所有換班申請
CREATE POLICY ssr_manage_read ON public.shift_swap_requests
  FOR SELECT TO authenticated
  USING (public.has_permission('manage_schedule'));

-- 寫入只透過 SECURITY DEFINER RPC，不開放直接 INSERT/UPDATE/DELETE
