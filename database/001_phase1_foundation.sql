-- Artiling Jobs Phase 1 — PostgreSQL foundation
-- UUID generation requires pgcrypto. Apply inside a transaction on a new database.
begin;
create extension if not exists pgcrypto;

create type user_role as enum ('ADMIN','MANAGER','FABRICATION','INSTALLER','VIEWER');
create type priority_level as enum ('HIGH','NORMAL','LOW');
create type waiting_party as enum ('CLIENT','IOANNIS','ARTAN','SUPPLIER','INSTALLATION_TEAM','OTHER','NOTHING');
create type project_type as enum ('BESPOKE_PORCELAIN_SINK','VANITY_AND_SINK','VANITY_TOP','WET_ROOM','LARGE_FORMAT_TILING','FEATURE_WALL','PORCELAIN_STAIRS','OTHER_BESPOKE_FABRICATION','OTHER');
create type lead_status as enum ('NEW','INFO_NEEDED','DESIGN_DISCUSSION','READY_TO_PRICE','WAITING_FOR_ARTAN','READY_TO_QUOTE','QUOTE_IN_PREPARATION','QUOTE_SENT','WAITING_FOR_CLIENT','MATERIAL_SELECTION','SAMPLES_TO_SEND','SAMPLES_SENT','WAITING_FOR_SAMPLE_FEEDBACK','SITE_VISIT_NEEDED','SITE_VISIT_PROPOSED','SITE_VISIT_BOOKED','TEMPLATE_REQUIRED','WAITING_FOR_DEPOSIT','APPROVED','WON','LOST','DORMANT');
create type quote_status as enum ('DRAFT','READY_FOR_REVIEW','ARTAN_REVIEW_NEEDED','APPROVED_INTERNALLY','SENT','REVISED','ACCEPTED','DECLINED','SUPERSEDED');
create type review_status as enum ('NOT_REQUIRED','REQUESTED','APPROVED','CHANGES_REQUESTED');
create type quote_category as enum ('FABRICATION','PORCELAIN_MATERIAL','VANITY','DRAWERS','PORCELAIN_CLADDING','SPLASHBACK_UPSTAND','ADDITIONAL_TAP_HOLES','OVERFLOW','REINFORCEMENT','TEMPLATE_VISIT','DELIVERY','INSTALLATION','OTHER');
create type job_status as enum ('CONFIRMED','DEPOSIT_PENDING','DEPOSIT_RECEIVED','MATERIAL_PENDING','MATERIAL_CONFIRMED','TEMPLATE_REQUIRED','TEMPLATE_BOOKED','TEMPLATE_COMPLETE','READY_FOR_FABRICATION','IN_FABRICATION','FABRICATION_COMPLETE','QUALITY_CHECK','READY_FOR_DELIVERY','DELIVERY_BOOKED','DELIVERED','INSTALLATION_BOOKED','INSTALLED','COMPLETED','ON_HOLD','CANCELLED');
create type job_health as enum ('GREEN','AMBER','RED');
create type task_status as enum ('TODO','IN_PROGRESS','WAITING','DONE');
create type payment_status as enum ('DUE','UPCOMING','OVERDUE','PAID','CANCELLED');
create type availability_status as enum ('UNKNOWN','AVAILABLE','LOW_STOCK','SPECIAL_ORDER','OUT_OF_STOCK','DISCONTINUED');

