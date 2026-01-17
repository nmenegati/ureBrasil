import { Header } from "@/components/Header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const Termos = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="container max-w-3xl py-10 px-4">
        <Card className="border border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">
              Termos de Uso – URE Brasil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm md:text-base text-muted-foreground">
            <p>
              Ao acessar ou utilizar a página da URE Brasil e solicitar a emissão de carteirinhas de
              estudante, você aceita estes Termos de Uso integralmente. Estes termos regem o serviço de
              emissão de carteiras estudantis padronizadas (DNE/CIE), conforme Lei 12.933/2013.
            </p>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                1. Elegibilidade e responsabilidades
              </h2>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  o serviço destina-se a estudantes regularmente matriculados em instituições de ensino
                  reconhecidas (da educação infantil ao ensino superior);
                </li>
                <li>
                  para menores de 18 anos, o responsável legal deve confirmar os dados no formulário ou
                  anexar declaração de autorização, conforme modelo disponibilizado no site;
                </li>
                <li>
                  você declara que todas as informações fornecidas (nome, CPF, matrícula, foto e demais
                  dados) são verdadeiras, completas e atualizadas. A falsidade dessas informações pode
                  sujeitar o responsável a sanções civis e penais.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                2. Processo de emissão
              </h2>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  após o envio dos dados e do comprovante de matrícula, a carteirinha digital é emitida,
                  em regra, em até 48 horas úteis;
                </li>
                <li>
                  a carteirinha possui elementos de segurança (como QR Code, trama anti-scanner e
                  microletras) para uso em solicitações de meia-entrada em eventos;
                </li>
                <li>
                  pagamentos são processados por plataformas seguras; reembolsos serão analisados e
                  concedidos apenas em casos de erro comprovado pela URE Brasil.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                3. Uso permitido da carteirinha
              </h2>
              <p>
                A carteirinha pode ser utilizada exclusivamente para obtenção de meia-entrada em eventos
                culturais, esportivos e de lazer previstos na legislação aplicável. É expressamente
                proibido:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>falsificar, adulterar ou revender carteirinhas;</li>
                <li>emprestar ou compartilhar o documento com terceiros;</li>
                <li>divulgar cópias digitais de forma pública ou sem autorização;</li>
                <li>utilizar a carteirinha para qualquer finalidade não prevista em lei.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                4. Limitações e isenção de responsabilidade
              </h2>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  a URE Brasil não garante a aceitação universal da carteirinha, uma vez que a conferência
                  do direito à meia-entrada também depende das políticas e critérios adotados por cada
                  organizador de evento;
                </li>
                <li>
                  a URE Brasil não se responsabiliza por danos indiretos, lucros cessantes, prejuízos
                  financeiros ou recusa de meia-entrada por parte de terceiros;
                </li>
                <li>
                  o serviço poderá ser suspenso temporariamente para manutenção, atualizações técnicas ou em
                  casos de violação destes Termos de Uso.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                5. Alterações e contato
              </h2>
              <p>
                Estes termos podem ser atualizados periodicamente, e a versão vigente estará sempre
                disponível no site oficial da URE Brasil.
              </p>
              <p>
                Em caso de dúvidas, solicitações ou pedidos de cancelamento, entre em contato pelo e-mail{" "}
                <span className="font-medium text-foreground">suporte@urebrasil.com.br</span>.
              </p>
              <p className="text-xs text-muted-foreground">
                Última atualização: janeiro de 2026.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Termos;

