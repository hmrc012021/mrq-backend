import { RecordTable } from '@/components/RecordTable';
import { Badge } from '@/components/Badge';
import type { MrqTrainingBlock } from '@/types/database.types';

export function Training({ rows, isAuthed, onRequireAuth, onReload }: { rows: MrqTrainingBlock[]; isAuthed: boolean; onRequireAuth: () => void; onReload: () => void }) {
  return (
    <RecordTable<MrqTrainingBlock>
      title="Training Protection"
      table="mrq_training_block"
      rows={rows}
      isAuthed={isAuthed}
      onRequireAuth={onRequireAuth}
      onReload={onReload}
      columns={[
        { key: 'block_date', label: 'Date' },
        { key: 'planned_start', label: 'Start' },
        { key: 'planned_minutes', label: 'Minutes' },
        { key: 'status', label: 'Status', render: (v) => <Badge value={v as string} /> },
        { key: 'notes', label: 'Notes' },
      ]}
      formFields={[
        { key: 'id', label: 'ID' },
        { key: 'block_date', label: 'Date' },
        { key: 'planned_start', label: 'Start' },
        { key: 'planned_minutes', label: 'Minutes' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes' },
      ]}
    />
  );
}
