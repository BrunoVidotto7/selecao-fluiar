alter table products add column unit varchar(20) not null default 'UNIT';
alter table products add constraint products_unit_check check (unit in ('UNIT', 'SQUARE_METER'));

alter table products drop constraint products_quantity_check;
alter table products alter column quantity type numeric(5, 2) using quantity;
alter table products add constraint products_quantity_check check (quantity between 0.01 and 999.99);
alter table products add constraint products_quantity_unit_check check (unit = 'SQUARE_METER' or quantity = trunc(quantity));
