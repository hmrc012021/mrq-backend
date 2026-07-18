import { SimpleTable } from '@/components/SimpleTable';
import { Badge } from '@/components/Badge';
import type { MrqRawExtract } from '@/types/database.types';

export function Intake({ rows }: { rows: MrqRawExtract[] }) {
  return (
    <>
      <div className="toolbar"><h2>Raw Intake</h2></div>
      <SimpleTable<MrqRawExtract>
        rows={rows}
        columns={[
          { key: 'source_track', label: 'Track' },
          { key: 'extract_type', label: 'Type' },
          { key: 'status', label: 'Status', render: (v) => <Badge value={v as string} /> },
          {
            key: 'raw_extract',
            label: 'Raw extract',
            render: (v) => (
              <div style={{ maxWidth: 800, whiteSpace: 'pre-wrap' }}>{String(v ?? '').slice(0, 1000)}</div>
            ),
          },
        ]}
      />
    </>
  );
}
