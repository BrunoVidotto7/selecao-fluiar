create table office_invitations (
    id                 uuid primary key,
    office_id          uuid         not null references offices (id) on delete cascade,
    email              varchar(254) not null,
    invited_by_user_id uuid         not null references users (id) on delete cascade,
    token_hash         varchar(64)  not null,
    expires_at         timestamptz  not null,
    created_at         timestamptz  not null,
    constraint uk_office_invitations_hash unique (token_hash),
    constraint uk_office_invitations_office_email unique (office_id, email)
);
