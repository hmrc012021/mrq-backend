import { RecordTable } from '@/components/RecordTable';
import { Badge } from '@/components/Badge';
import type { MrqAction } from '@/types/database.types';

export function Actions({ rows, isAuthed, onRequireAuth, onReload }: { rows: MrqAction[]; isAuthed: boolean; onRequireAuth: () => void; onReload: () => void }) {
  return (
    <RecordTable<MrqAction>
      title="Actions"
      table="pos_action"
      rows={rows}
      isAuthed={isAuthed}
      onRequireAuth={onRequireAuth}
      onReload={onReload}
      columns={[
        { key: 'priority', label: 'Priority', render: (v) => <Badge value={v as string} /> },
        { key: 'status', label: 'Status', render: (v) => <Badge value={v as string} /> },
        { key: 'action', label: 'Action' },
        { key: 'bucket', label: 'Bucket' },
        { key: 'deliverable_id', label: 'Deliverable' },
        { key: 'due_timing', label: 'Timing' },
        { key: 'next_step', label: 'Next step' },
        { key: 'selected_for_week', label: 'Week', render: (v) => (v ? '✓' : '') },
      ]}
      formFields={[
        { key: 'id', label: 'ID' },
        { key: 'deliverable_id', label: 'Deliverable ID' },
        { key: 'bucket', label: 'Bucket' },
        { key: 'workstream', label: 'Workstream' },
        { key: 'action', label: 'Action' },
        { key: 'owner', label: 'Owner' },
        { key: 'status', label: 'Status' },
        { key: 'priority', label: 'Priority' },
        { key: 'due_timing', label: 'Due / Timing' },
        { key: 'next_step', label: 'Next step' },
        { key: 'dependency', label: 'Dependency' },
        { key: 'notes', label: 'Notes' },
      ]}
    />
  );
}
