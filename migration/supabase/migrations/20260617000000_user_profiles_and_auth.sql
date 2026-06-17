-- Phase 1: user_profiles + Google OAuth auto-link + RLS helpers
-- 對齊 DoctorShiftManagement 的認證模型（email 為業務主鍵、首次登入 trigger 連結 auth.users）
-- 但保留 ANES 特有欄位：username（員工編號）、identity（護理身份別，決定班別模式）

-- ─── 1. user_profiles 表 ─────────────────────────────────────────────────────
-- 管理員預先用 email 建立，id 於使用者第一次 Google 登入時由 trigger 自動填入
CREATE TABLE public.user_profiles (
  id           UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email        TEXT NOT NULL UNIQUE,
  username     TEXT UNIQUE,                       -- 員工編號（沿用舊系統 username）
  full_name    TEXT,
  role         TEXT NOT NULL DEFAULT 'nurse'
                 CHECK (role IN ('admin', 'head_nurse', 'nurse', 'boss')),
  identity     TEXT,                              -- 護理身份別：麻醉專科護理師 / 恢復室護理師 / 麻醉科Leader / 麻醉科書記
  permissions  TEXT[] NOT NULL DEFAULT '{}',      -- capability-based 授權清單
  group_data   JSONB,                             -- 公式班表分組資料（JSON）
  hire_date    DATE,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_profiles_id       ON public.user_profiles(id);
CREATE INDEX idx_user_profiles_email    ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_username ON public.user_profiles(username);

COMMENT ON TABLE public.user_profiles IS
  '護理人員帳號。email 為業務主鍵，admin 預先建立；id 於首次 Google 登入由 link_user_profile trigger 自動填入。doctor（醫師）不納入本表，醫師班表走 doctor_schedules 系統。';

-- ─── 2. updated_at 通用 trigger function ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 3. Google 首次登入自動連結 trigger ─────────────────────────────────────
-- auth.users 新增一筆（首次登入）時，以 email 比對 user_profiles 填入 id。
-- 白名單制：email 不在 user_profiles 內 → 不連結（前端查無 profile 即登出）。
CREATE OR REPLACE FUNCTION public.link_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET id = NEW.id, updated_at = now()
  WHERE email = NEW.email AND id IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_user_profile();

-- ─── 4. RLS helper functions（SECURITY DEFINER 繞過 RLS）─────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id = auth.uid() AND is_active = true
  LIMIT 1
$$;

-- capability-based 權限檢查：role='admin' 或 head_nurse 一律放行，其餘看 permissions[]
CREATE OR REPLACE FUNCTION public.has_permission(cap TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND (
        role = 'admin'
        OR cap = ANY(permissions)
      )
  )
$$;

-- ─── 5. RLS：user_profiles ───────────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_profiles FROM anon, authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT ALL    ON public.user_profiles TO service_role;

-- 本人可讀自己的 profile
CREATE POLICY user_profiles_own_read ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 管理使用者權限者可讀寫全部
CREATE POLICY user_profiles_admin_all ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.has_permission('manage_user_profiles'))
  WITH CHECK (public.has_permission('manage_user_profiles'));
