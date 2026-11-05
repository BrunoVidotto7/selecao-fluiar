create table list_human_activity (
    list_id uuid primary key references shopping_lists(id) on delete cascade,
    last_human_activity_at timestamptz not null
);
create index ix_list_human_activity_recent on list_human_activity(last_human_activity_at);
alter table products
    add column source_url varchar(2048),
    add column store varchar(40),
    add column store_product_id varchar(512),
    add column variant_id varchar(512),
    add column sync_enabled boolean not null default false,
    add column binding_version uuid,
    add column last_attempt_at timestamptz,
    add column last_synced_at timestamptz,
    add column next_attempt_at timestamptz,
    add column sync_status varchar(20),
    add column lease_token uuid,
    add column lease_expires_at timestamptz;
create index ix_products_sync_due on products(store,next_attempt_at) where sync_enabled and not bought;
