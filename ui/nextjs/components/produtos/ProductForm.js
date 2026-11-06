'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { unstable_rethrow, useRouter } from 'next/navigation';
import Button, { IconButton } from '../ui/Button';
import Icon from '../ui/Icon';
import { Field, Segmented, Select, TextInput, Textarea } from '../ui/Fields';
import { useConfirm, useToast, flash } from '../feedback/Feedback';
import useApiForm from '../forms/useApiForm';
import { brl, imageSource, parseBRL } from '@/lib/format';
import { CATEGORY_REQUIRED, PRODUCT_IMAGE_TYPES, validateField, validateProductImage } from '@/lib/validation';
import { UNIT_OPTIONS, parseQuantity, quantityRule } from '@/lib/quantity';
import { saveProduct, deleteProduct, uploadProductImage, deleteProductImage, findProductImages, uploadProductImageFromUrl, previewStoreProduct } from './actions';
import StoreSyncStatus from './StoreSyncStatus';
import { toProductRequest, validateProductLinks, productFieldMap, storeSyncChange } from './product-values';

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 999;
const PARTIAL_IMAGE_DETAIL = 'O produto foi salvo, mas a imagem não foi atualizada. Tente novamente.';
const DELETE_FAILED_DETAIL = 'Não conseguimos excluir agora. Tente novamente.';
const IMAGE_SEARCH_FAILED_DETAIL = 'Não conseguimos buscar imagens nesse link. Tente novamente.';
const NO_IMAGES_DETAIL = 'Nenhuma imagem encontrada nesse link.';
const LINK_REQUIRED_DETAIL = 'Cole o link da página do produto.';
const PRODUCT_RULES = {
  nome: { required: true, maxLength: 120 },
  amb: { required: 'Escolha o ambiente do produto.' },
  categoryId: { required: CATEGORY_REQUIRED },
  preco: { money: true },
  obs: { maxLength: 1000 },
};
const fmtPrice = (n) => (n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** @param {{ listId: string, product?: import('../listas/queries.server').ProductResponse, rooms: import('../listas/queries.server').RoomResponse[], categories: { id: string, name: string }[], defaultRoomId?: string }} props */
export default function ProductForm({ listId, product, rooms, categories, defaultRoomId = '' }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const back = `/listas/${listId}`;
  const savedId = useRef(product?.id ?? null);
  const nextLinkId = useRef(product?.links?.length || 1);
  const linksRef = useRef(null);
  const mounted = useRef(true);
  const deletingRef = useRef(false);
  const searchingImagesRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [importedImage, setImportedImage] = useState(null);
  const [imageLink, setImageLink] = useState(product?.storeSync?.sourceUrl || '');
  const [storePreview, setStorePreview] = useState(null);
  const [variantId, setVariantId] = useState('');
  const [searchingProduct, setSearchingProduct] = useState(false);
  const searchingProductRef = useRef(false);
  const [imageChoices, setImageChoices] = useState([]);
  const [searchingImages, setSearchingImages] = useState(false);
  const [imageChoiceError, setImageChoiceError] = useState('');
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
      nome: product?.name || '', amb: product?.roomId || defaultRoomId, categoryId: product?.category?.id || '',
      qtd: String(product?.quantity ?? MIN_QUANTITY).replace('.', ','), unidade: product?.unit ?? 'UNIT', preco: fmtPrice(product?.unitPrice),
      obs: product?.notes || '', bought: product?.bought ?? false,
      links: product?.links?.length
        ? product.links.map((link, index) => ({ id: `row${index}`, url: link.url, note: link.note || '' }))
        : [{ id: 'row0', url: '', note: '' }],
    },
    rules: PRODUCT_RULES,
    validate: (values) => ({
      ...validateProductLinks(values),
      ...Object.fromEntries([['qtd', validateField('qtd', values, quantityRule(values.unidade))]].filter(([, message]) => message)),
    }),
    fieldMap: productFieldMap,
    action: async (values) => {
      const request = toProductRequest(values);
      const binding = storeSyncChange(request, product, storePreview, { file, removeImage, importedImage });
      if (binding !== undefined) request.storeSync = binding;
      const saved = await saveProduct(listId, savedId.current, request);
      if (!saved.ok) return saved;
      savedId.current = saved.data.id;
      if (mounted.current) setPersistedImageUrl(saved.data.imageUrl);

      let imageResult;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        imageResult = await uploadProductImage(listId, savedId.current, formData);
      } else if (importedImage && !request.storeSync) {
        imageResult = await uploadProductImageFromUrl(listId, savedId.current, importedImage);
      } else if (removeImage) {
        imageResult = await deleteProductImage(listId, savedId.current);
      }

      if (imageResult && !imageResult.ok) {
        if (mounted.current) setPartialImageFailure(true);
        return imageResult;
      }
      if (mounted.current) {
        if (imageResult) setPersistedImageUrl(file || importedImage ? imageResult.data.imageUrl : null);
        setFile(null);
        setImportedImage(null);
        setRemoveImage(false);
        setPartialImageFailure(false);
      }
      return saved;
    },
    onSuccess: (_data, _values, { go }) => go(back, 'Produto salvo na lista.'),
  });

  const busy = f.busy || deleting || searchingImages || searchingProduct;
  const isUnit = f.values.unidade === 'UNIT';
  const qty = parseQuantity(f.values.qtd);
  const setQty = (n) => f.setValue('qtd', String(Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(n)))));
  const image = file ? previewUrl : importedImage || (removeImage ? null : imageSource(persistedImageUrl));
  const links = f.values.links;
  const updateLink = (id, name, value) => f.setValue('links', links.map((link) => link.id === id ? { ...link, [name]: value } : link));

  const pickImage = (selected) => {
    if (busy || !selected) return;
    const error = validateProductImage(selected);
    if (error) { toast(error, 'err'); return; }
    setFile(selected);
    setImportedImage(null);
    setRemoveImage(false);
  };

  const searchProduct = async () => {
    if (busy || searchingProductRef.current) return;
    if (!imageLink.trim()) { setImageChoiceError(LINK_REQUIRED_DETAIL); return; }
    searchingProductRef.current = true;
    setSearchingProduct(true);
    setImageChoiceError('');
    try {
      const result = await previewStoreProduct(imageLink.trim(), variantId || undefined);
      if (!mounted.current) return;
      if (!result.ok) { setImageChoiceError(result.detail); return; }
      const preview = result.data;
      setStorePreview(preview);
      if (preview.resolution !== 'resolved') {
        setImageChoiceError(preview.resolution === 'variant_required' ? 'Escolha uma versão e busque o produto novamente.' : 'Não foi possível identificar o produto e o preço com segurança. Você pode cadastrar manualmente.');
        return;
      }
      setVariantId(preview.variantId || '');
      f.setValues((values) => ({ ...values, nome: preview.name, preco: fmtPrice(preview.unitPrice) }));
      setImportedImage(preview.imageUrl);
      setFile(null);
      setRemoveImage(false);
    } catch (error) {
      unstable_rethrow(error);
      if (mounted.current) setImageChoiceError('Não conseguimos buscar esse produto. Tente novamente ou cadastre manualmente.');
    } finally {
      searchingProductRef.current = false;
      if (mounted.current) setSearchingProduct(false);
    }
  };

  const submitProduct = (event) => {
    if (deletingRef.current || searchingImagesRef.current || searchingProductRef.current || f.busy) { event.preventDefault(); return; }
    const request = toProductRequest(f.values);
    const binding = storeSyncChange(request, product, storePreview, { file, removeImage, importedImage });
    if (binding !== null) { f.submit(event); return; }
    event.preventDefault();
    const form = event.currentTarget;
    confirm({
      title: 'Salvar como produto manual?',
      text: 'Alterar nome, preço ou foto desliga a atualização automática de todo o produto.',
      confirmLabel: 'Salvar como manual',
      onConfirm: () => { if (mounted.current) f.submit({ preventDefault() {}, currentTarget: form }); },
    });
  };

  const searchImages = async () => {
    if (busy || searchingImagesRef.current) return;
    if (!imageLink.trim()) { setImageChoiceError(LINK_REQUIRED_DETAIL); return; }
    searchingImagesRef.current = true;
    setSearchingImages(true);
    setImageChoices([]);
    setImageChoiceError('');
    try {
      const result = await findProductImages(imageLink.trim());
      if (!mounted.current) return;
      if (!result.ok) { setImageChoiceError(result.detail); return; }
      setImageChoices(result.data.images);
      if (!result.data.images.length) setImageChoiceError(NO_IMAGES_DETAIL);
    } catch (error) {
      unstable_rethrow(error);
      if (mounted.current) setImageChoiceError(IMAGE_SEARCH_FAILED_DETAIL);
    } finally {
      searchingImagesRef.current = false;
      if (mounted.current) setSearchingImages(false);
    }
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
  const categoryOptions = categories.map((category) => ({ value: category.id, label: category.name }));
  if (product?.category?.deleted) categoryOptions.push({ value: product.category.id, label: `${product.category.name} (removida)` });

  return (
    <form className="card card-pad form" onSubmit={submitProduct} noValidate>
      <div className="row2">
        <TextInput label="Nome do produto" placeholder="Ex.: Batedeira planetária" {...f.field('nome')} />
        <Select label="Ambiente" placeholder="Selecione" options={rooms.map((room) => ({ value: room.id, label: room.name }))} {...f.field('amb')} />
        <Select label="Categoria" placeholder="Selecione" options={categoryOptions} {...f.field('categoryId')} />
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
        {(file || importedImage || (!removeImage && persistedImageUrl)) && <Button variant="text-danger" size="sm" disabled={busy}
          onClick={() => { setFile(null); setImportedImage(null); setRemoveImage(Boolean(persistedImageUrl)); }}>Remover imagem</Button>}
        <TextInput id="image-link" label="Link da página do produto" type="url"
          placeholder="Cole o link da loja para buscar fotos" value={imageLink} disabled={busy}
          onChange={(event) => { setImageLink(event.target.value); setVariantId(''); setStorePreview(null); }} error={imageChoiceError} />
        <Button variant="ghost" disabled={busy} onClick={searchProduct}>{searchingProduct ? 'Buscando produto…' : 'Buscar produto'}</Button>
        {storePreview?.resolution === 'variant_required' && <Select id="store-variant" label="Versão do produto" placeholder="Selecione"
          value={variantId} disabled={busy} onChange={(event) => setVariantId(event.target.value)}
          options={storePreview.variants.map((variant) => ({ value: variant.id, label: variant.label }))} />}
        <StoreSyncStatus sync={storePreview?.resolution === 'resolved' ? { ...storePreview, enabled: true, status: 'pending' } : product?.storeSync} />
        {storePreview?.resolution === 'resolved' && <p role="status">Produto encontrado. Ao salvar sem alterar nome, preço ou foto, a atualização automática será ativada.</p>}
        <Button variant="ghost" disabled={busy} onClick={searchImages}>
          {searchingImages ? 'Buscando imagens…' : 'Buscar imagens'}
        </Button>
        {imageChoices.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {imageChoices.map((url, index) => <Button key={url} variant="ghost" disabled={busy}
            aria-label={`Usar imagem ${index + 1}`} aria-pressed={importedImage === url}
            onClick={() => { setImportedImage(url); setFile(null); setRemoveImage(false); }}>
            <span className="thumb"><Image src={url} alt={`Imagem ${index + 1} encontrada`} width={84} height={84} unoptimized /></span>
          </Button>)}
        </div>}
        {partialImageFailure && <p className="errmsg" role="alert" style={{ margin: 0 }}>{PARTIAL_IMAGE_DETAIL}</p>}
      </Field>

      <div className="row2">
        <Field id="qtd" label="Quantidade" error={f.errors.qtd}>
          {isUnit ? (
            <div className="stepper">
              <button type="button" onClick={() => setQty((Number.isFinite(qty) ? qty : MIN_QUANTITY) - 1)} aria-label="Diminuir">−</button>
              <input id="qtd" type="text" inputMode="numeric" value={f.values.qtd}
                aria-invalid={f.errors.qtd ? 'true' : 'false'} aria-describedby={f.errors.qtd ? 'qtd-err' : undefined}
                onChange={(event) => f.setValue('qtd', event.target.value)} onBlur={f.field('qtd').onBlur} />
              <button type="button" onClick={() => setQty((Number.isFinite(qty) ? qty : MIN_QUANTITY) + 1)} aria-label="Aumentar">+</button>
            </div>
          ) : (
            <input id="qtd" className="input num" inputMode="decimal" placeholder="0,00" value={f.values.qtd}
              aria-invalid={f.errors.qtd ? 'true' : 'false'} aria-describedby={f.errors.qtd ? 'qtd-err' : undefined}
              onChange={(event) => f.setValue('qtd', event.target.value)} onBlur={f.field('qtd').onBlur} />
          )}
        </Field>
        <Select label="Unidade" options={UNIT_OPTIONS} {...f.field('unidade')}
          onChange={(event) => { f.setValue('unidade', event.target.value); f.field('qtd').onBlur(); }} />
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
