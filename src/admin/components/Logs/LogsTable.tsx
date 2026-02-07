import { Badge } from '@/components/ui/badge';

export interface NormalizedLogItem {
  id: string;
  timestamp: string;
  adminName: string | null;
  adminId: string | null;
  actionType: string | null;
  target: string | null;
  justification: string | null;
  ip: string | null;
  metadata: unknown;
}

interface LogsTableProps {
  items: NormalizedLogItem[];
}

export function LogsTable({ items }: LogsTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nenhum registro encontrado para os filtros atuais.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border bg-white">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-slate-600 w-40">
              Data
            </th>
            <th className="px-3 py-2 text-left font-semibold text-slate-600 w-40">
              Admin
            </th>
            <th className="px-3 py-2 text-left font-semibold text-slate-600 w-40">
              Ação
            </th>
            <th className="px-3 py-2 text-left font-semibold text-slate-600">
              Alvo
            </th>
            <th className="px-3 py-2 text-left font-semibold text-slate-600">
              Justificativa
            </th>
            <th className="px-3 py-2 text-left font-semibold text-slate-600 w-32">
              IP
            </th>
            <th className="px-3 py-2 text-left font-semibold text-slate-600 w-56">
              Metadados
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-t hover:bg-slate-50">
              <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                {new Date(item.timestamp).toLocaleString('pt-BR')}
              </td>
              <td className="px-3 py-2 align-top text-[11px]">
                <div className="flex flex-col">
                  {item.adminName && (
                    <span className="font-semibold text-slate-900">
                      {item.adminName}
                    </span>
                  )}
                  {item.adminId && (
                    <span className="text-slate-500">
                      {item.adminId}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 align-top text-[11px]">
                {item.actionType ? (
                  <Badge className="text-[10px] bg-slate-900 text-white">
                    {item.actionType}
                  </Badge>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="px-3 py-2 align-top text-[11px] text-slate-800">
                {item.target || '-'}
              </td>
              <td className="px-3 py-2 align-top text-[11px] text-slate-800 whitespace-pre-wrap">
                {item.justification || '-'}
              </td>
              <td className="px-3 py-2 align-top text-[11px] text-slate-600">
                {item.ip || '-'}
              </td>
              <td className="px-3 py-2 align-top text-[10px] text-slate-700">
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words">
                  {item.metadata ? JSON.stringify(item.metadata, null, 2) : '-'}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

