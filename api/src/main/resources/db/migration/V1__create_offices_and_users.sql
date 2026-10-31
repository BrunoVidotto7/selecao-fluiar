create table offices (
    id         uuid primary key,
    name       varchar(120) not null,
    created_at timestamptz  not null,
    updated_at timestamptz  not null
);

create table users (
    id                  uuid primary key,
    office_id           uuid         not null references offices (id) on delete cascade,
    name                varchar(120) not null,
    email               varchar(254) not null,
    password_hash       varchar(100) not null,
    credentials_version int          not null default 0,
    created_at          timestamptz  not null,
    updated_at          timestamptz  not null,
    constraint uk_users_email unique (email)
);
create index ix_users_office_id on users (office_id);
