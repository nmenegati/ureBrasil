import { Bell, ExternalLink } from 'lucide-react';

interface NotificationPreviewProps {
  title: string;
  message: string;
  link?: string;
}

export function NotificationPreview({ title, message, link }: NotificationPreviewProps) {
  const truncatedMessage =
    message.length > 140 ? `${message.slice(0, 140).trimEnd()}…` : message;

  return (
    <div className="w-full max-w-md mx-auto rounded-xl border bg-slate-900 text-slate-50 shadow-lg">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
        <Bell className="w-4 h-4 text-sky-400" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-300">
          Notificação URE
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm font-semibold text-slate-50">{title || 'Título da notificação'}</p>
        <p className="text-xs text-slate-200 leading-relaxed">
          {truncatedMessage || 'Mensagem da notificação aparecerá aqui.'}
        </p>
        {link && (
          <div className="pt-1 flex items-center gap-1 text-xs text-sky-300">
            <ExternalLink className="w-3 h-3" />
            <span>Esta notificação contém um link de ação</span>
          </div>
        )}
      </div>
    </div>
  );
}

