import { SimpleTable } from '@/components/SimpleTable';
import type { MrqSourceMap, MrqOperatingRule } from '@/types/database.types';

export function Sources({ sources, rules }: { sources: MrqSourceMap[]; rules: MrqOperatingRule[] }) {
  return (
    <>
      <h2>Source Map</h2>
      <SimpleTable<MrqSourceMap>
        rows={sources}
        columns={[
          { key: 'source_file', label: 'Source file' },
          { key: 'source_tab', label: 'Source tab' },
          { key: 'imported', label: 'Imported' },
          { key: 'treatment', label: 'Treatment' },
        ]}
      />
      <h2>Operating Rules</h2>
      <SimpleTable<MrqOperatingRule>
        rows={rules}
        columns={[
          { key: 'topic', label: 'Topic' },
          { key: 'instruction', label: 'Instruction' },
        ]}
      />
    </>
  );
}
