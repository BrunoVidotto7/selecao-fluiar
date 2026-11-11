'use client';
import Button from '../ui/Button';
import { useConfirm } from '../feedback/Feedback';

/** @param {{ notes: { clientId: string, clientName: string, text: string }[], productName: string, pending?: boolean, onDelete?: (clientId: string) => void }} props */
export default function ProfileNotes({ notes, productName, pending = false, onDelete }) {
  const confirm = useConfirm();
  if (!notes?.length) return null;
  return <div className="profile-notes">
    <span className="meta">Observações dos perfis</span>
    {notes.map((note) => <p className="meta" key={note.clientId}>{`${note.clientName}: ${note.text}`}
      {onDelete && <> <Button variant="ghost" size="sm" disabled={pending} aria-label={`Excluir observação de ${note.clientName}`}
        onClick={() => confirm({
          title: `Excluir a observação de ${note.clientName}?`,
          text: `A observação sobre “${productName}” será apagada. Essa ação não pode ser desfeita.`,
          confirmLabel: 'Excluir',
          onConfirm: () => onDelete(note.clientId),
        })}>Excluir</Button></>}
    </p>)}
  </div>;
}
