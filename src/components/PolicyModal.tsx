import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type PolicyType = "privacy" | "terms" | "delivery";

interface PolicyModalProps {
  type: PolicyType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PolicyModal({ type, open, onOpenChange }: PolicyModalProps) {
  const titles: Record<PolicyType, string> = {
    privacy: "Política de Privacidade – URE Brasil",
    terms: "Termos de Uso – URE Brasil",
    delivery: "Política de Entregas – URE Brasil",
  };

  const descriptions: Record<PolicyType, string> = {
    privacy: "Entenda como seus dados são coletados, utilizados e protegidos pela URE Brasil.",
    terms: "Condições gerais para uso da plataforma e emissão de carteirinhas estudantis.",
    delivery: "Regras de prazo, rastreamento, tentativas de entrega e cancelamentos.",
  };

  const renderContent = () => {
    if (type === "delivery") {
      return (
        <div className="space-y-4 text-sm text-muted-foreground">
          <p className="text-xs text-muted-foreground">
            Última atualização: Janeiro 2026
          </p>

          <p>
            A URE Brasil entrega carteirinhas físicas em todo o Brasil, com frete incluso no valor do produto.
          </p>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Prazo de entrega</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>10 a 15 dias úteis após confirmação do pagamento.</li>
              <li>Prazo contado a partir da cidade de Belo Horizonte/MG.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Acompanhamento</h3>
            <p>
              O rastreamento fica disponível no painel do cliente e também é enviado por e-mail com o código dos Correios.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Tentativas de entrega</h3>
            <p>
              Os Correios realizam até 3 tentativas de entrega. Caso não localizem o destinatário, a encomenda ficará disponível na agência postal mais próxima por 7 dias. Após esse prazo, retorna para a URE Brasil.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Endereço incorreto</h3>
            <p>
              Os dados cadastrais são de responsabilidade do cliente. Em caso de devolução por erro de endereço, o reenvio estará sujeito à cobrança de um novo frete.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Áreas de risco (AREs)</h3>
            <p>
              Em regiões classificadas pelos Correios como áreas de risco, podem ser adotados procedimentos especiais, como retirada na agência indicada ou entrega com escolta, o que pode impactar o prazo.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Atrasos e imprevistos</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Em caso de greve dos Correios, os prazos ficam suspensos até a normalização dos serviços.</li>
              <li>
                Se o prazo estiver claramente excedido, a URE Brasil abrirá reclamação junto aos Correios e manterá o cliente informado sobre o andamento.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Cancelamento por atraso</h3>
            <p>
              O cliente poderá solicitar cancelamento e reembolso após 20 dias úteis, contados da confirmação do pagamento, desde que a encomenda tenha retornado para a URE Brasil.
            </p>
          </div>

          <p className="text-sm">
            Dúvidas? Fale conosco pelo e-mail{" "}
            <span className="font-medium text-foreground">suporte@urebrasil.com.br</span>.
          </p>
        </div>
      );
    }

    if (type === "terms") {
      return (
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Ao utilizar a plataforma da URE Brasil e solicitar a emissão de carteirinhas estudantis, você declara
            estar de acordo com os Termos de Uso vigentes.
          </p>
          <p>
            A versão completa dos Termos de Uso está disponível na página{" "}
            <a
              href="/termos"
              className="text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              urebrasil.com.br/termos
            </a>
            .
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>
          A Política de Privacidade da URE Brasil descreve como coletamos, utilizamos e protegemos seus dados
          pessoais durante o uso da plataforma e na emissão de carteirinhas estudantis.
        </p>
        <p>
          A versão completa da Política de Privacidade está disponível na página{" "}
          <a
            href="/privacidade"
            className="text-primary hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            urebrasil.com.br/privacidade
          </a>
          .
        </p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titles[type]}</DialogTitle>
          <DialogDescription>{descriptions[type]}</DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}

