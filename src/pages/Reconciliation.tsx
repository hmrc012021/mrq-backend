import { SimpleTable } from '@/components/SimpleTable';
import { Badge } from '@/components/Badge';
import type { MrqReconciliationItem } from '@/types/database.types';

export function Reconciliation({ rows }: { rows: MrqReconciliationItem[] }) {
  return (
    <>
      <div className="toolbar"><h2>Reconciliation</h2></div>
      <SimpleTable<MrqReconciliationItem>
        rows={rows}
        columns={[
          { key: 'classification', label: 'Classification', render: (v) => <Badge value={v as string} /> },
          { key: 'item', label: 'Item' },
          { key: 'reason', label: 'Reason' },
          { key: 'source', label: 'Source' },
        ]}
      />
    </>
  );
}
