--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Debian 17.5-1.pgdg120+1)
-- Dumped by pg_dump version 17.5 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcement_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_categories (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: announcement_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcement_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcement_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcement_categories_id_seq OWNED BY public.announcement_categories.id;


--
-- Name: announcement_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_permissions (
    id integer NOT NULL,
    announcement_id integer NOT NULL,
    category_id integer,
    role character varying(20),
    identity character varying(50),
    user_id integer,
    can_create boolean DEFAULT false,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: announcement_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcement_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcement_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcement_permissions_id_seq OWNED BY public.announcement_permissions.id;


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id integer NOT NULL,
    title character varying(100) NOT NULL,
    content text NOT NULL,
    category_id integer,
    author_id integer NOT NULL,
    is_active boolean DEFAULT true,
    is_important boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_pinned boolean DEFAULT false NOT NULL
);


--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: day_shift_doctors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.day_shift_doctors (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    name character varying(50) NOT NULL,
    summary character varying(200) NOT NULL,
    "time" character varying(50) NOT NULL,
    area_code character varying(20) NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    meeting_time character varying(20),
    status character varying(20) DEFAULT 'on_duty'::character varying,
    CONSTRAINT day_shift_doctors_status_check CHECK (((status)::text = ANY ((ARRAY['on_duty'::character varying, 'off_duty'::character varying, 'off'::character varying])::text[])))
);


--
-- Name: COLUMN day_shift_doctors.meeting_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.day_shift_doctors.meeting_time IS '開會時間，格式如08:00-10:00';


--
-- Name: day_shift_doctors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.day_shift_doctors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: day_shift_doctors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.day_shift_doctors_id_seq OWNED BY public.day_shift_doctors.id;


--
-- Name: doctor_schedule_update_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_schedule_update_logs (
    id integer NOT NULL,
    update_time timestamp without time zone,
    start_date character varying(8) NOT NULL,
    end_date character varying(8) NOT NULL,
    success boolean NOT NULL,
    total_days integer,
    error_message text,
    processing_time character varying(50)
);


--
-- Name: doctor_schedule_update_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctor_schedule_update_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctor_schedule_update_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctor_schedule_update_logs_id_seq OWNED BY public.doctor_schedule_update_logs.id;


--
-- Name: doctor_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_schedules (
    id integer NOT NULL,
    date character varying(8) NOT NULL,
    duty_doctor character varying(50),
    schedule_notes json,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: doctor_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctor_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctor_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctor_schedules_id_seq OWNED BY public.doctor_schedules.id;


--
-- Name: formula_schedule_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formula_schedule_patterns (
    id integer NOT NULL,
    formula_id integer NOT NULL,
    group_number integer NOT NULL,
    day_offset integer,
    pattern character varying(20),
    shift_type character varying(5),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: formula_schedule_patterns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.formula_schedule_patterns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: formula_schedule_patterns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.formula_schedule_patterns_id_seq OWNED BY public.formula_schedule_patterns.id;


--
-- Name: formula_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formula_schedules (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    identity character varying(50) DEFAULT ''::character varying,
    num_groups integer DEFAULT 1,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: formula_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.formula_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: formula_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.formula_schedules_id_seq OWNED BY public.formula_schedules.id;


--
-- Name: logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    operation_type character varying(50),
    operation_time timestamp without time zone,
    details text,
    ip_address character varying(50),
    description text,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logs_id_seq OWNED BY public.logs.id;


--
-- Name: monthly_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_schedules (
    id integer NOT NULL,
    user_id integer NOT NULL,
    date date NOT NULL,
    shift_type character varying(5),
    area_code character varying(10),
    work_time character varying(50),
    version_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    special_type character varying
);


--
-- Name: monthly_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monthly_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monthly_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.monthly_schedules_id_seq OWNED BY public.monthly_schedules.id;


--
-- Name: nurse_formula_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nurse_formula_assignments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    formula_id integer NOT NULL,
    group_number integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: nurse_formula_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nurse_formula_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nurse_formula_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nurse_formula_assignments_id_seq OWNED BY public.nurse_formula_assignments.id;


--
-- Name: overtime_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_config (
    id integer NOT NULL,
    a_weight double precision,
    b_weight double precision,
    c_weight double precision,
    d_weight double precision,
    e_weight double precision,
    f_weight double precision,
    negative_weight double precision,
    effective_date date NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: overtime_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.overtime_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: overtime_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.overtime_config_id_seq OWNED BY public.overtime_config.id;


--
-- Name: overtime_monthly_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_monthly_scores (
    id integer NOT NULL,
    user_id integer,
    year integer,
    month integer,
    total_score double precision,
    details text
);


--
-- Name: overtime_monthly_scores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.overtime_monthly_scores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: overtime_monthly_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.overtime_monthly_scores_id_seq OWNED BY public.overtime_monthly_scores.id;


--
-- Name: overtime_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_points (
    id integer NOT NULL,
    user_id integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    a_count integer,
    b_count integer,
    c_count integer,
    d_count integer,
    e_count integer,
    f_count integer,
    points double precision,
    cumulative_points double precision,
    is_excluded integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: overtime_points_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.overtime_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: overtime_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.overtime_points_id_seq OWNED BY public.overtime_points.id;


--
-- Name: overtime_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_records (
    id integer NOT NULL,
    user_id integer NOT NULL,
    date date NOT NULL,
    mark character varying,
    points double precision,
    overtime_shift character varying(1),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: overtime_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.overtime_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: overtime_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.overtime_records_id_seq OWNED BY public.overtime_records.id;


--
-- Name: overtime_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_settings (
    id integer NOT NULL,
    mark_a_points double precision,
    mark_b_points double precision,
    mark_c_points double precision,
    mark_d_points double precision,
    mark_e_points double precision,
    mark_f_points double precision,
    no_mark_points double precision,
    last_updated date
);


--
-- Name: overtime_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.overtime_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: overtime_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.overtime_settings_id_seq OWNED BY public.overtime_settings.id;


--
-- Name: overtime_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_summaries (
    id integer NOT NULL,
    user_id integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    total_points double precision
);


--
-- Name: overtime_summaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.overtime_summaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: overtime_summaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.overtime_summaries_id_seq OWNED BY public.overtime_summaries.id;


--
-- Name: pattern_nurse_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pattern_nurse_assignments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    pattern_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pattern_nurse_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pattern_nurse_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pattern_nurse_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pattern_nurse_assignments_id_seq OWNED BY public.pattern_nurse_assignments.id;


--
-- Name: schedule_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_changes (
    id integer NOT NULL,
    version_id integer NOT NULL,
    base_version_id integer NOT NULL,
    user_id integer NOT NULL,
    date date NOT NULL,
    old_shift_type character varying(5),
    new_shift_type character varying(5),
    old_area_code character varying(10),
    new_area_code character varying(10),
    change_type character varying(10) NOT NULL,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    changed_by integer
);


--
-- Name: schedule_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedule_changes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedule_changes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedule_changes_id_seq OWNED BY public.schedule_changes.id;


--
-- Name: schedule_overtimes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_overtimes (
    id integer NOT NULL,
    user_id integer,
    date date,
    overtime_hours character varying,
    created_by integer,
    last_modified_by integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: schedule_overtimes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedule_overtimes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedule_overtimes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedule_overtimes_id_seq OWNED BY public.schedule_overtimes.id;


--
-- Name: schedule_version_diffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_version_diffs (
    id integer NOT NULL,
    version_id integer,
    base_version_id integer,
    diff_data json,
    created_at timestamp without time zone
);


--
-- Name: schedule_version_diffs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedule_version_diffs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedule_version_diffs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedule_version_diffs_id_seq OWNED BY public.schedule_version_diffs.id;


--
-- Name: schedule_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_versions (
    id integer NOT NULL,
    month character varying(7) NOT NULL,
    version integer,
    version_number character varying(20),
    published_at timestamp without time zone,
    notes text,
    is_published boolean DEFAULT false,
    published_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    base_version_id integer,
    version_sequence integer DEFAULT 1 NOT NULL,
    is_base_version boolean DEFAULT false NOT NULL
);


--
-- Name: schedule_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedule_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedule_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedule_versions_id_seq OWNED BY public.schedule_versions.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    description text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: shift_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_rules (
    id integer NOT NULL,
    name character varying NOT NULL,
    shift_type character varying NOT NULL,
    start_time character varying NOT NULL,
    end_time character varying NOT NULL,
    max_consecutive integer,
    min_rest_hours integer,
    max_weekly_shifts integer,
    max_monthly_shifts integer,
    description text,
    is_active boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: shift_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shift_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shift_rules_id_seq OWNED BY public.shift_rules.id;


--
-- Name: shift_swap_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_swap_requests (
    id integer NOT NULL,
    requestor_id integer,
    acceptor_id integer,
    from_date date,
    from_shift character varying,
    from_mission character varying,
    from_overtime character varying,
    to_date date,
    to_shift character varying,
    to_mission character varying,
    to_overtime character varying,
    target_nurse_id integer,
    swap_type character varying,
    notes text,
    status character varying,
    validation_result boolean,
    validation_message text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    accepted_at timestamp without time zone
);


--
-- Name: shift_swap_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shift_swap_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_swap_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shift_swap_requests_id_seq OWNED BY public.shift_swap_requests.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    full_name character varying(100),
    email character varying(100),
    password character varying(100),
    hashed_password character varying(100),
    role character varying(20) NOT NULL,
    identity character varying(50),
    employee_number character varying(20),
    hire_date date,
    group_data text,
    last_login_ip character varying(50),
    last_login_time timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true NOT NULL,
    deactivated_at timestamp without time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: webauthn_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webauthn_credentials (
    id integer NOT NULL,
    user_id integer NOT NULL,
    credential_id character varying NOT NULL,
    public_key character varying NOT NULL,
    sign_count integer,
    device_name character varying,
    is_active boolean,
    created_at timestamp without time zone,
    last_used_at timestamp without time zone,
    device_fingerprint character varying
);


--
-- Name: webauthn_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.webauthn_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webauthn_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.webauthn_credentials_id_seq OWNED BY public.webauthn_credentials.id;


--
-- Name: announcement_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_categories ALTER COLUMN id SET DEFAULT nextval('public.announcement_categories_id_seq'::regclass);


--
-- Name: announcement_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_permissions ALTER COLUMN id SET DEFAULT nextval('public.announcement_permissions_id_seq'::regclass);


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: day_shift_doctors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_shift_doctors ALTER COLUMN id SET DEFAULT nextval('public.day_shift_doctors_id_seq'::regclass);


--
-- Name: doctor_schedule_update_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule_update_logs ALTER COLUMN id SET DEFAULT nextval('public.doctor_schedule_update_logs_id_seq'::regclass);


--
-- Name: doctor_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules ALTER COLUMN id SET DEFAULT nextval('public.doctor_schedules_id_seq'::regclass);


--
-- Name: formula_schedule_patterns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formula_schedule_patterns ALTER COLUMN id SET DEFAULT nextval('public.formula_schedule_patterns_id_seq'::regclass);


--
-- Name: formula_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formula_schedules ALTER COLUMN id SET DEFAULT nextval('public.formula_schedules_id_seq'::regclass);


--
-- Name: logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs ALTER COLUMN id SET DEFAULT nextval('public.logs_id_seq'::regclass);


--
-- Name: monthly_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_schedules ALTER COLUMN id SET DEFAULT nextval('public.monthly_schedules_id_seq'::regclass);


--
-- Name: nurse_formula_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_formula_assignments ALTER COLUMN id SET DEFAULT nextval('public.nurse_formula_assignments_id_seq'::regclass);


--
-- Name: overtime_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_config ALTER COLUMN id SET DEFAULT nextval('public.overtime_config_id_seq'::regclass);


--
-- Name: overtime_monthly_scores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_monthly_scores ALTER COLUMN id SET DEFAULT nextval('public.overtime_monthly_scores_id_seq'::regclass);


--
-- Name: overtime_points id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_points ALTER COLUMN id SET DEFAULT nextval('public.overtime_points_id_seq'::regclass);


--
-- Name: overtime_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_records ALTER COLUMN id SET DEFAULT nextval('public.overtime_records_id_seq'::regclass);


--
-- Name: overtime_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_settings ALTER COLUMN id SET DEFAULT nextval('public.overtime_settings_id_seq'::regclass);


--
-- Name: overtime_summaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_summaries ALTER COLUMN id SET DEFAULT nextval('public.overtime_summaries_id_seq'::regclass);


--
-- Name: pattern_nurse_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_nurse_assignments ALTER COLUMN id SET DEFAULT nextval('public.pattern_nurse_assignments_id_seq'::regclass);


--
-- Name: schedule_changes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes ALTER COLUMN id SET DEFAULT nextval('public.schedule_changes_id_seq'::regclass);


--
-- Name: schedule_overtimes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overtimes ALTER COLUMN id SET DEFAULT nextval('public.schedule_overtimes_id_seq'::regclass);


--
-- Name: schedule_version_diffs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_version_diffs ALTER COLUMN id SET DEFAULT nextval('public.schedule_version_diffs_id_seq'::regclass);


--
-- Name: schedule_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_versions ALTER COLUMN id SET DEFAULT nextval('public.schedule_versions_id_seq'::regclass);


--
-- Name: shift_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_rules ALTER COLUMN id SET DEFAULT nextval('public.shift_rules_id_seq'::regclass);


--
-- Name: shift_swap_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests ALTER COLUMN id SET DEFAULT nextval('public.shift_swap_requests_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: webauthn_credentials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webauthn_credentials ALTER COLUMN id SET DEFAULT nextval('public.webauthn_credentials_id_seq'::regclass);


--
-- Name: announcement_categories announcement_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_categories
    ADD CONSTRAINT announcement_categories_pkey PRIMARY KEY (id);


--
-- Name: announcement_permissions announcement_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_permissions
    ADD CONSTRAINT announcement_permissions_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: day_shift_doctors day_shift_doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_shift_doctors
    ADD CONSTRAINT day_shift_doctors_pkey PRIMARY KEY (id);


--
-- Name: doctor_schedule_update_logs doctor_schedule_update_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule_update_logs
    ADD CONSTRAINT doctor_schedule_update_logs_pkey PRIMARY KEY (id);


--
-- Name: doctor_schedules doctor_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_pkey PRIMARY KEY (id);


--
-- Name: formula_schedule_patterns formula_schedule_patterns_formula_id_group_number_day_offse_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formula_schedule_patterns
    ADD CONSTRAINT formula_schedule_patterns_formula_id_group_number_day_offse_key UNIQUE (formula_id, group_number, day_offset);


--
-- Name: formula_schedule_patterns formula_schedule_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formula_schedule_patterns
    ADD CONSTRAINT formula_schedule_patterns_pkey PRIMARY KEY (id);


--
-- Name: formula_schedules formula_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formula_schedules
    ADD CONSTRAINT formula_schedules_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: monthly_schedules monthly_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_schedules
    ADD CONSTRAINT monthly_schedules_pkey PRIMARY KEY (id);


--
-- Name: monthly_schedules monthly_schedules_user_id_date_version_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_schedules
    ADD CONSTRAINT monthly_schedules_user_id_date_version_id_key UNIQUE (user_id, date, version_id);


--
-- Name: nurse_formula_assignments nurse_formula_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_formula_assignments
    ADD CONSTRAINT nurse_formula_assignments_pkey PRIMARY KEY (id);


--
-- Name: nurse_formula_assignments nurse_formula_assignments_user_id_formula_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_formula_assignments
    ADD CONSTRAINT nurse_formula_assignments_user_id_formula_id_key UNIQUE (user_id, formula_id);


--
-- Name: overtime_config overtime_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_config
    ADD CONSTRAINT overtime_config_pkey PRIMARY KEY (id);


--
-- Name: overtime_monthly_scores overtime_monthly_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_monthly_scores
    ADD CONSTRAINT overtime_monthly_scores_pkey PRIMARY KEY (id);


--
-- Name: overtime_points overtime_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_points
    ADD CONSTRAINT overtime_points_pkey PRIMARY KEY (id);


--
-- Name: overtime_records overtime_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_records
    ADD CONSTRAINT overtime_records_pkey PRIMARY KEY (id);


--
-- Name: overtime_settings overtime_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_settings
    ADD CONSTRAINT overtime_settings_pkey PRIMARY KEY (id);


--
-- Name: overtime_summaries overtime_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_summaries
    ADD CONSTRAINT overtime_summaries_pkey PRIMARY KEY (id);


--
-- Name: pattern_nurse_assignments pattern_nurse_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_nurse_assignments
    ADD CONSTRAINT pattern_nurse_assignments_pkey PRIMARY KEY (id);


--
-- Name: pattern_nurse_assignments pattern_nurse_assignments_user_id_pattern_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_nurse_assignments
    ADD CONSTRAINT pattern_nurse_assignments_user_id_pattern_id_key UNIQUE (user_id, pattern_id);


--
-- Name: schedule_changes schedule_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes
    ADD CONSTRAINT schedule_changes_pkey PRIMARY KEY (id);


--
-- Name: schedule_overtimes schedule_overtimes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overtimes
    ADD CONSTRAINT schedule_overtimes_pkey PRIMARY KEY (id);


--
-- Name: schedule_version_diffs schedule_version_diffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_version_diffs
    ADD CONSTRAINT schedule_version_diffs_pkey PRIMARY KEY (id);


--
-- Name: schedule_versions schedule_versions_month_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_versions
    ADD CONSTRAINT schedule_versions_month_version_key UNIQUE (month, version);


--
-- Name: schedule_versions schedule_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_versions
    ADD CONSTRAINT schedule_versions_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: shift_rules shift_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_rules
    ADD CONSTRAINT shift_rules_pkey PRIMARY KEY (id);


--
-- Name: shift_swap_requests shift_swap_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_pkey PRIMARY KEY (id);


--
-- Name: overtime_monthly_scores uix_user_year_month; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_monthly_scores
    ADD CONSTRAINT uix_user_year_month UNIQUE (user_id, year, month);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: idx_schedule_changes_base_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_changes_base_version ON public.schedule_changes USING btree (base_version_id);


--
-- Name: idx_schedule_changes_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_changes_user_date ON public.schedule_changes USING btree (user_id, date);


--
-- Name: idx_schedule_changes_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_changes_version ON public.schedule_changes USING btree (version_id);


--
-- Name: idx_webauthn_credentials_device_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webauthn_credentials_device_fingerprint ON public.webauthn_credentials USING btree (device_fingerprint);


--
-- Name: ix_day_shift_doctors_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_day_shift_doctors_id ON public.day_shift_doctors USING btree (id);


--
-- Name: ix_doctor_schedule_update_logs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_doctor_schedule_update_logs_id ON public.doctor_schedule_update_logs USING btree (id);


--
-- Name: ix_doctor_schedules_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_doctor_schedules_date ON public.doctor_schedules USING btree (date);


--
-- Name: ix_doctor_schedules_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_doctor_schedules_id ON public.doctor_schedules USING btree (id);


--
-- Name: ix_overtime_config_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_overtime_config_id ON public.overtime_config USING btree (id);


--
-- Name: ix_overtime_monthly_scores_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_overtime_monthly_scores_month ON public.overtime_monthly_scores USING btree (month);


--
-- Name: ix_overtime_points_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_overtime_points_id ON public.overtime_points USING btree (id);


--
-- Name: ix_overtime_records_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_overtime_records_id ON public.overtime_records USING btree (id);


--
-- Name: ix_overtime_settings_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_overtime_settings_id ON public.overtime_settings USING btree (id);


--
-- Name: ix_overtime_summaries_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_overtime_summaries_id ON public.overtime_summaries USING btree (id);


--
-- Name: ix_schedule_overtimes_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_schedule_overtimes_date ON public.schedule_overtimes USING btree (date);


--
-- Name: ix_schedule_overtimes_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_schedule_overtimes_id ON public.schedule_overtimes USING btree (id);


--
-- Name: ix_schedule_version_diffs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_schedule_version_diffs_id ON public.schedule_version_diffs USING btree (id);


--
-- Name: ix_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_settings_key ON public.settings USING btree (key);


--
-- Name: ix_shift_rules_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shift_rules_id ON public.shift_rules USING btree (id);


--
-- Name: ix_shift_swap_requests_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shift_swap_requests_id ON public.shift_swap_requests USING btree (id);


--
-- Name: ix_webauthn_credentials_credential_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_webauthn_credentials_credential_id ON public.webauthn_credentials USING btree (credential_id);


--
-- Name: ix_webauthn_credentials_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_webauthn_credentials_id ON public.webauthn_credentials USING btree (id);


--
-- Name: announcement_permissions announcement_permissions_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_permissions
    ADD CONSTRAINT announcement_permissions_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id);


--
-- Name: announcement_permissions announcement_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_permissions
    ADD CONSTRAINT announcement_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: announcements announcements_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: announcements announcements_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.announcement_categories(id);


--
-- Name: day_shift_doctors day_shift_doctors_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_shift_doctors
    ADD CONSTRAINT day_shift_doctors_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.doctor_schedules(id);


--
-- Name: schedule_versions fk_base_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_versions
    ADD CONSTRAINT fk_base_version FOREIGN KEY (base_version_id) REFERENCES public.schedule_versions(id);


--
-- Name: formula_schedule_patterns formula_schedule_patterns_formula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formula_schedule_patterns
    ADD CONSTRAINT formula_schedule_patterns_formula_id_fkey FOREIGN KEY (formula_id) REFERENCES public.formula_schedules(id);


--
-- Name: logs logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: monthly_schedules monthly_schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_schedules
    ADD CONSTRAINT monthly_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: monthly_schedules monthly_schedules_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_schedules
    ADD CONSTRAINT monthly_schedules_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.schedule_versions(id);


--
-- Name: nurse_formula_assignments nurse_formula_assignments_formula_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_formula_assignments
    ADD CONSTRAINT nurse_formula_assignments_formula_id_fkey FOREIGN KEY (formula_id) REFERENCES public.formula_schedules(id);


--
-- Name: nurse_formula_assignments nurse_formula_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_formula_assignments
    ADD CONSTRAINT nurse_formula_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: overtime_monthly_scores overtime_monthly_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_monthly_scores
    ADD CONSTRAINT overtime_monthly_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: overtime_points overtime_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_points
    ADD CONSTRAINT overtime_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: overtime_records overtime_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_records
    ADD CONSTRAINT overtime_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: overtime_summaries overtime_summaries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_summaries
    ADD CONSTRAINT overtime_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pattern_nurse_assignments pattern_nurse_assignments_pattern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_nurse_assignments
    ADD CONSTRAINT pattern_nurse_assignments_pattern_id_fkey FOREIGN KEY (pattern_id) REFERENCES public.formula_schedule_patterns(id);


--
-- Name: pattern_nurse_assignments pattern_nurse_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_nurse_assignments
    ADD CONSTRAINT pattern_nurse_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: schedule_changes schedule_changes_base_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes
    ADD CONSTRAINT schedule_changes_base_version_id_fkey FOREIGN KEY (base_version_id) REFERENCES public.schedule_versions(id);


--
-- Name: schedule_changes schedule_changes_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes
    ADD CONSTRAINT schedule_changes_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: schedule_changes schedule_changes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes
    ADD CONSTRAINT schedule_changes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: schedule_changes schedule_changes_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes
    ADD CONSTRAINT schedule_changes_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.schedule_versions(id);


--
-- Name: schedule_overtimes schedule_overtimes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overtimes
    ADD CONSTRAINT schedule_overtimes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: schedule_overtimes schedule_overtimes_last_modified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overtimes
    ADD CONSTRAINT schedule_overtimes_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES public.users(id);


--
-- Name: schedule_overtimes schedule_overtimes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overtimes
    ADD CONSTRAINT schedule_overtimes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: schedule_version_diffs schedule_version_diffs_base_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_version_diffs
    ADD CONSTRAINT schedule_version_diffs_base_version_id_fkey FOREIGN KEY (base_version_id) REFERENCES public.schedule_versions(id);


--
-- Name: schedule_version_diffs schedule_version_diffs_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_version_diffs
    ADD CONSTRAINT schedule_version_diffs_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.schedule_versions(id);


--
-- Name: shift_swap_requests shift_swap_requests_acceptor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_acceptor_id_fkey FOREIGN KEY (acceptor_id) REFERENCES public.users(id);


--
-- Name: shift_swap_requests shift_swap_requests_requestor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_requestor_id_fkey FOREIGN KEY (requestor_id) REFERENCES public.users(id);


--
-- Name: shift_swap_requests shift_swap_requests_target_nurse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_target_nurse_id_fkey FOREIGN KEY (target_nurse_id) REFERENCES public.users(id);


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

