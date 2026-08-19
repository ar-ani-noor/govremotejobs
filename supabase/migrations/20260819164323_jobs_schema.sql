-- GovRemoteJobs core schema: jobs + ingest_runs.
-- Grant model (learned on Middle Path, ADR-0006 there): the CLI migration
-- role's objects inherit no default privileges, and service_role needs
-- explicit table grants (RLS bypass != table privilege). Everything is
-- granted in this same migration.

create table public.jobs (
  id               bigint generated always as identity primary key,
  source           text not null,                -- 'usajobs' | 'greenhouse:leidos' | 'ny' ...
  source_id        text not null,                -- USAJOBS control number / ATS posting id
  slug             text not null unique,         -- immutable once created
  title            text not null,
  employer         text not null,                -- agency or company name
  employer_type    text not null,                -- federal | contractor | state
  department       text,
  salary_min       numeric,
  salary_max       numeric,
  salary_interval  text,                         -- YEAR | HOUR
  pay_scale        text,                         -- GS, SES, ...
  grade_low        text,
  grade_high       text,
  location_policy  text not null,                -- remote | telework
  applicant_location text not null default 'US', -- country/state eligibility for JSON-LD
  summary          text,
  description_html text not null,
  category_code    text,                         -- occupational series (federal)
  category_name    text,
  hiring_paths     text[] not null default '{}',
  employment_type  text,                         -- FULL_TIME | PART_TIME | ...
  posted_at        date not null,
  closes_at        date,                         -- null for feeds without close dates
  apply_url        text not null,                -- the ORIGINAL posting (linkback is a ToS hard rule)
  status           text not null default 'active',
  content_hash     text not null,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  closed_at        timestamptz,
  unique (source, source_id),
  constraint jobs_employer_type_valid check (employer_type in ('federal','contractor','state')),
  constraint jobs_location_policy_valid check (location_policy in ('remote','telework')),
  constraint jobs_status_valid check (status in ('active','closed')),
  constraint jobs_salary_interval_valid check (salary_interval is null or salary_interval in ('YEAR','HOUR'))
);

create index jobs_status_idx        on public.jobs (status);
create index jobs_employer_idx      on public.jobs (employer_type, employer) where status = 'active';
create index jobs_category_idx      on public.jobs (category_code) where status = 'active';
create index jobs_closes_at_idx     on public.jobs (closes_at) where status = 'active';
create index jobs_closed_purge_idx  on public.jobs (closed_at) where status = 'closed';

create table public.ingest_runs (
  id          bigint generated always as identity primary key,
  source      text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  fetched     integer not null default 0,
  inserted    integer not null default 0,
  updated     integer not null default 0,
  closed      integer not null default 0,
  errors      integer not null default 0,
  ok          boolean,
  notes       text
);

-- RLS: public read of ACTIVE jobs only (the Astro build uses the anon key;
-- tombstoned rows are pipeline-internal). ingest_runs is not public.
alter table public.jobs enable row level security;
alter table public.ingest_runs enable row level security;

create policy "Active jobs are publicly readable"
  on public.jobs for select
  using (status = 'active');

-- Grants (explicit; see header comment)
grant usage on schema public to anon, authenticated, service_role;
grant select on public.jobs to anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
