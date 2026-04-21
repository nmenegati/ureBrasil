import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
 
type VerificationState = "idle" | "loading" | "success" | "error";
 
type CardStatus = "valid" | "expired" | "invalid";
 
interface VerifiedStudent {
  full_name: string;
  institution: string | null;
  course: string | null;
  photo_url: string | null;
  cpf_last5: string | null;
  card_number: string | null;
  valid_until: string | null;
  is_physical: boolean;
  status: CardStatus;
}
 
const formatDateBR = (isoDate: string | null) => {
  if (!isoDate) return "Sem informação";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
};
 
const formatMaskedCpf = (last5: string | null) => {
  if (!last5 || last5.length < 1) return "***.***.***-**";
  const digits = last5.slice(-5).padStart(5, "*");
  return `***.***.${digits.slice(0, 3)}-${digits.slice(3)}`;
};
 
export default function VerificarCarteirinha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
 
  const queryCode = searchParams.get("code") || "";
  const paramCode = params.usageCode || "";
  const initialCode = (queryCode || paramCode || "").toUpperCase();
 
  const [usageCode, setUsageCode] = useState(initialCode);
  const [birthDate, setBirthDate] = useState("");
  const [state, setState] = useState<VerificationState>("idle");
  const [student, setStudent] = useState<VerifiedStudent | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [codeFromQuery, setCodeFromQuery] = useState(
    Boolean(queryCode || paramCode),
  );

  const birthDateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const metaSelector = 'meta[name="robots"]';
    const existing = document.querySelector(metaSelector) as
      | HTMLMetaElement
      | null;
    const previousContent = existing?.getAttribute("content") ?? null;
 
    let meta = existing;
    let created = false;
 
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      created = true;
      document.head.appendChild(meta);
    }
 
    meta.content = "noindex,nofollow";
 
    return () => {
      if (!meta) return;
      if (created) {
        document.head.removeChild(meta);
        return;
      }
      if (previousContent === null) {
        document.head.removeChild(meta);
      } else {
        meta.content = previousContent;
      }
    };
  }, []);
 
  useEffect(() => {
    if (codeFromQuery && birthDateInputRef.current) {
      birthDateInputRef.current.focus();
    }
  }, [codeFromQuery]);
 
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!usageCode || !birthDate) return;
 
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY;
 
    if (!supabaseUrl || !anonKey) {
      setApiError("Configuração de verificação indisponível.");
      setState("error");
      return;
    }
 
    setState("loading");
    setApiError(null);
    setStudent(null);
 
    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/verify-student-card`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            usage_code: usageCode,
            birth_date: birthDate,
          }),
        },
      );
 
      const data = await response.json().catch(() => null);
 
      if (!response.ok || !data || data.success !== true) {
        const message =
          data?.error ||
          "Carteirinha não encontrada ou dados incorretos.";
        setApiError(message);
        setState("error");
        return;
      }
 
      setStudent(data.student as VerifiedStudent);
      setState("success");
    } catch (error) {
      console.error("[VERIFICAR_CARTEIRINHA] Erro ao chamar API:", error);
      setApiError("Erro ao verificar carteirinha. Tente novamente.");
      setState("error");
    }
  };
 
  const handleNewSearch = () => {
    setUsageCode("");
    setBirthDate("");
    setStudent(null);
    setApiError(null);
    setState("idle");
    setCodeFromQuery(false);
    navigate("/verificar", { replace: true });
  };
 
  const formattedName = useMemo(() => {
    if (!student?.full_name) return "";
    return student.full_name;
  }, [student?.full_name]);
 
  const cardStatus = student?.status ?? "invalid";
 
  const statusBadge = (() => {
    if (cardStatus === "valid") {
      return {
        label: "Carteirinha Válida",
        color: "bg-green-100 text-green-800 border-green-300",
        icon: <CheckCircle className="w-4 h-4 mr-1" />,
      };
    }
    if (cardStatus === "expired") {
      return {
        label: "Carteirinha Expirada",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: <AlertTriangle className="w-4 h-4 mr-1" />,
      };
    }
    return {
      label: "Carteirinha Inválida",
      color: "bg-red-100 text-red-800 border-red-300",
      icon: <XCircle className="w-4 h-4 mr-1" />,
    };
  })();
 
  const borderColor =
    cardStatus === "valid"
      ? "border-green-500"
      : cardStatus === "expired"
      ? "border-yellow-500"
      : "border-red-500";
 
  const showResult = state === "success" && student;
 
  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
 
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center">
            <Card className="w-full max-w-md shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">
                  Buscar carteirinha
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">
                      Código de uso
                    </label>
                    <Input
                      type="text"
                      value={usageCode}
                      onChange={(e) =>
                        setUsageCode(e.target.value.toUpperCase())
                      }
                      placeholder="Ex: URE-A1B2C3"
                      className="uppercase"
                      disabled={codeFromQuery || state === "loading"}
                    />
                  </div>
 
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">
                      Data de nascimento do estudante
                    </label>
                    <Input
                      ref={birthDateInputRef}
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      disabled={state === "loading"}
                    />
                    <p className="text-[11px] text-slate-500">
                      Informe no formato DD/MM/AAAA.
                    </p>
                  </div>
 
                  {apiError && (
                    <Alert variant="destructive">
                      <AlertDescription>{apiError}</AlertDescription>
                    </Alert>
                  )}
 
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      !usageCode || !birthDate || state === "loading"
                    }
                  >
                    {state === "loading" ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      "Verificar Carteirinha"
                    )}
                  </Button>
 
                  {state !== "idle" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={handleNewSearch}
                      disabled={state === "loading"}
                    >
                      Nova consulta
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
 
            {showResult && student && (
              <div className="w-full max-w-md mt-6 animate-in fade-in-10">
                <Card className={`border-2 ${borderColor}`}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={`border ${statusBadge.color}`}
                      >
                        {statusBadge.icon}
                        {statusBadge.label}
                      </Badge>
                    </div>
 
                    <div className="flex items-center gap-4">
                      {student.photo_url ? (
                        <img
                          src={student.photo_url}
                          alt={student.full_name}
                          className="w-20 h-20 rounded-lg object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-[11px] text-slate-400">
                          Sem foto
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-slate-900">
                          {formattedName}
                        </p>
                        <p className="text-xs text-slate-600">
                          {student.institution || "Instituição não informada"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {student.course || "Curso não informado"}
                        </p>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
                      <div className="space-y-1">
                        <p className="text-slate-500">Número da carteirinha</p>
                        <p className="font-medium">
                          {student.card_number || "Não informado"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-500">CPF</p>
                        <p className="font-medium">
                          {formatMaskedCpf(student.cpf_last5)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-500">Válida até</p>
                        <p
                          className={`font-medium ${
                            cardStatus === "expired"
                              ? "text-red-600"
                              : "text-slate-800"
                          }`}
                        >
                          {formatDateBR(student.valid_until)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-500">Tipo</p>
                        <p className="font-medium">
                          {student.is_physical
                            ? "Digital + Física"
                            : "Digital"}
                        </p>
                      </div>
                    </div>
 
                    {cardStatus === "invalid" && (
                      <Alert variant="destructive">
                        <AlertDescription className="text-xs">
                          Esta carteirinha não está ativa. Oriente o estudante a
                          entrar em contato com o suporte da URE Brasil.
                        </AlertDescription>
                      </Alert>
                    )}
 
                    {cardStatus === "expired" && (
                      <Alert variant="destructive">
                        <AlertDescription className="text-xs">
                          Esta carteirinha está expirada. Para uso em meia-entrada,
                          é necessário emitir uma nova carteirinha válida.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
 
            {state === "idle" && !student && (
              <div className="mt-6 max-w-md text-xs text-slate-500 text-center">
                Aponte a câmera do celular para o QR Code da carteirinha URE
                Brasil. O link deve abrir nesta página com o código preenchido.
                Em seguida, informe a data de nascimento do estudante para
                confirmar a autenticidade.
              </div>
            )}
          </div>
 
        </div>
      </main>
    </div>
  );
}
