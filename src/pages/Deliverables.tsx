import { RecordTable } from '@/components/RecordTable';
import { Badge } from '@/components/Badge';
import type { MrqDeliverable } from '@/types/database.types';

export function Deliverables({ rows, isAuthed, onRequireAuth, onReload }: { rows: MrqDeliverable[]; isAuthed: boolean; onRequireAuth: () => void; onReload: () => void }) {
  return (
    <RecordTable<MrqDeliverable>
      title="Deliverables"
      table="pos_deliverable"
      rows={rows}
      isAuthed={isAuthed}
      onRequireAuth={onRequireAuth}
      onReload={onReload}
      columns={[
        { key: 'domain', label: 'Domain' },
        { key: 'id', label: 'ID' },
        { key: 'status', label: 'Status', render: (v) => <Badge value={v as string} /> },
        { key: 'deliverable', label: 'Deliverable' },
        { key: 'bucket', label: 'Bucket' },
        { key: 'target_period', label: 'Target' },
        { key: 'owner', label: 'Owner' },
      ]}
      formFields={[
        { key: 'domain', label: 'Domain' },
        { key: 'id', label: 'ID' },
        { key: 'bucket', label: 'Bucket' },
        { key: 'workstream', label: 'Workstream' },
        { key: 'deliverable', label: 'Deliverable' },
        { key: 'deliverable_type', label: 'Type' },
        { key: 'target_period', label: 'Target' },
        { key: 'owner', label: 'Owner' },
        { key: 'status', label: 'Status' },
        { key: 'success_measure', label: 'Success measure' },
      ]}
    />
  );
}
