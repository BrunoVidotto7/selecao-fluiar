'use client';
import { useState } from 'react';
import { useRouter, unstable_rethrow } from 'next/navigation';
import Button from '../ui/Button';
import { TextInput } from '../ui/Fields';
import useApiForm from '../forms/useApiForm';
import { useConfirm, useToast } from '../feedback/Feedback';
import { CATEGORY_NAME_RULE } from '@/lib/validation';
import { createCategory, deleteCategory, renameCategory } from './actions';

// Form keys double as input ids, so each form needs its own (no two inputs may share id="name").
const NEW_NAME = 'new-category-name';
const DELETE_FAILED_DETAIL = 'Não conseguimos apagar agora. Tente novamente.';

const countLabel = (count) => (count === 1 ? '1 produto' : `${count} produtos`);

function deleteText(category) {
  const question = `Apagar a categoria ${category.name}?`;
  return category.productCount > 0
    ? `${question} ${countLabel(category.productCount)} ${category.productCount === 1 ? 'continua' : 'continuam'} com ela, mas ela some dos filtros.`
    : question;
}

function AddCategoryForm() {
  const router = useRouter();
  const f = useApiForm({
    initial: { [NEW_NAME]: '' },
    rules: { [NEW_NAME]: CATEGORY_NAME_RULE },
    fieldMap: { name: NEW_NAME },
    action: (values) => createCategory({ name: values[NEW_NAME] }),
    onSuccess: (data, submitted, { toast }) => {
      f.setValues((current) => (current[NEW_NAME] === submitted[NEW_NAME] ? { [NEW_NAME]: '' } : current));
      toast('Categoria adicionada.');
      router.refresh();
    },
  });
  return (
    <form className="form" onSubmit={f.submit} noValidate>
      <TextInput label="Nova categoria" {...f.field(NEW_NAME)} />
      <div className="btns"><Button type="submit" busy={f.busy}>{f.busy ? 'Adicionando…' : 'Adicionar'}</Button></div>
    </form>
  );
}

function RenameCategoryForm({ category, onDone }) {
  const router = useRouter();
  const key = `category-${category.id}-name`;
  const f = useApiForm({
    initial: { [key]: category.name },
    rules: { [key]: CATEGORY_NAME_RULE },
    fieldMap: { name: key },
    action: (values) => renameCategory(category.id, { name: values[key] }),
    onSuccess: (data, submitted, { toast }) => {
      toast('Categoria renomeada.');
      router.refresh();
      onDone();
    },
  });
  return (
    <form className="form" onSubmit={f.submit} noValidate>
      <TextInput label="Nome da categoria" {...f.field(key)} />
      <div className="btns">
        <Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : 'Salvar'}</Button>
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

function CategoryRow({ category }) {
  const [editing, setEditing] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();

  const askDelete = () => confirm({
    title: `Apagar ${category.name}?`,
    text: deleteText(category),
    confirmLabel: 'Apagar categoria',
    onConfirm: async () => {
      try {
        const result = await deleteCategory(category.id);
        if (!result.ok) {
          toast(result.detail, 'err');
          return;
        }
        toast('Categoria apagada.');
        router.refresh();
      } catch (error) {
        unstable_rethrow(error);
        toast(DELETE_FAILED_DETAIL, 'err');
      }
    },
  });

  if (editing) return <li><RenameCategoryForm category={category} onDone={() => setEditing(false)} /></li>;
  return (
    <li>
      <div className="office-person">
        <strong>{category.name}</strong>
        {category.productCount > 0 && <span className="meta">{countLabel(category.productCount)}</span>}
      </div>
      <Button variant="text" size="sm" icon="edit" aria-label={`Renomear ${category.name}`} onClick={() => setEditing(true)}>Renomear</Button>
      <Button variant="text-danger" size="sm" icon="trash" aria-label={`Apagar ${category.name}`} onClick={askDelete}>Apagar</Button>
    </li>
  );
}

export default function CategoryManager({ categories }) {
  return (
    <div className="settings">
      <section className="card setsec" aria-labelledby="categories-title">
        <div className="about">
          <h2 className="sec" id="categories-title">Categorias</h2>
          <p>Organizam os produtos das listas e aparecem como filtro para a equipe.</p>
        </div>
        <div>
          <ul className="rows office-rows">
            {categories.map((category) => <CategoryRow key={category.id} category={category} />)}
          </ul>
          <AddCategoryForm />
        </div>
      </section>
    </div>
  );
}
