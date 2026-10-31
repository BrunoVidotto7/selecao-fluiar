'use client';
import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import Button from '../ui/Button';
import { TextInput } from '../ui/Fields';
import { useConfirm, useToast } from '../feedback/Feedback';
import useApiForm from '../forms/useApiForm';
import { createRoom, renameRoom, deleteRoom, reorderRooms } from './actions';

const ROOM_NAME_MAX_LENGTH = 60;
const ROOM_ORDER_INCOMPLETE = 'Envie todos os ambientes da lista, sem repetir.';
const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;
const PENDING_DETAIL = 'Aguarde a operação em andamento.';
const WRITE_FAILED_DETAIL = 'Não conseguimos salvar agora. Tente novamente.';
const moveButtonId = (roomId, direction) => `mover-${roomId}-${direction}`;

function RoomNameForm({ listId, room, write, onSaved, onCancel }) {
  const nameField = `nome-ambiente-${room?.id ?? listId}`;
  const f = useApiForm({
    initial: { [nameField]: room?.name ?? '' },
    rules: { [nameField]: { required: true, maxLength: ROOM_NAME_MAX_LENGTH } },
    fieldMap: { name: nameField },
    action: (values) => write(() => room
      ? renameRoom(room.id, { name: values[nameField] })
      : createRoom(listId, { name: values[nameField] })),
    onSuccess: (saved, values, { toast }) => {
      toast(room ? 'Ambiente renomeado.' : 'Ambiente criado.');
      if (!room) f.setValue(nameField, '');
      onSaved();
    },
  });

  return (
    <form className="form" onSubmit={f.submit} noValidate>
      <TextInput label={room ? `Nome do ambiente de ${room.name}` : 'Nome do ambiente'}
        hint={`Use no máximo ${ROOM_NAME_MAX_LENGTH} caracteres.`} {...f.field(nameField)} />
      <div className="formfoot">
        {room && <Button variant="ghost" onClick={onCancel}>Cancelar renomeação</Button>}
        <Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : room ? 'Salvar nome' : 'Adicionar ambiente'}</Button>
      </div>
    </form>
  );
}

function RoomRow({ room, first, last, write, refresh, onMove, onDelete }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="card card-pad room-row">
      <div className="room-heading">
        <h2>{room.name}</h2>
        <span className="meta">{room.products.length} {room.products.length === 1 ? 'produto' : 'produtos'}</span>
      </div>
      {editing ? (
        <RoomNameForm room={room} write={write} onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); refresh(); }} />
      ) : (
        <div className="room-actions">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Renomear</Button>
          <Button variant="ghost" size="sm" id={moveButtonId(room.id, -1)} disabled={first} aria-label={`Mover ${room.name} para cima`} onClick={() => onMove(-1)}>Mover para cima</Button>
          <Button variant="ghost" size="sm" id={moveButtonId(room.id, 1)} disabled={last} aria-label={`Mover ${room.name} para baixo`} onClick={() => onMove(1)}>Mover para baixo</Button>
          <Button variant="text-danger" size="sm" onClick={onDelete}>Excluir ambiente</Button>
        </div>
      )}
    </li>
  );
}

/** @param {{ listId: string, rooms: import('../listas/queries.server').RoomResponse[] }} props */
export default function RoomManager({ listId, rooms }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const pending = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Depois que a nova ordem chega, devolve o foco ao ambiente movido.
  useEffect(() => {
    if (!moved || rooms === moved.rooms) return;
    setMoved(null);
    const button = document.getElementById(moveButtonId(moved.id, moved.direction));
    if (button && !button.disabled) button.focus();
    else document.getElementById(moveButtonId(moved.id, -moved.direction))?.focus();
  }, [moved, rooms]);

  const refresh = () => { if (mounted.current) router.refresh(); };
  const write = async (command) => {
    if (pending.current) return { ok: false, status: HTTP_CONFLICT, detail: PENDING_DETAIL, errors: {} };
    pending.current = true;
    setBusy(true);
    try {
      return await command();
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const move = async (index, direction) => {
    const target = index + direction;
    if (pending.current || target < 0 || target >= rooms.length) return;
    const roomIds = rooms.map((room) => room.id);
    [roomIds[index], roomIds[target]] = [roomIds[target], roomIds[index]];
    try {
      const result = await write(() => reorderRooms(listId, roomIds));
      if (!mounted.current) return;
      if (!result.ok) {
        toast(result.detail, 'err');
        if (result.status === HTTP_BAD_REQUEST && result.detail === ROOM_ORDER_INCOMPLETE) refresh();
        return;
      }
      toast('Ordem dos ambientes salva.');
      setMoved({ id: rooms[index].id, direction, rooms });
      refresh();
    } catch (error) {
      unstable_rethrow(error);
      if (mounted.current) toast(WRITE_FAILED_DETAIL, 'err');
    }
  };

  const remove = (room) => {
    if (pending.current) return;
    confirm({
      title: `Excluir “${room.name}”?`,
      text: `Os ${room.products.length} produtos deste ambiente também serão excluídos. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir ambiente',
      onConfirm: async () => {
        if (pending.current || !mounted.current) return;
        try {
          const result = await write(() => deleteRoom(room.id));
          if (!mounted.current) return;
          if (!result.ok) {
            toast(result.detail, 'err');
            return;
          }
          toast('Ambiente excluído.');
          refresh();
        } catch (error) {
          unstable_rethrow(error);
          if (mounted.current) toast(WRITE_FAILED_DETAIL, 'err');
        }
      },
    });
  };

  return (
    <fieldset className="room-manager" disabled={busy} aria-busy={busy}>
      <legend className="sr">Ambientes da lista</legend>
      {rooms.length ? (
        <ol className="room-list" aria-label="Ambientes">
          {rooms.map((room, index) => (
            <RoomRow key={room.id} room={room} first={index === 0} last={index === rooms.length - 1}
              write={write} refresh={refresh} onMove={(direction) => move(index, direction)} onDelete={() => remove(room)} />
          ))}
        </ol>
      ) : <p className="meta">Esta lista ainda não tem ambientes. Adicione o primeiro para organizar seus produtos.</p>}
      <div className="card card-pad">
        <RoomNameForm listId={listId} write={write} onSaved={refresh} />
      </div>
    </fieldset>
  );
}
