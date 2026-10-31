create table password_reset_tokens (
    id         uuid primary key,
    user_id    uuid        not null references users (id) on delete cascade,
    token_hash varchar(64) not null,
    expires_at timestamptz not null,
    created_at timestamptz not null,
    constraint uk_password_reset_tokens_hash unique (token_hash)
);
create index ix_password_reset_tokens_user_id on password_reset_tokens (user_id);
