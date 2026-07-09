export type ActivityRow = {
  id: number;
  createdAt: string;
  client: string;
  agent?: string;
  platform: string;
  actionType: string;
  targetUrl: string | null;
  resultUrl: string | null;
  note: string | null;
};

/** Presentational table for the action/URL log, shared by admin + agent views. */
export function ActivityTable({ rows, showAgent }: { rows: ActivityRow[]; showAgent?: boolean }) {
  if (rows.length === 0) {
    return <div className="empty" style={{ marginTop: 16 }}>No actions logged yet.</div>;
  }
  return (
    <div className="card" style={{ padding: 0, overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Client</th>
            {showAgent && <th>Agent</th>}
            <th>Platform</th>
            <th>Action</th>
            <th>Target URL</th>
            <th>Result URL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="subtle" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleString()}</td>
              <td>{r.client}</td>
              {showAgent && <td>{r.agent ?? "—"}</td>}
              <td>{r.platform}</td>
              <td><span className="badge">{r.actionType}</span></td>
              <td className="mono" style={{ fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.targetUrl ? <a href={r.targetUrl} target="_blank" rel="noreferrer">{r.targetUrl}</a> : "—"}
              </td>
              <td className="mono" style={{ fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.resultUrl ? <a href={r.resultUrl} target="_blank" rel="noreferrer">{r.resultUrl}</a> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
