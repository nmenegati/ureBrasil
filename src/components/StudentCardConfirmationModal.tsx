import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeCanvas } from "qrcode.react";

interface StudentCardConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullName: string;
  cpf: string;
  birthDate: string;
  institution: string | null;
  course: string | null;
  period: string | null;
  enrollmentNumber: string | null;
  cardNumber: string;
  qrData: string;
  photoUrl?: string | null;
  loading: boolean;
  error: string | null;
  attempts: number;
  onConfirm: () => void;
}

export function StudentCardConfirmationModal({
  open,
  onOpenChange,
  fullName,
  cpf,
  birthDate,
  institution,
  course,
  period,
  enrollmentNumber,
  cardNumber,
  qrData,
  photoUrl,
  loading,
  error,
  attempts,
  onConfirm,
}: StudentCardConfirmationModalProps) {
  const canRetry = attempts < 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirme seus dados</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-40 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Foto 3x4"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Foto 3x4</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center border">
                <QRCodeCanvas value={qrData} size={110} />
              </div>
              <div className="text-center text-sm">
                <p className="font-semibold">COD. USO:</p>
                <p className="font-mono">{cardNumber}</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-semibold">Nome: </span>
              {fullName}
            </p>
            <div className="space-y-0.5">
              <p className="font-semibold">Instituição de Ensino:</p>
              <p>{institution || "Não informado"}</p>
              <p>
                {(course ? "Graduação" : "")}
                {period ? (course ? " - " : "") + period : ""}
              </p>
              {course && <p>{course}</p>}
            </div>
            <p>
              <span className="font-semibold">CPF: </span>
              {cpf}
            </p>
            <p>
              <span className="font-semibold">Data Nasc.: </span>
              {birthDate}
            </p>
            <p>
              <span className="font-semibold">Matrícula: </span>
              {enrollmentNumber || "Não informado"}
            </p>
          </div>
          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold mb-1">Importante</p>
            <p>
              Após confirmar, a carteirinha será gerada e não poderá ser alterada. Verifique todos os
              dados antes de continuar.
            </p>
          </div>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
              <p className="font-semibold mb-1">Erro ao gerar carteirinha</p>
              <p className="mb-1">{error}</p>
              <p className="text-xs">
                Tentativa {attempts} de 3.{" "}
                {attempts >= 3
                  ? "Erro persistente. Entre em contato com o suporte."
                  : "Você pode tentar novamente."}
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading || (!canRetry && !!error)}
          >
            {loading ? "Gerando sua carteirinha..." : "Confirmar e Gerar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

