alter table shopping_lists add column client_change_revision bigint not null default 0 check (client_change_revision >= 0);
alter table products
    add column client_purchase_revision bigint not null default 0 check (client_purchase_revision >= 0),
    add column client_purchase_changed_at timestamptz,
    add column client_purchase_value boolean,
    add column client_notes_revision bigint not null default 0 check (client_notes_revision >= 0),
    add column client_notes_changed_at timestamptz,
    add column client_notes_value varchar(1000),
    add constraint ck_client_purchase_change check (
        (client_purchase_revision = 0 and client_purchase_changed_at is null and client_purchase_value is null)
        or (client_purchase_revision > 0 and client_purchase_changed_at is not null and client_purchase_value is not null)),
    add constraint ck_client_notes_change check (
        (client_notes_revision = 0 and client_notes_changed_at is null and client_notes_value is null)
        or (client_notes_revision > 0 and client_notes_changed_at is not null));

create table list_client_change_reads (
    user_id uuid not null references users(id) on delete cascade,
    list_id uuid not null references shopping_lists(id) on delete cascade,
    seen_revision bigint not null check (seen_revision >= 0),
    primary key(user_id, list_id)
);
create index ix_list_client_change_reads_list_id on list_client_change_reads(list_id);