create table users (id uuid primary key default gen_random_uuid(), email text not null unique, display_name text not null, role user_role not null default 'VIEWER', active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table clients (id uuid primary key default gen_random_uuid(), name text not null, company text, email text, phone text, preferred_contact text, billing_address text, notes text, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index clients_email_unique on clients(lower(email)) where email is not null and archived_at is null;

create table leads (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references clients(id) on delete restrict,
 project_title text not null, project_type project_type not null, description text, lead_source text,
 status lead_status not null default 'NEW', priority priority_level not null default 'NORMAL', project_address text, postcode text,
 waiting_for waiting_party not null default 'NOTHING', waiting_for_detail text, next_action text, next_action_owner text, next_action_due date,
 last_client_contact_at timestamptz, last_artiling_contact_at timestamptz, artans_review_required boolean not null default false,
 won_at timestamptz, lost_at timestamptz, lost_reason text, archived_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index leads_status_idx on leads(status); create index leads_client_idx on leads(client_id); create index leads_next_action_due_idx on leads(next_action_due) where archived_at is null;

create table lead_specifications (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references leads(id) on delete restrict, version integer not null default 1,
 quantity integer, width_mm numeric(10,2), depth_mm numeric(10,2), height_mm numeric(10,2), basin_width_mm numeric(10,2), basin_depth_mm numeric(10,2),
 mounting_type text, slope_type text, drain_type text, tap_arrangement text, tap_holes integer,
 vanity_required boolean not null default false, drawer_configuration text, cladding_required boolean not null default false,
 splashback_required boolean not null default false, overflow_required boolean not null default false, reinforcement_required boolean not null default false,
 material_supply_type text, finish text, special_requirements text, technical_notes text, is_current boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(lead_id,version)
);
create unique index current_lead_specification on lead_specifications(lead_id) where is_current;

create table quotes (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references leads(id) on delete restrict, job_id uuid,
 quote_number text not null, version integer not null default 1, status quote_status not null default 'DRAFT', quote_date date not null,
 valid_until date, subtotal numeric(12,2) not null default 0 check(subtotal>=0), vat numeric(12,2) not null default 0 check(vat>=0), total numeric(12,2) not null default 0 check(total>=0),
 artans_review_status review_status not null default 'NOT_REQUIRED', artans_reviewed_at timestamptz, revision_reason text,
 parent_quote_id uuid references quotes(id) on delete restrict, client_notes text, internal_notes text, archived_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(quote_number,version)
);
create table quote_items (id uuid primary key default gen_random_uuid(), quote_id uuid not null references quotes(id) on delete restrict, category quote_category not null, description text not null, quantity numeric(10,2) not null default 1 check(quantity>=0), unit_price numeric(12,2) not null default 0 check(unit_price>=0), total numeric(12,2) not null default 0 check(total>=0), is_optional boolean not null default false, is_included boolean not null default true, client_note text, internal_note text, sort_order integer not null default 0, created_at timestamptz not null default now());

create table jobs (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null unique references leads(id) on delete restrict, client_id uuid not null references clients(id) on delete restrict,
 project_title text not null, project_type project_type not null, status job_status not null default 'CONFIRMED', health job_health not null default 'GREEN', health_reason text,
 project_address text, postcode text, accepted_quote_id uuid references quotes(id) on delete restrict, project_value numeric(12,2) not null default 0 check(project_value>=0),
 start_date date, target_completion_date date, actual_completion_date date, waiting_for waiting_party not null default 'NOTHING', next_action text, next_action_owner text,
 completed_at timestamptz, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table quotes add constraint quotes_job_fk foreign key(job_id) references jobs(id) on delete restrict;

create table materials (id uuid primary key default gen_random_uuid(), name text not null, manufacturer text, supplier text, style_category text, finish text, colour text, slab_width_mm numeric(10,2), slab_height_mm numeric(10,2), product_url text, supplier_reference text, cost numeric(12,2) check(cost>=0), availability_status availability_status not null default 'UNKNOWN', availability_checked_at timestamptz, sample_available boolean not null default false, notes text, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table tasks (id uuid primary key default gen_random_uuid(), lead_id uuid references leads(id) on delete restrict, quote_id uuid references quotes(id) on delete restrict, job_id uuid references jobs(id) on delete restrict, title text not null, description text, owner text, priority priority_level not null default 'NORMAL', status task_status not null default 'TODO', due_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(num_nonnulls(lead_id,quote_id,job_id)<=1));
create table events (id uuid primary key default gen_random_uuid(), lead_id uuid references leads(id) on delete restrict, job_id uuid references jobs(id) on delete restrict, event_type text not null, title text not null, start_at timestamptz not null, end_at timestamptz, location text, assigned_to text, status text not null default 'PLANNED', notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(end_at is null or end_at>=start_at));
create table payments (id uuid primary key default gen_random_uuid(), job_id uuid not null references jobs(id) on delete restrict, payment_type text not null, amount numeric(12,2) not null check(amount>=0), due_date date, paid_date date, status payment_status not null default 'UPCOMING', reference text, invoice_document_id uuid, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check((status='PAID' and paid_date is not null) or status<>'PAID'));
create table documents (id uuid primary key default gen_random_uuid(), client_id uuid references clients(id) on delete restrict, lead_id uuid references leads(id) on delete restrict, quote_id uuid references quotes(id) on delete restrict, job_id uuid references jobs(id) on delete restrict, material_id uuid references materials(id) on delete restrict, payment_id uuid references payments(id) on delete restrict, category text not null, title text not null, file_url text, file_name text, mime_type text, notes text, uploaded_at timestamptz not null default now(), uploaded_by text not null);
alter table payments add constraint payments_invoice_document_fk foreign key(invoice_document_id) references documents(id) on delete set null;
create table notes (id uuid primary key default gen_random_uuid(), lead_id uuid references leads(id) on delete restrict, job_id uuid references jobs(id) on delete restrict, category text not null, content text not null, is_pinned boolean not null default false, created_by text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(num_nonnulls(lead_id,job_id)=1));
create table activity_log (id uuid primary key default gen_random_uuid(), client_id uuid references clients(id) on delete restrict, lead_id uuid references leads(id) on delete restrict, quote_id uuid references quotes(id) on delete restrict, job_id uuid references jobs(id) on delete restrict, action text not null, description text not null, old_value_json jsonb, new_value_json jsonb, created_by text not null, created_at timestamptz not null default now());
create index tasks_due_idx on tasks(due_at) where status<>'DONE'; create index events_start_idx on events(start_at); create index payments_due_idx on payments(due_date) where status not in ('PAID','CANCELLED'); create index activity_lead_idx on activity_log(lead_id,created_at desc); create index activity_job_idx on activity_log(job_id,created_at desc);
commit;
