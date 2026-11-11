create table list_members (
    id         uuid primary key,
    list_id    uuid        not null references shopping_lists (id) on delete cascade,
    client_id  uuid        not null references clients (id) on delete cascade,
    role       varchar(16) not null check (role in ('EDITOR', 'READER')),
    created_at timestamptz not null,
    constraint uk_list_members_list_client unique (list_id, client_id)
);
create index ix_list_members_client_id on list_members (client_id);

create table product_client_notes (
    id         uuid primary key,
    product_id uuid        not null references products (id) on delete cascade,
    client_id  uuid        not null references clients (id) on delete cascade,
    text       varchar(1000),
    revision   bigint      not null default 0 check (revision >= 0),
    changed_at timestamptz,
    updated_at timestamptz not null,
    constraint uk_product_client_notes_product_client unique (product_id, client_id),
    constraint ck_product_client_notes_change check (
        (revision = 0 and changed_at is null) or (revision > 0 and changed_at is not null))
);
create index ix_product_client_notes_client_id on product_client_notes (client_id);

insert into product_client_notes (id, product_id, client_id, text, revision, changed_at, updated_at)
select gen_random_uuid(), p.id, l.client_id, p.client_notes, p.client_notes_revision, p.client_notes_changed_at, p.updated_at
from products p
join rooms r on r.id = p.room_id
join shopping_lists l on l.id = r.list_id
where p.client_notes is not null or p.client_notes_revision > 0;

alter table products add column client_purchase_client_id uuid references clients (id) on delete set null;

update products p
set client_purchase_client_id = l.client_id
from rooms r
join shopping_lists l on l.id = r.list_id
where r.id = p.room_id and p.client_purchase_revision > 0;

alter table products
    drop constraint ck_client_notes_change,
    drop column client_notes,
    drop column client_notes_revision,
    drop column client_notes_changed_at,
    drop column client_notes_value;

alter table shopping_lists
    add column project_code varchar(40),
    add column contract varchar(120),
    add column contractor_name varchar(120),
    add column contractor_document varchar(14),
    add column site_zip_code varchar(8),
    add column site_address varchar(300);

create index ix_products_client_purchase_client_id on products (client_purchase_client_id);
