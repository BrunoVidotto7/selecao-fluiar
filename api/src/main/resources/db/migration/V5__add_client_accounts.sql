alter table users add column role varchar(16);
alter table users add column client_id uuid;
update users set role = 'ADMIN', credentials_version = credentials_version + 1;
alter table users alter column role set not null;
alter table clients add constraint uk_clients_id_office unique (id, office_id);
alter table users add constraint uk_users_client unique (client_id);
alter table users add constraint fk_users_client_office
    foreign key (client_id, office_id) references clients (id, office_id) on delete cascade;
alter table users add constraint ck_users_role_client check (
    (role = 'ADMIN' and client_id is null) or (role = 'CLIENT' and client_id is not null)
);
delete from office_invitations;
