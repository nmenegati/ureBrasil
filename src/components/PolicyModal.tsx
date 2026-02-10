import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type PolicyType = "privacy" | "terms" | "delivery" | "about";

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
    about: "Sobre Nós – URE Brasil",
  };

  const descriptions: Record<PolicyType, string> = {
    privacy: "Entenda como seus dados são coletados, utilizados e protegidos pela URE Brasil.",
    terms: "Condições gerais para uso da plataforma e emissão de carteirinhas estudantis.",
    delivery: "Regras de prazo, rastreamento, tentativas de entrega e cancelamentos.",
    about: "Conheça a missão, visão e propósitos da URE Brasil.",
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
            Ao acessar ou utilizar a página da URE Brasil e solicitar a emissão de carteirinhas de estudante,
            você aceita estes Termos de Uso integralmente. Estes termos regem o serviço de emissão de carteiras
            estudantis padronizadas (DNE/CIE), conforme Lei 12.933/2013.
          </p>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Elegibilidade e responsabilidades</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                o serviço destina-se a estudantes regularmente matriculados em instituições de ensino reconhecidas
                (educação infantil ao superior);
              </li>
              <li>
                para menores de 18 anos, o responsável legal deve confirmar os dados no formulário ou anexar
                declaração de autorização, conforme modelo disponibilizado no site;
              </li>
              <li>
                você garante a veracidade das informações fornecidas (nome, CPF, matrícula, foto e demais dados).
                A falsidade dessas informações pode sujeitar o responsável a sanções civis e penais.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Processo de emissão</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                após o envio dos dados e do comprovante de matrícula, a carteirinha digital é emitida, em regra,
                em até 48 horas úteis;
              </li>
              <li>
                a carteirinha possui elementos de segurança (como QR Code, trama anti-scanner e microletras) para
                uso em pedidos de meia-entrada em eventos;
              </li>
              <li>
                pagamentos são processados por plataformas seguras; reembolsos serão analisados e concedidos apenas
                em casos de erro comprovado pela URE Brasil.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Uso permitido</h3>
            <p>
              A carteirinha pode ser utilizada exclusivamente para obtenção de meia-entrada em eventos culturais,
              esportivos e de lazer previstos em lei. É proibido:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>falsificar, adulterar ou revender carteirinhas;</li>
              <li>emprestar ou compartilhar o documento com terceiros;</li>
              <li>divulgar cópias digitais de forma pública ou sem autorização;</li>
              <li>utilizar a carteirinha para fins não previstos na legislação aplicável.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Limitações e isenção de responsabilidade</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                a URE Brasil não garante a aceitação universal da carteirinha, pois a conferência do direito à
                meia-entrada também depende da política de cada organizador de evento;
              </li>
              <li>
                a URE Brasil não se responsabiliza por danos indiretos, lucros cessantes, prejuízos financeiros ou
                recusa de meia-entrada por parte de terceiros;
              </li>
              <li>
                o serviço poderá ser suspenso temporariamente para manutenção, ajustes técnicos ou em casos de
                violação destes Termos de Uso.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Alterações e contato</h3>
            <p>
              Estes termos podem ser atualizados periodicamente, e a versão vigente estará sempre disponível no
              site oficial da URE Brasil.
            </p>
            <p>
              Em caso de dúvidas, solicitações ou pedidos de cancelamento, entre em contato pelo e-mail{" "}
              <span className="font-medium text-foreground">suporte@urebrasil.com.br</span>.
            </p>
            <p className="text-xs text-muted-foreground">
              Última atualização: janeiro de 2026.
            </p>
          </div>
        </div>
      );
    }

    if (type === "about") {
      return (
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            A URE Brasil é uma entidade representativa focada em facilitar o acesso dos estudantes à
            carteirinha estudantil e aos benefícios legais de meia-entrada, por meio de uma experiência digital
            simples e segura.
          </p>
          <p>
            Nossa atuação envolve tecnologia, atendimento e parcerias institucionais para garantir que o processo
            de emissão, validação e uso da carteirinha seja transparente, confiável e alinhado à legislação vigente.
          </p>
          <p>
            Este texto é informativo e pode ser ajustado a qualquer momento para refletir a evolução dos serviços,
            dos projetos e da missão institucional da URE Brasil.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>
          A URE Brasil valoriza a privacidade dos usuários e se compromete a proteger os dados pessoais
          coletados no processo de emissão de carteirinhas de estudante, em conformidade com a Lei Geral
          de Proteção de Dados (LGPD – Lei nº 13.709/2018).
        </p>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Dados coletados</h3>
          <p>Coletamos apenas as informações essenciais para validar a matrícula e emitir a carteirinha estudantil:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>nome completo</li>
            <li>data de nascimento</li>
            <li>CPF</li>
            <li>endereço</li>
            <li>instituição de ensino</li>
            <li>curso ou série</li>
            <li>foto</li>
            <li>declaração de matrícula</li>
          </ul>
          <p>Esses dados são fornecidos voluntariamente pelo usuário ou responsável legal, quando aplicável.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Uso dos dados</h3>
          <p>Os dados pessoais são utilizados exclusivamente para:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>emitir e validar a carteirinha estudantil;</li>
            <li>verificar a autenticidade da carteirinha via QR Code ou validador online;</li>
            <li>enviar a carteirinha digital por e-mail e outros canais informados.</li>
          </ul>
          <p>
            Não compartilhamos dados pessoais com terceiros sem consentimento, exceto em casos de obrigação legal
            ou solicitação de autoridades competentes.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Armazenamento e segurança</h3>
          <p>
            Os dados são armazenados em servidores seguros localizados no Brasil, com criptografia e acesso restrito
            a pessoas autorizadas.
          </p>
          <p>
            As informações são mantidas apenas pelo período necessário à validade da carteirinha (geralmente 1 ano),
            sendo excluídas ou anonimizadas após esse prazo, salvo obrigações legais.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Direitos do titular</h3>
          <p>Você (ou seu responsável legal) pode, a qualquer momento:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>acessar os dados pessoais cadastrados;</li>
            <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li>solicitar a exclusão ou anonimização dos dados, quando cabível;</li>
            <li>revogar o consentimento para o tratamento de dados;</li>
            <li>solicitar a portabilidade dos dados para outro fornecedor de serviço, quando aplicável.</li>
          </ul>
          <p>
            Para exercer esses direitos, entre em contato pelo e-mail{" "}
            <span className="font-medium text-foreground">contato@urebrasil.com.br</span>.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Cookies</h3>
          <p>
            Nosso site utiliza cookies apenas para melhorar a navegação, reforçar a segurança e manter funcionalidades
            essenciais do sistema, sem rastreamento para fins comerciais.
          </p>
          <p>Você pode gerenciar ou desativar cookies nas configurações do navegador.</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Atualizações da política</h3>
          <p>
            Esta política pode ser atualizada periodicamente para refletir melhorias nos serviços ou mudanças legais.
            Mudanças relevantes serão comunicadas pelo site ou por e-mail, quando apropriado.
          </p>
          <p className="text-xs text-muted-foreground">
            Última atualização: janeiro de 2026. Em caso de dúvidas, entre em contato pelo e-mail
            contato@urebrasil.com.br.
          </p>
        </div>
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

