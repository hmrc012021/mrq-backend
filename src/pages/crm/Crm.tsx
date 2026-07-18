import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ContactsTab } from './ContactsTab';
import { Timeline } from './Timeline';
import { ContactDetail } from './ContactDetail';
import { InteractionPopup } from './InteractionPopup';
import { CrmEditModal } from './CrmEditModal';
import { CsvImport } from './CsvImport';
import { nextId, type EditingItem } from './crmTypes';
import type { CrmContact, CrmInteraction, CrmNote, Venue } from '@/types/database.types';

export function Crm({
  contacts, interactions, notes, venues, isAuthed, onRequireAuth, onReload,
}: {
  contacts: CrmContact[];
  interactions: CrmInteraction[];
  notes: CrmNote[];
  venues: Venue[];
  isAuthed: boolean;
  onRequireAuth: () => void;
  onReload: () => void;
}) {
  const [tab, setTab] = useState<'contacts' | 'timeline'>('contacts');
  const [csvMode, setCsvMode] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [viewingInteractionId, setViewingInteractionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const selectedContact = contacts.find((c) => c.contact_id === selectedContactId);
  const viewingInteraction = interactions.find((i) => i.interaction_id === viewingInteractionId);

  function requireAuth(): boolean {
    if (!isAuthed) { onRequireAuth(); return false; }
    return true;
  }

  function flash(msg: string) {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 2500);
  }

  async function saveItem(values: Record<string, unknown>) {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.type === 'contact') {
        const idKey = 'contact_id';
        const id = editing.isNew ? (editing.item as Partial<CrmContact>).contact_id! : (editing.item as CrmContact).contact_id;
        if (editing.isNew) await supabase.from('crm_contact').insert([{ ...values, [idKey]: id }]).throwOnError();
        else await supabase.from('crm_contact').update(values).eq(idKey, id).throwOnError();
        flash(`✓ Saved contact ${id}`);
      } else if (editing.type === 'interaction') {
        const idKey = 'interaction_id';
        const id = editing.isNew ? (editing.item as Partial<CrmInteraction>).interaction_id! : (editing.item as CrmInteraction).interaction_id;
        const contactId = (editing.item as Partial<CrmInteraction>).contact_id;
        if (editing.isNew) await supabase.from('crm_interaction').insert([{ ...values, [idKey]: id, contact_id: contactId }]).throwOnError();
        else await supabase.from('crm_interaction').update(values).eq(idKey, id).throwOnError();
        flash(`✓ Saved interaction ${id}`);
      } else {
        const idKey = 'note_id';
        const id = editing.isNew ? (editing.item as Partial<CrmNote>).note_id! : (editing.item as CrmNote).note_id;
        const interactionId = (editing.item as Partial<CrmNote>).interaction_id;
        if (editing.isNew) await supabase.from('crm_note').insert([{ ...values, [idKey]: id, interaction_id: interactionId }]).throwOnError();
        else await supabase.from('crm_note').update(values).eq(idKey, id).throwOnError();
        flash(`✓ Saved note ${id}`);
      }
      setEditing(null);
      onReload();
    } catch (e) {
      alert('Save failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete permanently?')) return;
    try {
      const ids = interactions.filter((i) => i.contact_id === id).map((i) => i.interaction_id);
      for (const iid of ids) await supabase.from('crm_note').delete().eq('interaction_id', iid).throwOnError();
      await supabase.from('crm_interaction').delete().eq('contact_id', id).throwOnError();
      await supabase.from('crm_contact').delete().eq('contact_id', id).throwOnError();
      if (selectedContactId === id) setSelectedContactId(null);
      onReload();
    } catch (e) {
      alert('Delete failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function deleteInteraction(id: string) {
    if (!confirm('Delete permanently?')) return;
    try {
      await supabase.from('crm_note').delete().eq('interaction_id', id).throwOnError();
      await supabase.from('crm_interaction').delete().eq('interaction_id', id).throwOnError();
      setViewingInteractionId(null);
      onReload();
    } catch (e) {
      alert('Delete failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete permanently?')) return;
    try {
      await supabase.from('crm_note').delete().eq('note_id', id).throwOnError();
      onReload();
    } catch (e) {
      alert('Delete failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  function openNewContact() {
    if (!requireAuth()) return;
    setEditing({
      type: 'contact',
      isNew: true,
      item: { contact_id: nextId('CON-NEW', contacts, 'contact_id'), priority_level: 'P2', outreach_status: 'not_started', relationship_status: 'unknown', contact_confidence: 'unverified', date_added: new Date().toISOString().split('T')[0], venue_id: 'LOC-999' },
    });
  }
  function openNewInteraction(contactId: string) {
    if (!requireAuth()) return;
    setEditing({ type: 'interaction', isNew: true, item: { interaction_id: nextId('INT-NEW', interactions, 'interaction_id'), contact_id: contactId, date: new Date().toISOString().split('T')[0], owner: 'German' } });
  }
  function openNewNote(interactionId: string) {
    if (!requireAuth()) return;
    setEditing({ type: 'note', isNew: true, item: { note_id: nextId('N-NEW', notes, 'note_id'), interaction_id: interactionId } });
  }

  return (
    <div className="crm-shell">
      <div className="crm-toolbar">
        <div className="crm-tabs">
          <button className={`crm-tab-btn${tab === 'contacts' ? ' active' : ''}`} onClick={() => setTab('contacts')}>Contacts</button>
          <button className={`crm-tab-btn${tab === 'timeline' ? ' active' : ''}`} onClick={() => setTab('timeline')}>Timeline</button>
        </div>
        <span className="count">{contacts.length}C · {interactions.length}I · {notes.length}N</span>
        <button className="btn gold" onClick={openNewContact}>+ Contact</button>
        <button className="btn ghost" onClick={() => setCsvMode(true)}>Export / Import CSV</button>
        <button className="btn ghost" onClick={onReload}>Refresh</button>
        {savedMsg && <span className="small" style={{ color: 'var(--gr)', fontWeight: 700 }}>{savedMsg}</span>}
      </div>

      {csvMode ? (
        <CsvImport contacts={contacts} filteredContacts={contacts} onClose={() => setCsvMode(false)} onImported={onReload} />
      ) : tab === 'contacts' ? (
        <ContactsTab contacts={contacts} venues={venues} onSelectContact={setSelectedContactId} />
      ) : (
        <Timeline interactions={interactions} contacts={contacts} notes={notes} />
      )}

      {selectedContact && !editing && !viewingInteraction && (
        <ContactDetail
          contact={selectedContact}
          interactions={interactions}
          notes={notes}
          venues={venues}
          onClose={() => setSelectedContactId(null)}
          onEdit={() => { if (requireAuth()) setEditing({ type: 'contact', isNew: false, item: selectedContact }); }}
          onDelete={() => { if (requireAuth()) deleteContact(selectedContact.contact_id); }}
          onNewInteraction={() => openNewInteraction(selectedContact.contact_id)}
          onOpenInteraction={setViewingInteractionId}
        />
      )}

      {viewingInteraction && !editing && (
        <InteractionPopup
          interaction={viewingInteraction}
          contact={contacts.find((c) => c.contact_id === viewingInteraction.contact_id)}
          notes={notes.filter((n) => n.interaction_id === viewingInteraction.interaction_id)}
          onClose={() => setViewingInteractionId(null)}
          onEditInteraction={() => { if (requireAuth()) setEditing({ type: 'interaction', isNew: false, item: viewingInteraction }); }}
          onDeleteInteraction={() => { if (requireAuth()) deleteInteraction(viewingInteraction.interaction_id); }}
          onNewNote={() => openNewNote(viewingInteraction.interaction_id)}
          onEditNote={(n) => { if (requireAuth()) setEditing({ type: 'note', isNew: false, item: n }); }}
          onDeleteNote={(id) => { if (requireAuth()) deleteNote(id); }}
        />
      )}

      {editing && (
        <CrmEditModal editing={editing} venues={venues} saving={saving} onCancel={() => setEditing(null)} onSave={saveItem} />
      )}
    </div>
  );
}
