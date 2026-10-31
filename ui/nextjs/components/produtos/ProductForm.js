'use client';
import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import Button, { IconButton } from '../ui/Button';
import Icon from '../ui/Icon';
import { Field, Segmented, Select, TextInput, Textarea } from '../ui/Fields';
import { useConfirm, useToast, flash } from '../feedback/Feedback';
import useApiForm from '../forms/useApiForm';
import { brl, imageSource, parseBRL } from '@/lib/format';
import { PRODUCT_IMAGE_TYPES, validateField, validateProductImage } from '@/lib/validation';
import { saveProduct, deleteProduct, uploadProductImage, deleteProductImage } from './actions';
import { toProductRequest, validateProductLinks, productFieldMap } from './product-values';

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 999;
const PARTIAL_IMAGE_DETAIL = 'O produto foi salvo, mas a imagem não foi atualizada. Tente novamente.';
const DELETE_FAILED_DETAIL = 'Não conseguimos excluir agora. Tente novamente.';
const PRODUCT_RULES = {
  nome: { required: true, maxLength: 120 },
  amb: { required: 'Escolha o ambiente do produto.' },
  qtd: { required: true, integer: true, min: MIN_QUANTITY, max: MAX_QUANTITY },
  preco: { money: true },
  obs: { maxLength: 1000 },
};
const fmtPrice = (n) => (n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** @param {{ listId: string, product?: import('../listas/queries.server').ProductResponse, rooms: import('../listas/queries.server').RoomResponse[], defaultRoomId?: string }} props */
export default function ProductForm({ listId, product, rooms, defaultRoomId = '' }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const back = `/listas/${listId}`;
  const savedId = useRef(product?.id ?? null);
  const nextLinkId = useRef(product?.links?.length || 1);
  const linksRef = useRef(null);
  const mounted = useRef(true);
  const deletingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [persistedImageUrl, setPersistedImageUrl] = useState(product?.imageUrl ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [partialImageFailure, setPartialImageFailure] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const f = useApiForm({
    initial: {
      nome: product?.name || '', amb: product?.roomId || defaultRoomId,
      qtd: String(product?.quantity ?? MIN_QUANTITY), preco: fmtPrice(product?.unitPrice),
      obs: product?.notes || '', bought: product?.bought ?? false,
      links: product?.links?.length
        ? product.links.map((link, index) => ({ id: `row${index}`, url: link.url, note: link.note || '' }))
        : [{ id: 'row0', url: '', note: '' }],
    },
    rules: PRODUCT_RULES,
    validate: validateProductLinks,
    fieldMap: productFieldMap,
    action: async (values) => {
      const saved = await saveProduct(listId, savedId.current, toProductRequest(values));
      if (!saved.ok) return saved;
      savedId.current = saved.data.id;
      if (mounted.current) setPersistedImageUrl(saved.data.imageUrl);

      let imageResult;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        imageResult = await uploadProductImage(listId, savedId.current, formData);
      } else if (removeImage) {
        imageResult = await deleteProductImage(listId, savedId.current);
      }

      if (imageResult && !imageResult.ok) {
        if (mounted.current) setPartialImageFailure(true);
        return imageResult;
      }
      if (mounted.current) {
        if (imageResult) setPersistedImageUrl(file ? imageResult.data.imageUrl : null);
        setFile(null);
        setRemoveImage(false);
        setPartialImageFailure(false);
      }
      return saved;
    },
    onSuccess: (_data, _values, { go }) => go(back, 'Produto salvo na lista.'),
  });

  const busy = f.busy || deleting;
  const qty = Number(f.values.qtd);
  const setQty = (n) => f.setValue('qtd', String(Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, n))));
  const image = file ? previewUrl : removeImage ? null : imageSource(persistedImageUrl);
  const links = f.values.links;
  const updateLink = (id, name, value) => f.setValue('links', links.map((link) => link.id === id ? { ...link, [name]: value } : link));

  const pickImage = (selected) => {
    if (busy || !selected) return;
    const error = validateProductImage(selected);
    if (error) { toast(error, 'err'); return; }
    setFile(selected);
    setRemoveImage(false);
  };

  const removeProduct = () => confirm({
    title: `Excluir “${product.name}”?`,
    text: 'O produto sai da lista do cliente. Essa ação não pode ser desfeita.',
    confirmLabel: 'Excluir produto',
    onConfirm: async () => {
      if (deletingRef.current || f.busy) return;
      deletingRef.current = true;
      setDeleting(true);
      try {
        const result = await deleteProduct(listId, savedId.current);
        if (!mounted.current) return;
        if (!result.ok) { toast(result.detail, 'err'); return; }
        flash('Produto excluído.');
        router.push(back);
        router.refresh();
      } catch (error) {
        unstable_rethrow(error);
        if (mounted.current) toast(DELETE_FAILED_DETAIL, 'err');
      } finally {
        deletingRef.current = false;
        if (mounted.current) setDeleting(false);
      }
    },
  });

  const linkInput = (link, name) => {
    const id = `link-${link.id}-${name}`;
    return {
      id, value: link[name], 'aria-invalid': f.errors[id] ? 'true' : 'false',
      'aria-describedby': f.errors[id] ? `${id}-err` : undefined,
      onChange: (event) => updateLink(link.id, name, event.target.value),
    };
  };
  const preco = f.field('preco');

  return (
    <form className="card card-pad form" onSubmit={(event) => {
      if (deletingRef.current) event.preventDefault();
      else f.submit(event);
    }} noValidate>
      <div className="row2">
        <TextInput label="Nome do produto" placeholder="Ex.: Batedeira planetária" {...f.field('nome')} />
        <Select label="Ambiente" placeholder="Selecione" options={rooms.map((room) => ({ value: room.id, label: room.name }))} {...f.field('amb')} />
      </div>

      <Field id="img" as="span" label="Imagem do produto" optional>
        <label className={'drop' + (over ? ' over' : '')}
          onDragOver={(event) => { event.preventDefault(); if (!busy) setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(event) => { event.preventDefault(); setOver(false); pickImage(event.dataTransfer.files[0]); }}>
          <span className="thumb">{image ? <img src={image} alt="Prévia do produto" /> : <Icon name="image" />}</span>
          <span><b>{image ? 'Trocar imagem' : 'Escolher imagem'}</b><span>ou arraste o arquivo para cá. JPG ou PNG, até 5 MB.</span></span>
          <input type="file" id="img" disabled={busy} accept={PRODUCT_IMAGE_TYPES.join(',')} onChange={(event) => {
            pickImage(event.target.files[0]);
            event.target.value = '';
          }} />
        </label>
        {(file || (!removeImage && persistedImageUrl)) && <Button variant="text-danger" size="sm" disabled={busy}
          onClick={() => { setFile(null); setRemoveImage(Boolean(persistedImageUrl)); }}>Remover imagem</Button>}
        {partialImageFailure && <p className="errmsg" role="alert" style={{ margin: 0 }}>{PARTIAL_IMAGE_DETAIL}</p>}
      </Field>

      <div className="row2">
        <Field id="qtd" label="Quantidade" error={f.errors.qtd}>
          <div className="stepper">
            <button type="button" onClick={() => setQty((Number.isFinite(qty) ? qty : MIN_QUANTITY) - 1)} aria-label="Diminuir">−</button>
            <input id="qtd" type="number" min={MIN_QUANTITY} max={MAX_QUANTITY} step="1" inputMode="numeric" value={f.values.qtd}
              aria-invalid={f.errors.qtd ? 'true' : 'false'} aria-describedby={f.errors.qtd ? 'qtd-err' : undefined}
              onChange={(event) => f.setValue('qtd', event.target.value)} onBlur={f.field('qtd').onBlur} />
            <button type="button" onClick={() => setQty((Number.isFinite(qty) ? qty : MIN_QUANTITY) + 1)} aria-label="Aumentar">+</button>
          </div>
        </Field>
        <TextInput label="Preço unitário" prefix="R$" inputMode="decimal" placeholder="0,00" className="input num" {...preco}
          onBlur={() => {
            if (!validateField('preco', f.values, PRODUCT_RULES.preco) && f.values.preco.trim()) {
              f.setValue('preco', fmtPrice(parseBRL(f.values.preco)));
            } else preco.onBlur();
          }} />
      </div>
      <div className="total"><span>Total do item</span><b>{brl(parseBRL(f.values.preco) * (Number.isFinite(qty) ? qty : 0))}</b></div>

      <Field id="links" as="span" label="Link de compra" error={f.errors.links}>
        <div id="links" ref={linksRef} tabIndex={-1} aria-labelledby="links-l"
          aria-invalid={f.errors.links ? 'true' : 'false'} aria-describedby={f.errors.links ? 'links-err' : undefined}
          style={{ display: 'grid', gap: 8 }}>
          {links.map((link) => (
            <div className="linkrow" key={link.id}>
              <div>
                <input className="input" type="url" placeholder="Cole o link da loja" aria-label="Link da loja" {...linkInput(link, 'url')} />
                {f.errors[`link-${link.id}-url`] && <p className="errmsg" id={`link-${link.id}-url-err`}>{f.errors[`link-${link.id}-url`]}</p>}
              </div>
              <div>
                <input className="input" placeholder="Observação deste link" aria-label="Observação do link" {...linkInput(link, 'note')} />
                {f.errors[`link-${link.id}-note`] && <p className="errmsg" id={`link-${link.id}-note-err`}>{f.errors[`link-${link.id}-note`]}</p>}
              </div>
              <IconButton danger icon="x" label="Remover link" onClick={() => {
                f.setValue('links', links.length > 1
                  ? links.filter((row) => row.id !== link.id)
                  : [{ id: `row${nextLinkId.current++}`, url: '', note: '' }]);
              }} />
            </div>
          ))}
        </div>
        <Button variant="text" size="sm" icon="plus" style={{ justifySelf: 'start' }}
          onClick={() => {
            f.setValue('links', [...links, { id: `row${nextLinkId.current++}`, url: '', note: '' }]);
            setTimeout(() => linksRef.current?.lastChild?.querySelector('input')?.focus(), 0);
          }}>Adicionar outra opção de loja</Button>
      </Field>

      <Textarea label="Observações" optional placeholder="Ex.: preferir a versão com bowl de inox" {...f.field('obs')} />
      <Field id="st" as="span" label="Status">
        <Segmented radio name="st" label="Status" value={f.values.bought ? 'done' : 'pend'} onChange={(value) => f.setValue('bought', value === 'done')}
          options={[{ value: 'pend', label: 'Pendente' }, { value: 'done', label: 'Comprado' }]} />
      </Field>

      <div className="formfoot">
        {product && <Button variant="text-danger" icon="trash" className="left" disabled={busy} onClick={removeProduct}>Excluir produto</Button>}
        <Button variant="ghost" href={back}>Cancelar</Button>
        <Button type="submit" busy={busy}>{busy ? 'Salvando…' : 'Salvar produto'}</Button>
      </div>
    </form>
  );
}
