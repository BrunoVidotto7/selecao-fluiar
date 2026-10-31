create table clients (
    id         uuid primary key,
    office_id  uuid         not null references offices (id) on delete cascade,
    name       varchar(120) not null,
    email      varchar(254) not null,
    phone      varchar(11)  not null,
    created_at timestamptz  not null,
    updated_at timestamptz  not null
);
create index ix_clients_office_id on clients (office_id);

create table shopping_lists (
    id          uuid primary key,
    client_id   uuid         not null references clients (id) on delete cascade,
    name        varchar(120) not null,
    description varchar(500),
    share_token varchar(64)  not null,
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null,
    constraint uk_shopping_lists_share_token unique (share_token)
);
create index ix_shopping_lists_client_id on shopping_lists (client_id);

create table rooms (
    id         uuid primary key,
    list_id    uuid        not null references shopping_lists (id) on delete cascade,
    name       varchar(60) not null,
    position   int         not null,
    created_at timestamptz not null
);
create unique index uk_rooms_list_name on rooms (list_id, lower(name));

create table products (
    id         uuid primary key,
    room_id    uuid           not null references rooms (id) on delete cascade,
    name       varchar(120)   not null,
    quantity   int            not null check (quantity between 1 and 999),
    unit_price numeric(12, 2) check (unit_price >= 0),
    notes      varchar(1000),
    bought     boolean        not null default false,
    created_at timestamptz    not null,
    updated_at timestamptz    not null
);
create index ix_products_room_id on products (room_id);

create table product_links (
    product_id uuid          not null references products (id) on delete cascade,
    position   int           not null,
    url        varchar(2048) not null,
    note       varchar(200),
    primary key (product_id, position)
);

create table product_images (
    id           uuid primary key,
    product_id   uuid        not null references products (id) on delete cascade,
    content_type varchar(20) not null,
    data         bytea       not null,
    created_at   timestamptz not null,
    constraint uk_product_images_product unique (product_id)
);
