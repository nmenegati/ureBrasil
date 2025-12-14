import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileText, ArrowLeft } from 'lucide-react';

export default function UploadDocumentos() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="bg-cyan-500/10 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <FileText className="w-12 h-12 text-cyan-500" />
        </div>
        <h1 className="text-2xl sm:text-3xl text-white font-bold">Upload de Documentos</h1>
        <p className="text-slate-400 mt-3">
          Esta funcionalidade está em desenvolvimento. Em breve você poderá enviar seus documentos por aqui.
        </p>
        <Button 
          onClick={() => navigate('/dashboard')} 
          className="mt-6 bg-cyan-500 hover:bg-cyan-600 text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>
      </div>
    </div>
  );
}
