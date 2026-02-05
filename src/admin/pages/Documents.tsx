import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';
import AdminLayout from '@/admin/components/Layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DocumentCard } from '@/admin/components/DocumentReview/DocumentCard';

type PendingDocRow = Tables<'pending_documents_queue'>;
type DocumentTypeEnum = Enums<'document_type'>;

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<PendingDocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('pending_documents_queue')
        .select('*')
        .order('submitted_at', { ascending: true });

      if (data) {
        setDocuments(data as PendingDocRow[]);
      }
      setLoading(false);
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return documents.filter(doc => {
      if (docTypeFilter !== 'all' && doc.document_type !== docTypeFilter) {
        return false;
      }
      if (dateFilter !== 'all' && doc.submitted_at) {
        const submitted = new Date(doc.submitted_at);
        if (dateFilter === 'last24h') {
          const diff = now.getTime() - submitted.getTime();
          if (diff > 24 * 60 * 60 * 1000) return false;
        }
        if (dateFilter === 'last7d') {
          const diff = now.getTime() - submitted.getTime();
          if (diff > 7 * 24 * 60 * 60 * 1000) return false;
        }
      }
      return true;
    });
  }, [documents, docTypeFilter, dateFilter]);

  const reload = async () => {
    const { data } = await supabase
      .from('pending_documents_queue')
      .select('*')
      .order('submitted_at', { ascending: true });

    if (data) {
      setDocuments(data as PendingDocRow[]);
    }
  };

  const docTypes: (DocumentTypeEnum | 'all')[] = ['all', 'rg', 'endereco', 'matricula', 'foto', 'selfie'];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Documentos</h1>
            <p className="text-sm text-slate-500">
              Fila de documentos para validação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                {docTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type === 'all'
                      ? 'Todos os tipos'
                      : type === 'rg'
                      ? 'Documento de Identidade'
                      : type === 'endereco'
                      ? 'Comprovante de Endereço'
                      : type === 'matricula'
                      ? 'Comprovante de Matrícula'
                      : type === 'foto'
                      ? 'Foto'
                      : 'Selfie'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as datas</SelectItem>
                <SelectItem value="last24h">Últimas 24h</SelectItem>
                <SelectItem value="last7d">Últimos 7 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={reload}
              className="h-8 text-xs"
            >
              Recarregar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fila de documentos pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Carregando documentos...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum documento encontrado com os filtros atuais.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(doc => (
                  <DocumentCard
                    key={doc.document_id}
                    item={doc}
                    onUpdated={reload}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

