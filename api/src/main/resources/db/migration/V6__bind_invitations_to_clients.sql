delete from office_invitations;
alter table office_invitations add column client_id uuid not null;
alter table office_invitations add constraint uk_invitations_client unique (client_id);
alter table office_invitations add constraint fk_invitations_client_office
    foreign key (client_id, office_id) references clients (id, office_id) on delete cascade;
