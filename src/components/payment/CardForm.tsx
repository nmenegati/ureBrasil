import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock } from "lucide-react";
import {
  maskCardNumber,
  maskExpiry,
  maskCvv,
  formatPrice,
} from "@/utils/payment-helpers";

interface CardFormProps {
  cardNumber: string;
  setCardNumber: (v: string) => void;
  cardName: string;
  setCardName: (v: string) => void;
  cardExpiry: string;
  setCardExpiry: (v: string) => void;
  cardCvv: string;
  setCardCvv: (v: string) => void;
  installments: string;
  setInstallments: (v: string) => void;
  maxInstallments: number;
  planPrice: number;
  cardType: "credit" | "debit";
  activeGateway: string;
}

export function CardForm({
  cardNumber,
  setCardNumber,
  cardName,
  setCardName,
  cardExpiry,
  setCardExpiry,
  cardCvv,
  setCardCvv,
  installments,
  setInstallments,
  maxInstallments,
  planPrice,
  cardType,
  activeGateway,
}: CardFormProps) {
  const installmentOptions = Array.from(
    { length: Math.max(1, maxInstallments) },
    (_, i) => {
      const num = i + 1;
      const value = planPrice / num;
      return {
        value: String(num),
        label:
          num === 1
            ? `${formatPrice(planPrice)} à vista`
            : `${num}x de ${formatPrice(value)}`,
      };
    }
  );

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="cardNumber">Número do cartão</Label>
        <Input
          id="cardNumber"
          placeholder="0000 0000 0000 0000"
          value={cardNumber}
          onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
          maxLength={19}
        />
      </div>

      <div>
        <Label htmlFor="cardName">Nome no cartão</Label>
        <Input
          id="cardName"
          placeholder="Como está impresso no cartão"
          value={cardName}
          onChange={(e) => setCardName(e.target.value.toUpperCase())}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cardExpiry">Validade</Label>
          <Input
            id="cardExpiry"
            placeholder="MM/AA"
            value={cardExpiry}
            onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
            maxLength={5}
          />
        </div>
        <div>
          <Label htmlFor="cardCvv">CVV</Label>
          <Input
            id="cardCvv"
            placeholder="123"
            value={cardCvv}
            onChange={(e) => setCardCvv(maskCvv(e.target.value))}
            maxLength={4}
            type="password"
          />
        </div>
      </div>

      {cardType === "credit" && activeGateway !== "mercadopago" && (
        <div>
          <Label htmlFor="installments">Parcelamento</Label>
          <Select
            value={installments}
            onValueChange={setInstallments}
          >
            <SelectTrigger id="installments">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {installmentOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-3 h-3" />
        <span>Seus dados estão protegidos com criptografia de ponta a ponta.</span>
      </div>
    </div>
  );
}

