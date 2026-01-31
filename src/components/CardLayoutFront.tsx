import { QRCodeCanvas } from "qrcode.react";

interface CardLayoutFrontProps {
  mode: "direito" | "geral";
  templateSrc: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  institution: string | null;
  educationLabel: string;
  period: string | null;
  course: string | null;
  enrollmentNumber: string | null;
  usageCode: string;
  validUntil: string;
  photoUrl: string | null;
  qrData: string;
}

export function CardLayoutFront(props: CardLayoutFrontProps) {
  const nameUpper = props.fullName.toUpperCase();
  const institutionLine = props.institution || "";
  const courseLine = props.course || "";
  const periodLine = props.period || "";

  return (
    <div className="w-full flex justify-center">
      <div className="relative w-full rounded-lg overflow-hidden shadow-md bg-white">
        <img
          src={props.templateSrc}
          alt="Carteirinha digital - frente"
          className="block w-full h-auto"
        />

        <div className="absolute left-[10.5%] top-[18%] w-[36%] aspect-[3/3.6] rounded-lg overflow-hidden bg-slate-200">
          {props.photoUrl ? (
            <img
              src={props.photoUrl}
              alt="Foto 3x4"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-700">
              Foto 3x4
            </div>
          )}
        </div>

        <div className="absolute right-[11%] top-[20%] w-[24%] flex flex-col items-center gap-2">
          <div className="w-full bg-white rounded-lg flex items-center justify-center p-1">
            <QRCodeCanvas value={props.qrData} size={82} />
          </div>
          <div className="text-[10px] text-center leading-tight text-slate-900">
            <div className="font-semibold tracking-wide">COD. USO:</div>
            <div className="font-mono text-xs font-semibold">{props.usageCode}</div>
          </div>
        </div>

        <div className="absolute left-[10.5%] right-[8%] top-[51%] text-[13px] leading-[1.5] text-slate-900">
          <div className="font-bold text-[13px] mb-1">{nameUpper}</div>
          <div>
            <span className="font-bold">CPF:</span> {props.cpf}
          </div>
          <div>
            <span className="font-bold">Data Nasc.:</span> {props.birthDate}
          </div>
          <div className="mt-2">
            <span className="font-bold">{institutionLine}</span>
          </div>
          <div>
            <span className="font-bold">
              {props.educationLabel}
              {periodLine ? " - " : ""}
            </span>
            {periodLine}
          </div>
          {courseLine && (
            <div>
              <span className="font-bold">{courseLine}</span>
            </div>
          )}
          <div>
            <span className="font-bold">Matrícula:</span> {props.enrollmentNumber || ""}
          </div>
        </div>

        <div className="absolute left-[20%] bottom-[9%] text-[10px] leading-tight text-slate-900">
          <div>VÁLIDO ATÉ:</div>
          <div className="font-bold">{props.validUntil}</div>
        </div>
      </div>
    </div>
  );
}
