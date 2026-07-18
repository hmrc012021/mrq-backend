export interface SimpleColumn<T> { key: keyof T & string; label: string; render?: (v: unknown, row: T) => React.ReactNode; }

export function SimpleTable<T extends { id: string }>({ rows, columns }: { rows: T[]; columns: SimpleColumn<T>[] }) {
  if (!rows.length) return <div className="card small">No records.</div>;
  return (
    <div className="wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(r[c.key], r) : String(r[c.key] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
