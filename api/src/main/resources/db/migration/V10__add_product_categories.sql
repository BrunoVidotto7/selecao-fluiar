create table product_categories (
    id         uuid primary key,
    office_id  uuid         not null references offices (id) on delete cascade,
    name       varchar(60)  not null,
    name_key   varchar(60)  not null,
    deleted_at timestamptz,
    created_at timestamptz  not null,
    updated_at timestamptz  not null,
    constraint uk_product_categories_office_key unique (office_id, name_key)
);

-- name_key must equal ProductCategory.keyOf(name): lowercase, no accents, single spaces.
create function seed_product_categories(p_office uuid) returns void
language sql as $$
    insert into product_categories (id, office_id, name, name_key, created_at, updated_at)
    select gen_random_uuid(), p_office, c.name, c.name_key, now(), now()
    from (values
        ('Marcenaria', 'marcenaria'),
        ('Mobiliário solto', 'mobiliario solto'),
        ('Pedras', 'pedras'),
        ('Louças e metais', 'loucas e metais'),
        ('Vidros e espelhos', 'vidros e espelhos'),
        ('Esquadrias', 'esquadrias'),
        ('Pisos, revestimentos e rodapés', 'pisos, revestimentos e rodapes'),
        ('Eletrodomésticos', 'eletrodomesticos'),
        ('Equipamentos', 'equipamentos'),
        ('Luminotécnica', 'luminotecnica'),
        ('Elétrica', 'eletrica'),
        ('Hidráulica', 'hidraulica'),
        ('Adornos', 'adornos'),
        ('Acessibilidade', 'acessibilidade'),
        ('Têxteis', 'texteis'),
        ('Forros', 'forros'),
        ('Acústica', 'acustica'),
        ('Tintas e texturas', 'tintas e texturas'),
        ('Outros', 'outros')
    ) as c (name, name_key)
$$;

select seed_product_categories(id) from offices;

-- A trigger seeds every new office, so the default list lives only here: provision-admin.sql and the tests inherit it.
create function seed_product_categories_for_new_office() returns trigger
language plpgsql as $$
begin
    perform seed_product_categories(new.id);
    return new;
end
$$;

create trigger trg_offices_seed_product_categories
    after insert on offices
    for each row execute function seed_product_categories_for_new_office();

alter table products add column category_id uuid references product_categories (id);

update products p
set category_id = (
    select pc.id
    from rooms r
    join shopping_lists l on l.id = r.list_id
    join clients c on c.id = l.client_id
    join product_categories pc on pc.office_id = c.office_id and pc.name_key = 'outros'
    where r.id = p.room_id
);

alter table products alter column category_id set not null;
create index ix_products_category_id on products (category_id);
