import { RecordTable } from '@/components/RecordTable';
import type { MrqDecision } from '@/types/database.types';

export function Decisions({ rows, isAuthed, onRequireAuth, onReload }: { rows: MrqDecision[]; isAuthed: boolean; onRequireAuth: () => void; onReload: () => void }) {
  return (
    <RecordTable<MrqDecision>
      title="Decisions"
      table="mrq_decision"
      rows={rows}
      isAuthed={isAuthed}
      onRequireAuth={onRequireAuth}
      onReload={onReload}
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'decision', label: 'Decision' },
        { key: 'bucket', label: 'Bucket' },
        { key: 'decision_date_approx', label: 'Date' },
        { key: 'still_valid', label: 'Valid?' },
      ]}
      formFields={[
        { key: 'id', label: 'ID' },
        { key: 'bucket', label: 'Bucket' },
        { key: 'workstream', label: 'Workstream' },
        { key: 'decision', label: 'Decision' },
        { key: 'decision_date_approx', label: 'Date / Approx' },
        { key: 'still_valid', label: 'Still valid' },
        { key: 'consequence', label: 'Consequence' },
      ]}
    />
  );
}
