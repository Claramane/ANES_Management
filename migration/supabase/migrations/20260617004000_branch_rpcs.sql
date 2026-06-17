-- Phase 0: Branch RPCs — 版本控制核心函數
-- 對齊 DoctorShiftManagement EAD-94/95 設計，以 ANES monthly_schedules 資料模型調整。
--
-- Snapshot 格式（與 DSM 不同，以 row-level JSONB object 代替 per-field key）：
--   key   = '{user_id}_{YYYY-MM-DD}'
--   value = {"shift_type": "D", "area_code": "OR", "special_type": null}
--   key 缺席 = 該護理師該日無排班
--
-- schedule_changes.field = 'shift_type' | 'area_code' | 'special_type'
-- schedule_changes.op    = 'set' | 'delete'

-- ─── 0. app_private schema ───────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO service_role;

-- ─── 1. build_month_snapshot ─────────────────────────────────────────────────
-- 從 monthly_schedules 建出該月所有護理師的完整快照（用於 merge commit 的 snapshot 欄位）

CREATE OR REPLACE FUNCTION app_private.build_month_snapshot(p_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path TO public, app_private
AS $function$
DECLARE
  v_snap JSONB := '{}'::jsonb;
  r      RECORD;
BEGIN
  FOR r IN
    SELECT user_id, date, shift_type, area_code, special_type
    FROM public.monthly_schedules
    WHERE date >= (p_month || '-01')::date
      AND date <  (p_month || '-01')::date + INTERVAL '1 month'
  LOOP
    v_snap := v_snap || jsonb_build_object(
      r.user_id::text || '_' || to_char(r.date, 'YYYY-MM-DD'),
      jsonb_build_object(
        'shift_type',   r.shift_type,
        'area_code',    r.area_code,
        'special_type', r.special_type
      )
    );
  END LOOP;
  RETURN v_snap;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.build_month_snapshot(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.build_month_snapshot(TEXT) TO service_role;

-- ─── 2. compute_branch_state ─────────────────────────────────────────────────
-- Branch state = head_commit.snapshot（EAD-95）
--            OR base_commit.snapshot + replay(schedule_changes WHERE branch_id = X)

CREATE OR REPLACE FUNCTION app_private.compute_branch_state(p_branch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path TO public, app_private
AS $function$
DECLARE
  v_branch   public.schedule_branches%ROWTYPE;
  v_snapshot JSONB := '{}'::jsonb;
  v_key      TEXT;
  v_cur_row  JSONB;
  r          RECORD;
BEGIN
  SELECT * INTO v_branch FROM public.schedule_branches WHERE id = p_branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'branch_not_found'; END IF;

  -- EAD-95: head_commit_id が設定されていれば、そのスナップショットを直接返す
  IF v_branch.head_commit_id IS NOT NULL THEN
    SELECT snapshot INTO v_snapshot
    FROM public.schedule_commits WHERE id = v_branch.head_commit_id;
    RETURN COALESCE(v_snapshot, '{}'::jsonb);
  END IF;

  -- Base commit snapshot
  IF v_branch.base_commit_id IS NOT NULL THEN
    SELECT snapshot INTO v_snapshot
    FROM public.schedule_commits WHERE id = v_branch.base_commit_id;
    v_snapshot := COALESCE(v_snapshot, '{}'::jsonb);
  END IF;

  -- schedule_changes を順に再生
  FOR r IN
    SELECT * FROM public.schedule_changes
    WHERE branch_id = p_branch_id
    ORDER BY id
  LOOP
    v_key     := r.user_id::text || '_' || to_char(r.date, 'YYYY-MM-DD');
    v_cur_row := COALESCE(v_snapshot -> v_key, '{}'::jsonb);

    IF r.op = 'delete' AND r.field = 'shift_type' THEN
      -- shift_type 削除 = 行ごと削除
      v_snapshot := v_snapshot - v_key;
    ELSIF r.op = 'delete' THEN
      -- area_code / special_type を JSON null にセット
      v_cur_row  := v_cur_row || jsonb_build_object(r.field, NULL::text);
      v_snapshot := v_snapshot || jsonb_build_object(v_key, v_cur_row);
    ELSE
      IF r.field = 'shift_type' AND r.new_value IS NULL THEN
        v_snapshot := v_snapshot - v_key;
      ELSE
        v_cur_row  := v_cur_row || jsonb_build_object(r.field, r.new_value);
        v_snapshot := v_snapshot || jsonb_build_object(v_key, v_cur_row);
      END IF;
    END IF;
  END LOOP;

  RETURN v_snapshot;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.compute_branch_state(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.compute_branch_state(UUID) TO service_role;

-- ─── 3. open_branch ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.open_branch(
  p_month                TEXT,
  p_kind                 TEXT DEFAULT 'admin_edit',
  p_name                 TEXT DEFAULT NULL,
  p_related_entity_table TEXT DEFAULT NULL,
  p_related_entity_id    TEXT DEFAULT NULL
)
RETURNS public.schedule_branches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, app_private
AS $function$
DECLARE
  v_branch      public.schedule_branches%ROWTYPE;
  v_actor       RECORD;
  v_head_id     UUID;
  v_default_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_permission('manage_schedule') THEN
    RAISE EXCEPTION 'permission_denied_manage_schedule';
  END IF;
  IF p_kind NOT IN ('admin_edit', 'swap_request', 'generate', 'other') THEN
    RAISE EXCEPTION 'invalid_branch_kind';
  END IF;
  IF p_month IS NULL OR p_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'invalid_month_format';
  END IF;

  SELECT id, full_name INTO v_actor
  FROM public.user_profiles
  WHERE id = auth.uid() AND is_active = true
  LIMIT 1;
  IF v_actor.id IS NULL THEN RAISE EXCEPTION 'actor_profile_not_found'; END IF;

  SELECT commit_id INTO v_head_id
  FROM public.schedule_heads WHERE month = p_month;

  v_default_name := format('%s:%s:%s',
    p_kind,
    COALESCE(v_actor.full_name, '使用者'),
    to_char(now(), 'MMDD-HH24MI'));

  INSERT INTO public.schedule_branches (
    month, name, kind, base_commit_id, owner_user_id,
    related_entity_table, related_entity_id
  ) VALUES (
    p_month,
    COALESCE(NULLIF(btrim(p_name), ''), v_default_name),
    p_kind,
    v_head_id,
    auth.uid(),
    NULLIF(btrim(COALESCE(p_related_entity_table, '')), ''),
    NULLIF(btrim(COALESCE(p_related_entity_id, '')), '')
  )
  RETURNING * INTO v_branch;

  RETURN v_branch;
END;
$function$;

REVOKE ALL ON FUNCTION public.open_branch(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_branch(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ─── 4. write_to_branch ──────────────────────────────────────────────────────
-- 寫入一個欄位變更到 branch（owner only）
-- p_field: 'shift_type' | 'area_code' | 'special_type'
-- p_op:    'set' | 'delete'

CREATE OR REPLACE FUNCTION public.write_to_branch(
  p_branch_id UUID,
  p_user_id   UUID,
  p_date      DATE,
  p_field     TEXT,
  p_op        TEXT,
  p_old_value TEXT DEFAULT NULL,
  p_new_value TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, app_private
AS $function$
DECLARE
  v_branch public.schedule_branches%ROWTYPE;
  v_id     UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_permission('manage_schedule') THEN
    RAISE EXCEPTION 'permission_denied_manage_schedule';
  END IF;
  IF p_field NOT IN ('shift_type', 'area_code', 'special_type') THEN
    RAISE EXCEPTION 'invalid_field';
  END IF;
  IF p_op NOT IN ('set', 'delete') THEN
    RAISE EXCEPTION 'invalid_op';
  END IF;

  SELECT * INTO v_branch FROM public.schedule_branches WHERE id = p_branch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'branch_not_found'; END IF;
  IF v_branch.status <> 'open' THEN RAISE EXCEPTION 'branch_not_open'; END IF;
  IF v_branch.owner_user_id <> auth.uid() THEN RAISE EXCEPTION 'not_branch_owner'; END IF;

  INSERT INTO public.schedule_changes (
    branch_id, user_id, date, field, old_value, new_value, op,
    actor_id, change_source,
    related_entity_table, related_entity_id
  ) VALUES (
    p_branch_id, p_user_id, p_date, p_field,
    p_old_value, p_new_value, p_op,
    auth.uid(), 'branch_edit',
    v_branch.related_entity_table,
    v_branch.related_entity_id
  )
  RETURNING id INTO v_id;

  UPDATE public.schedule_branches SET updated_at = now() WHERE id = p_branch_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.write_to_branch(UUID, UUID, DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_to_branch(UUID, UUID, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ─── 5. get_branch_state ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_branch_state(p_branch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, app_private
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_permission('manage_schedule') THEN
    RAISE EXCEPTION 'permission_denied_manage_schedule';
  END IF;
  RETURN app_private.compute_branch_state(p_branch_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_branch_state(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_branch_state(UUID) TO authenticated;

-- ─── 6. close_branch ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.close_branch(
  p_branch_id UUID,
  p_reason    TEXT DEFAULT NULL
)
RETURNS public.schedule_branches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, app_private
AS $function$
DECLARE
  v_branch public.schedule_branches%ROWTYPE;
  v_now    TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_permission('manage_schedule') THEN
    RAISE EXCEPTION 'permission_denied_manage_schedule';
  END IF;

  SELECT * INTO v_branch FROM public.schedule_branches WHERE id = p_branch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'branch_not_found'; END IF;
  IF v_branch.status <> 'open' THEN
    RETURN v_branch;  -- idempotent
  END IF;

  UPDATE public.schedule_branches
  SET status       = 'closed',
      closed_at    = v_now,
      closed_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
      updated_at   = v_now
  WHERE id = p_branch_id
  RETURNING * INTO v_branch;

  UPDATE public.merge_requests
  SET status = 'withdrawn', updated_at = v_now
  WHERE branch_id = p_branch_id AND status = 'open';

  RETURN v_branch;
END;
$function$;

REVOKE ALL ON FUNCTION public.close_branch(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_branch(UUID, TEXT) TO authenticated;

-- ─── 7. parse_snapshot_key ───────────────────────────────────────────────────
-- key 格式：'{uuid-36chars}_{YYYY-MM-DD}' （共 47 chars）
-- 回傳 (user_id UUID, date DATE)

CREATE OR REPLACE FUNCTION app_private.parse_snapshot_key(p_key TEXT)
RETURNS TABLE(user_id UUID, date DATE)
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_uuid_text TEXT;
  v_date_text TEXT;
BEGIN
  IF p_key IS NULL OR length(p_key) <> 47 THEN RETURN; END IF;
  IF substring(p_key FROM 37 FOR 1) <> '_' THEN RETURN; END IF;

  v_uuid_text := substring(p_key FROM 1 FOR 36);
  v_date_text := substring(p_key FROM 38 FOR 10);

  BEGIN user_id := v_uuid_text::uuid;
  EXCEPTION WHEN OTHERS THEN RETURN; END;

  BEGIN date := v_date_text::date;
  EXCEPTION WHEN OTHERS THEN RETURN; END;

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.parse_snapshot_key(TEXT) FROM PUBLIC, anon;

-- ─── 8. three_way_diff ───────────────────────────────────────────────────────
-- 每個 key 做 3-way diff；回傳需要處理的 key 清單

CREATE OR REPLACE FUNCTION app_private.three_way_diff(
  p_base   JSONB,
  p_main   JSONB,
  p_branch JSONB
)
RETURNS TABLE(
  key          TEXT,
  base_val     JSONB,
  main_val     JSONB,
  branch_val   JSONB,
  is_conflict  BOOLEAN,
  apply_action TEXT,
  apply_value  JSONB
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_key TEXT;
  v_b   JSONB;
  v_m   JSONB;
  v_br  JSONB;
BEGIN
  FOR v_key IN
    SELECT DISTINCT k FROM (
      SELECT jsonb_object_keys(COALESCE(p_base,   '{}'::jsonb)) AS k
      UNION
      SELECT jsonb_object_keys(COALESCE(p_main,   '{}'::jsonb)) AS k
      UNION
      SELECT jsonb_object_keys(COALESCE(p_branch, '{}'::jsonb)) AS k
    ) u
  LOOP
    v_b  := p_base   -> v_key;
    v_m  := p_main   -> v_key;
    v_br := p_branch -> v_key;

    -- branch が base から変更していなければスキップ
    IF v_br IS NOT DISTINCT FROM v_b THEN CONTINUE; END IF;

    -- branch は変更あり → main の変更を確認
    IF v_m IS DISTINCT FROM v_b AND v_m IS DISTINCT FROM v_br THEN
      -- 両方が異なる値に変更 → conflict
      key := v_key; base_val := v_b; main_val := v_m; branch_val := v_br;
      is_conflict := TRUE; apply_action := 'noop'; apply_value := NULL;
      RETURN NEXT;
    ELSE
      -- branch のみ変更、または両方が同じ値に変更
      key := v_key; base_val := v_b; main_val := v_m; branch_val := v_br;
      is_conflict := FALSE; apply_action := 'apply_branch'; apply_value := v_br;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.three_way_diff(JSONB, JSONB, JSONB) FROM PUBLIC, anon;

-- ─── 9. apply_snapshot_kv ────────────────────────────────────────────────────
-- snapshot の key-value を monthly_schedules に適用する
-- p_value IS NULL → 行削除；p_value->>'shift_type' IS NULL → 行削除

CREATE OR REPLACE FUNCTION app_private.apply_snapshot_kv(
  p_key   TEXT,
  p_value JSONB,
  p_now   TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, app_private
AS $function$
DECLARE
  k         RECORD;
  v_shift   TEXT;
  v_area    TEXT;
  v_special TEXT;
BEGIN
  SELECT * INTO k FROM app_private.parse_snapshot_key(p_key) LIMIT 1;
  IF k.user_id IS NULL THEN RETURN; END IF;

  IF p_value IS NULL THEN
    DELETE FROM public.monthly_schedules
    WHERE user_id = k.user_id AND date = k.date;
    RETURN;
  END IF;

  v_shift   := p_value ->> 'shift_type';
  v_area    := p_value ->> 'area_code';
  v_special := p_value ->> 'special_type';

  IF v_shift IS NULL THEN
    DELETE FROM public.monthly_schedules
    WHERE user_id = k.user_id AND date = k.date;
  ELSE
    INSERT INTO public.monthly_schedules
      (user_id, date, shift_type, area_code, special_type, updated_at)
    VALUES
      (k.user_id, k.date, v_shift, v_area, v_special, p_now)
    ON CONFLICT (user_id, date) DO UPDATE SET
      shift_type   = EXCLUDED.shift_type,
      area_code    = EXCLUDED.area_code,
      special_type = EXCLUDED.special_type,
      updated_at   = EXCLUDED.updated_at;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.apply_snapshot_kv(TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

-- ─── 10. create_commit_internal ──────────────────────────────────────────────
-- 内部ヘルパー：現在の monthly_schedules を snapshot として commit を作成し、
-- schedule_heads を更新する

CREATE OR REPLACE FUNCTION app_private.create_commit_internal(
  p_month                  TEXT,
  p_kind                   TEXT,
  p_message                TEXT,
  p_author_id              UUID,
  p_parent_id              UUID DEFAULT NULL,
  p_branch_id              UUID DEFAULT NULL,
  p_merged_from_branch_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path TO public, app_private
AS $function$
DECLARE
  v_commit_id   UUID;
  v_author_name TEXT;
  v_parent_id   UUID;
BEGIN
  SELECT full_name INTO v_author_name
  FROM public.user_profiles WHERE id = p_author_id;

  v_parent_id := p_parent_id;
  IF v_parent_id IS NULL THEN
    SELECT commit_id INTO v_parent_id
    FROM public.schedule_heads WHERE month = p_month;
  END IF;

  INSERT INTO public.schedule_commits (
    month, parent_id, branch_id, author_id, author_name,
    message, kind, snapshot, merged_from_branch_id
  ) VALUES (
    p_month,
    v_parent_id,
    p_branch_id,
    p_author_id,
    v_author_name,
    NULLIF(btrim(COALESCE(p_message, '')), ''),
    p_kind,
    app_private.build_month_snapshot(p_month),
    p_merged_from_branch_id
  )
  RETURNING id INTO v_commit_id;

  INSERT INTO public.schedule_heads (month, commit_id, updated_at)
  VALUES (p_month, v_commit_id, now())
  ON CONFLICT (month) DO UPDATE SET
    commit_id  = EXCLUDED.commit_id,
    updated_at = EXCLUDED.updated_at;

  RETURN v_commit_id;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.create_commit_internal(TEXT, TEXT, TEXT, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.create_commit_internal(TEXT, TEXT, TEXT, UUID, UUID, UUID, UUID) TO service_role;

-- ─── 11. merge_branch_internal ───────────────────────────────────────────────
-- 3-way merge：base / main / branch の snapshot を比較し、
-- 衝突がなければ monthly_schedules に適用して merge commit を作成する。
-- p_conflict_resolution: {"key": {"choice": "main"|"branch", "value": <jsonb>}, ...}

CREATE OR REPLACE FUNCTION app_private.merge_branch_internal(
  p_branch_id           UUID,
  p_message             TEXT DEFAULT NULL,
  p_actor_user_id       UUID DEFAULT NULL,
  p_conflict_resolution JSONB DEFAULT NULL
)
RETURNS public.schedule_commits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, app_private
AS $function$
DECLARE
  v_branch       public.schedule_branches%ROWTYPE;
  v_actor        RECORD;
  v_current_head UUID;
  v_base_snap    JSONB := '{}'::jsonb;
  v_main_snap    JSONB := '{}'::jsonb;
  v_branch_snap  JSONB;
  v_new_commit   public.schedule_commits%ROWTYPE;
  v_now          TIMESTAMPTZ := now();
  v_actor_user   UUID;
  v_unresolved   JSONB := '[]'::jsonb;
  v_resolved     JSONB;
  v_choice       TEXT;
  v_apply_value  JSONB;
  r              RECORD;
BEGIN
  v_actor_user := COALESCE(p_actor_user_id, auth.uid());

  SELECT * INTO v_branch FROM public.schedule_branches WHERE id = p_branch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'branch_not_found'; END IF;
  IF v_branch.status <> 'open' THEN RAISE EXCEPTION 'branch_not_open'; END IF;

  -- 月ごとにアドバイザリーロックを取得（同月の並列 merge を防止）
  PERFORM pg_advisory_xact_lock(hashtext('schedule_main:' || v_branch.month));

  SELECT commit_id INTO v_current_head
  FROM public.schedule_heads WHERE month = v_branch.month;

  IF v_branch.base_commit_id IS NOT NULL THEN
    SELECT snapshot INTO v_base_snap FROM public.schedule_commits WHERE id = v_branch.base_commit_id;
    v_base_snap := COALESCE(v_base_snap, '{}'::jsonb);
  END IF;

  IF v_current_head IS NOT NULL THEN
    SELECT snapshot INTO v_main_snap FROM public.schedule_commits WHERE id = v_current_head;
    v_main_snap := COALESCE(v_main_snap, '{}'::jsonb);
  ELSE
    v_main_snap := app_private.build_month_snapshot(v_branch.month);
  END IF;

  v_branch_snap := app_private.compute_branch_state(p_branch_id);

  SELECT id, full_name INTO v_actor
  FROM public.user_profiles WHERE id = v_actor_user LIMIT 1;
  IF v_actor.id IS NULL THEN RAISE EXCEPTION 'actor_profile_not_found'; END IF;

  -- 3-way diff をループして monthly_schedules に適用
  FOR r IN
    SELECT * FROM app_private.three_way_diff(v_base_snap, v_main_snap, v_branch_snap)
  LOOP
    IF NOT r.is_conflict THEN
      PERFORM app_private.apply_snapshot_kv(r.key, r.apply_value, v_now);
      CONTINUE;
    END IF;

    -- 衝突：resolution があれば適用
    v_resolved := CASE WHEN p_conflict_resolution IS NOT NULL
                       THEN p_conflict_resolution -> r.key
                       ELSE NULL END;
    v_choice := v_resolved ->> 'choice';

    IF v_choice = 'main' THEN
      CONTINUE;  -- main を保持
    ELSIF v_choice = 'branch' THEN
      PERFORM app_private.apply_snapshot_kv(r.key, r.branch_val, v_now);
    ELSIF v_choice = 'custom' THEN
      PERFORM app_private.apply_snapshot_kv(r.key, v_resolved -> 'value', v_now);
    ELSE
      v_unresolved := v_unresolved || jsonb_build_object(
        'key', r.key, 'base', r.base_val, 'main', r.main_val, 'branch', r.branch_val
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_unresolved) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'merge_conflicts',
      DETAIL  = v_unresolved::text;
  END IF;

  -- merge commit を作成（現在の monthly_schedules から snapshot を再構築）
  INSERT INTO public.schedule_commits (
    month, parent_id, author_id, author_name, message, kind,
    snapshot, merged_from_branch_id
  ) VALUES (
    v_branch.month,
    v_current_head,
    v_actor.id,
    v_actor.full_name,
    NULLIF(btrim(COALESCE(p_message, '')), ''),
    'merge',
    app_private.build_month_snapshot(v_branch.month),
    p_branch_id
  )
  RETURNING * INTO v_new_commit;

  INSERT INTO public.schedule_heads (month, commit_id, updated_at)
  VALUES (v_branch.month, v_new_commit.id, v_now)
  ON CONFLICT (month) DO UPDATE SET
    commit_id  = EXCLUDED.commit_id,
    updated_at = EXCLUDED.updated_at;

  UPDATE public.schedule_branches
  SET status              = 'merged',
      merged_at           = v_now,
      merged_into_commit_id = v_new_commit.id,
      updated_at          = v_now
  WHERE id = p_branch_id;

  UPDATE public.merge_requests
  SET status      = 'merged',
      reviewed_by = v_actor.id,
      reviewed_at = v_now,
      updated_at  = v_now,
      conflict_resolution = p_conflict_resolution
  WHERE branch_id = p_branch_id AND status = 'open';

  RETURN v_new_commit;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.merge_branch_internal(UUID, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.merge_branch_internal(UUID, TEXT, UUID, JSONB) TO service_role;

-- ─── 12. compute_branch_merge_conflicts ──────────────────────────────────────
-- Pre-flight 衝突偵測（前端呼叫，在 merge 前確認）

CREATE OR REPLACE FUNCTION public.compute_branch_merge_conflicts(p_branch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, app_private
AS $function$
DECLARE
  v_branch      public.schedule_branches%ROWTYPE;
  v_base_snap   JSONB := '{}'::jsonb;
  v_main_snap   JSONB := '{}'::jsonb;
  v_branch_snap JSONB;
  v_head_id     UUID;
  v_conflicts   JSONB := '[]'::jsonb;
  r             RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_permission('manage_schedule') THEN
    RAISE EXCEPTION 'permission_denied_manage_schedule';
  END IF;

  SELECT * INTO v_branch FROM public.schedule_branches WHERE id = p_branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'branch_not_found'; END IF;

  IF v_branch.base_commit_id IS NOT NULL THEN
    SELECT snapshot INTO v_base_snap FROM public.schedule_commits WHERE id = v_branch.base_commit_id;
    v_base_snap := COALESCE(v_base_snap, '{}'::jsonb);
  END IF;

  SELECT commit_id INTO v_head_id FROM public.schedule_heads WHERE month = v_branch.month;
  IF v_head_id IS NOT NULL THEN
    SELECT snapshot INTO v_main_snap FROM public.schedule_commits WHERE id = v_head_id;
    v_main_snap := COALESCE(v_main_snap, '{}'::jsonb);
  ELSE
    v_main_snap := app_private.build_month_snapshot(v_branch.month);
  END IF;

  v_branch_snap := app_private.compute_branch_state(p_branch_id);

  FOR r IN
    SELECT * FROM app_private.three_way_diff(v_base_snap, v_main_snap, v_branch_snap)
    WHERE is_conflict
  LOOP
    v_conflicts := v_conflicts || jsonb_build_object(
      'key',    r.key,
      'base',   r.base_val,
      'main',   r.main_val,
      'branch', r.branch_val
    );
  END LOOP;

  RETURN v_conflicts;
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_branch_merge_conflicts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_branch_merge_conflicts(UUID) TO authenticated;

-- ─── 13. merge_branch (public wrapper) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.merge_branch(
  p_branch_id           UUID,
  p_message             TEXT DEFAULT NULL,
  p_conflict_resolution JSONB DEFAULT NULL
)
RETURNS public.schedule_commits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, app_private
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_permission('manage_schedule') THEN
    RAISE EXCEPTION 'permission_denied_manage_schedule';
  END IF;
  RETURN app_private.merge_branch_internal(
    p_branch_id, p_message, auth.uid(), p_conflict_resolution
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.merge_branch(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_branch(UUID, TEXT, JSONB) TO authenticated;

-- ─── 14. commit_checkpoint ───────────────────────────────────────────────────
-- 管理者が手動でチェックポイントを作成する（kind='manual'）

CREATE OR REPLACE FUNCTION public.commit_checkpoint(
  p_month   TEXT,
  p_kind    TEXT DEFAULT 'manual',
  p_message TEXT DEFAULT NULL
)
RETURNS public.schedule_commits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, app_private
AS $function$
DECLARE
  v_commit_id UUID;
  v_commit    public.schedule_commits%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_permission('manage_schedule') THEN
    RAISE EXCEPTION 'permission_denied_manage_schedule';
  END IF;
  IF p_kind NOT IN ('manual', 'generate') THEN
    RAISE EXCEPTION 'invalid_kind_for_checkpoint';
  END IF;
  IF p_month IS NULL OR p_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'invalid_month_format';
  END IF;

  v_commit_id := app_private.create_commit_internal(
    p_month, p_kind, p_message, auth.uid()
  );

  SELECT * INTO v_commit FROM public.schedule_commits WHERE id = v_commit_id;
  RETURN v_commit;
END;
$function$;

REVOKE ALL ON FUNCTION public.commit_checkpoint(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_checkpoint(TEXT, TEXT, TEXT) TO authenticated;

-- ─── 15. restore_to_commit ───────────────────────────────────────────────────
-- 指定 commit のスナップショットに月班表を復元し、新しい 'restore' commit を作成する

CREATE OR REPLACE FUNCTION public.restore_to_commit(
  p_commit_id UUID,
  p_message   TEXT DEFAULT NULL
)
RETURNS public.schedule_commits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, app_private
AS $function$
DECLARE
  v_target    public.schedule_commits%ROWTYPE;
  v_now       TIMESTAMPTZ := now();
  v_commit_id UUID;
  v_commit    public.schedule_commits%ROWTYPE;
  r           RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_permission('manage_schedule') THEN
    RAISE EXCEPTION 'permission_denied_manage_schedule';
  END IF;

  SELECT * INTO v_target FROM public.schedule_commits WHERE id = p_commit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'commit_not_found'; END IF;

  -- 月ロック取得
  PERFORM pg_advisory_xact_lock(hashtext('schedule_main:' || v_target.month));

  -- 対象月の monthly_schedules を一旦全削除してから snapshot で再構築
  DELETE FROM public.monthly_schedules
  WHERE date >= (v_target.month || '-01')::date
    AND date <  (v_target.month || '-01')::date + INTERVAL '1 month';

  FOR r IN
    SELECT key, value
    FROM jsonb_each(COALESCE(v_target.snapshot, '{}'::jsonb))
  LOOP
    PERFORM app_private.apply_snapshot_kv(r.key, r.value, v_now);
  END LOOP;

  -- restore commit を作成
  v_commit_id := app_private.create_commit_internal(
    v_target.month,
    'restore',
    COALESCE(
      NULLIF(btrim(COALESCE(p_message, '')), ''),
      '還原至 ' || to_char(v_target.committed_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI')
    ),
    auth.uid()
  );

  SELECT * INTO v_commit FROM public.schedule_commits WHERE id = v_commit_id;
  RETURN v_commit;
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_to_commit(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_to_commit(UUID, TEXT) TO authenticated;
