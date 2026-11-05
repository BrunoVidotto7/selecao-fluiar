\set ON_ERROR_STOP on
begin;
insert into offices (id, name, created_at, updated_at)
values (:'office_id'::uuid, :'office_name', now(), now())
on conflict (id) do nothing;

insert into users (id, office_id, name, email, password_hash, credentials_version, role, created_at, updated_at)
values (:'user_id'::uuid, :'office_id'::uuid, :'name', lower(trim(:'email')), :'password_hash', 0, 'ADMIN', now(), now());
commit;
