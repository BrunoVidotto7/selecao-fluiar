'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button, { IconButton } from '../ui/Button';
import Icon from '../ui/Icon';
import { Field, Segmented, Select, TextInput, Textarea } from '../ui/Fields';
import { useConfirm, useToast, flash } from '../feedback/Feedback';
import useDemoForm from '../forms/useDemoForm';
import { brl, parseBRL } from '@/lib/format';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const fmtPrice = (n) => (n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export default function ProductForm({ listId, product, rooms, defaultRoom = '' }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const back = `/listas/${listId}`;
  const [links, setLinks] = useState(product?.links?.length ? product.links.map(([u, n]) => ({ u, n })) : [{ u: '', n: '' }]);
  const [status, setStatus] = useState(product?.bought ? 'done' : 'pend');
  const [image, setImage] = useState(product?.image || null);
  const [over, setOver] = useState(false);
  const linksRef = useRef(null);

  const f = useDemoForm({
    initial: { nome: product?.name || '', amb: product?.room || defaultRoom, qtd: String(product?.qty || 1), preco: fmtPrice(product?.price), obs: product?.notes || '' },
    rules: { nome: { required: true }, amb: { required: 'Escolha o ambiente do produto.' }, qtd: { required: true, min: 1 } },
    onSuccess: (v, { go }) => {
      const bad = links.find((l) => l.u && !/^https?:\/\/\S+\.\S+$/.test(l.u));
      if (bad) { toast('Cole o link completo, começando com https://', 'err'); return; }
      go(back, 'Produto salvo na lista.');
    },
  });

  const qty = Math.max(1, +f.values.qtd || 1);
  const setQty = (n) => f.setValue('qtd', String(Math.max(1, n)));

  const pickImage = (file) => {
    if (!file || !IMAGE_TYPES.includes(file.type)) { toast('Escolha um arquivo de imagem (JPG ou PNG).', 'err'); return; }
    if (file.size > MAX_IMAGE_BYTES) { toast('A imagem deve ter até 5 MB.', 'err'); return; }
    const r = new FileReader(); r.onload = () => setImage(r.result); r.readAsDataURL(file);
  };

  const removeProduct = () => confirm({
    title: `Excluir “${product.name}”?`, text: 'O produto sai da lista do cliente. Essa ação não pode ser desfeita.', confirmLabel: 'Excluir produto',
    onConfirm: () => { flash('Produto excluído.'); router.push(back); },
  });

  const preco = f.field('preco');

  return (
    <form className="card card-pad form" onSubmit={f.submit} noValidate>
      <div className="row2">
        <TextInput label="Nome do produto" placeholder="Ex.: Batedeira planetária" {...f.field('nome')} />
        <Select label="Ambiente" placeholder="Selecione" options={rooms} {...f.field('amb')} />
      </div>

      <Field id="img" as="span" label="Imagem do produto" optional>
        <label className={'drop' + (over ? ' over' : '')}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pickImage(e.dataTransfer.files[0]); }}>
          <span className="thumb">{image ? <img src={image} alt="Prévia do produto" /> : <Icon name="image" />}</span>
          <span><b>{image ? 'Trocar imagem' : 'Escolher imagem'}</b><span>ou arraste o arquivo para cá. JPG ou PNG, até 5 MB.</span></span>
          <input type="file" id="img" accept={IMAGE_TYPES.join(',')} onChange={(e) => pickImage(e.target.files[0])} />
        </label>
      </Field>

      <div className="row2">
        <Field id="qtd" label="Quantidade" error={f.errors.qtd}>
          <div className="stepper">
            <button type="button" onClick={() => setQty(qty - 1)} aria-label="Diminuir">−</button>
            <input id="qtd" type="number" min="1" inputMode="numeric" value={f.values.qtd}
              aria-invalid={f.errors.qtd ? 'true' : 'false'} aria-describedby={f.errors.qtd ? 'qtd-err' : undefined} onChange={(e) => f.setValue('qtd', e.target.value)} onBlur={() => setQty(qty)} />
            <button type="button" onClick={() => setQty(qty + 1)} aria-label="Aumentar">+</button>
          </div>
        </Field>
        <TextInput label="Preço unitário" prefix="R$" inputMode="decimal" placeholder="0,00" className="input num" {...preco}
          onBlur={() => { const n = parseBRL(f.values.preco); f.setValue('preco', n ? fmtPrice(n) : ''); }} />
      </div>
      <div className="total"><span>Total do item</span><b>{brl(parseBRL(f.values.preco) * qty)}</b></div>

      <Field id="links" as="span" label="Link de compra">
        <div ref={linksRef} style={{ display: 'grid', gap: 8 }}>
          {links.map((l, i) => (
            <div className="linkrow" key={i}>
              <input className="input" type="url" placeholder="Cole o link da loja" aria-label="Link da loja" value={l.u}
                onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, u: e.target.value } : x)))} />
              <input className="input" placeholder="Observação deste link" aria-label="Observação do link" value={l.n}
                onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, n: e.target.value } : x)))} />
              <IconButton danger icon="x" label="Remover link" onClick={() => setLinks(links.length > 1 ? links.filter((_, j) => j !== i) : [{ u: '', n: '' }])} />
            </div>
          ))}
        </div>
        <Button variant="text" size="sm" icon="plus" style={{ justifySelf: 'start' }}
          onClick={() => { setLinks([...links, { u: '', n: '' }]); setTimeout(() => linksRef.current?.lastChild?.querySelector('input')?.focus(), 0); }}>
          Adicionar outra opção de loja
        </Button>
      </Field>

      <Textarea label="Observações" optional placeholder="Ex.: preferir a versão com bowl de inox" {...f.field('obs')} />

      <Field id="st" as="span" label="Status">
        <Segmented radio name="st" label="Status" value={status} onChange={setStatus}
          options={[{ value: 'pend', label: 'Pendente' }, { value: 'done', label: 'Comprado' }]} />
      </Field>

      <div className="formfoot">
        {product && <Button variant="text-danger" icon="trash" className="left" onClick={removeProduct}>Excluir produto</Button>}
        <Button variant="ghost" href={back}>Cancelar</Button>
        <Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : 'Salvar produto'}</Button>
      </div>
    </form>
  );
}
