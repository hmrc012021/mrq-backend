import { RecordTable } from '@/components/RecordTable';
import { Badge } from '@/components/Badge';
import type { MrqMilestone } from '@/types/database.types';

export function Milestones({ rows, isAuthed, onRequireAuth, onReload }: { rows: MrqMilestone[]; isAuthed: boolean; onRequireAuth: () => void; onReload: () => void }) {
  return (
    <RecordTable<MrqMilestone>
      title="Milestones"
      table="mrq_milestone"
      rows={rows}
      isAuthed={isAuthed}
      onRequireAuth={onRequireAuth}
      onReload={onReload}
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'status', label: 'Status', render: (v) => <Badge value={v as string} /> },
        { key: 'milestone', label: 'Milestone' },
        { key: 'bucket', label: 'Bucket' },
        { key: 'target_period', label: 'Target' },
      ]}
      formFields={[
        { key: 'id', label: 'ID' },
        { key: 'bucket', label: 'Bucket' },
        { key: 'workstream', label: 'Workstream' },
        { key: 'milestone', label: 'Milestone' },
        { key: 'target_period', label: 'Target' },
        { key: 'owner', label: 'Owner' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
