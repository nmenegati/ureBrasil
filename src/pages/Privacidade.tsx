import { Header } from "@/components/Header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const Privacidade = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="container max-w-3xl py-10 px-4">
        <Card className="border border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">
              Política de Privacidade – URE Brasil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm md:text-base text-muted-foreground">
            <p>
              A URE Brasil valoriza a privacidade dos usuários e se compromete a proteger os dados pessoais
              coletados no processo de emissão de carteirinhas de estudante, em conformidade com a Lei Geral
              de Proteção de Dados (LGPD – Lei nº 13.709/2018).
            </p>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                1. Dados coletados
              </h2>
              <p>
                Coletamos apenas as informações essenciais para validar a matrícula e emitir a carteirinha
                estudantil:
              </p>
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
              <p>
                Esses dados são fornecidos voluntariamente pelo usuário ou responsável legal, quando aplicável.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                2. Uso dos dados
              </h2>
              <p>Os dados pessoais são utilizados exclusivamente para:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>emitir e validar a carteirinha estudantil;</li>
                <li>verificar a autenticidade da carteirinha via QR Code ou validador online;</li>
                <li>enviar a carteirinha digital por e-mail e outros canais informados.</li>
              </ul>
              <p>
                Não compartilhamos dados pessoais com terceiros sem consentimento, exceto em casos de
                obrigação legal ou solicitação de autoridades competentes.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                3. Armazenamento e segurança
              </h2>
              <p>
                Os dados são armazenados em servidores seguros localizados no Brasil, com criptografia e
                acesso restrito a pessoas autorizadas.
              </p>
              <p>
                As informações são mantidas apenas pelo período necessário à validade da carteirinha
                (geralmente 1 ano), sendo excluídas ou anonimizadas após esse prazo, salvo obrigações
                legais.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                4. Direitos do titular
              </h2>
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
            </section>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                5. Cookies
              </h2>
              <p>
                Nosso site utiliza cookies apenas para melhorar a navegação, reforçar a segurança e manter
                funcionalidades essenciais do sistema, sem rastreamento para fins comerciais.
              </p>
              <p>Você pode gerenciar ou desativar cookies nas configurações do navegador.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                6. Atualizações desta política
              </h2>
              <p>
                Esta política pode ser atualizada periodicamente para refletir melhorias nos serviços ou
                mudanças legais. Mudanças relevantes serão comunicadas pelo site ou por e-mail, quando
                apropriado.
              </p>
              <p className="text-xs text-muted-foreground">
                Última atualização: janeiro de 2026. Em caso de dúvidas, entre em contato pelo e-mail
                contato@urebrasil.com.br.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Privacidade;

