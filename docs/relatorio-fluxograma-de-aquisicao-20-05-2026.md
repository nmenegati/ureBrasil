Fluxograma Enxuto



\- Login/Acesso -> usuário autenticado? -> não : /login | sim : checa progresso do aluno

\- Perfil -> profile\_completed = false -> /complete-profile

\- Perfil -> profile\_completed = true e is\_law\_student = true -> /escolher-plano

\- Perfil -> profile\_completed = true e is\_law\_student = false -> plano geral digital é salvo no perfil -> /pagamento

\- CompleteProfile -> valida CEP + endereço + dados acadêmicos -> falha : fica na página com erro

\- CompleteProfile -> grava em student\_profiles ( profile\_completed , endereço, instituição, curso, período, matrícula, is\_law\_student ) -> Direito : current\_onboarding\_step = choose\_plan -> /escolher-plano

\- CompleteProfile -> grava em student\_profiles + define plano geral digital -> Não Direito : current\_onboarding\_step = payment -> /pagamento

\- EscolherPlano -> usuário escolhe plano digital -> salva plan\_id no student\_profiles + selected\_plan\_id no localStorage -> /pagamento

\- EscolherPlano -> falha ao localizar plano/perfil -> erro ou redireciona para /complete-profile

\- Pagamento -> carrega plan\_id do perfil + gateway ativo -> usuário escolhe PIX ou cartão

\- Pagamento / PIX -> gateway Mercado Pago -> edge mercadopago-payment cria payments

\- Pagamento / PIX -> gateway alternativo -> edge create-payment cria/mocka payments

\- Pagamento / PIX -> retorno com pix\_code -> /pagamento/pix

\- Pagamento / PIX -> polling em payments.status -> approved : segue | não approved : continua aguardando/expira

\- Pagamento / PIX -> approved -> trigger SQL create\_student\_card\_on\_payment cria student\_cards com pending\_docs

\- Pagamento / PIX -> plano físico? -> sim : current\_onboarding\_step = upload\_documents -> /upload-documentos

\- Pagamento / PIX -> plano digital? -> sim : current\_onboarding\_step = upsell\_physical -> /pagamento/sucesso

\- Pagamento / Cartão -> gateway Mercado Pago -> frontend usa processCardPayment -> edge mercadopago-payment cria payments

\- Pagamento / Cartão -> condição de bloqueio atual -> !result.success ou result.status = rejected : erro e não avança

\- Pagamento / Cartão -> gateway PagBank -> edge pagbank-payment-v2

\- Pagamento / Cartão -> gateway Efí -> edge efi-payment

\- Pagamento / Cartão -> approved/sucesso aceito pelo frontend -> trigger SQL create\_student\_card\_on\_payment cria student\_cards com pending\_docs

\- Pagamento / Cartão -> plano físico? -> sim : current\_onboarding\_step = upload\_documents -> /upload-documentos

\- Pagamento / Cartão -> plano digital? -> sim : current\_onboarding\_step = upsell\_physical -> /pagamento/sucesso

\- Upsell Físico / PaymentSuccessPage -> modal abre após pagamento digital

\- Upsell Físico / aceitar -> valida pagamento original approved em payments -> não aprovado : volta para /pagamento

\- Upsell Físico / aceitar -> salva upsell\_data -> /checkout

\- Upsell Físico / recusar -> current\_onboarding\_step = upload\_documents -> /upload-documentos

\- Checkout Upsell -> resolve originalPaymentId + valor do adicional -> falha : redireciona conforme step; após 3 falhas pode forçar /upload-documentos

\- Checkout Upsell / PIX -> edge mercadopago-payment ou create-payment

\- Checkout Upsell / PIX -> approved -> atualiza student\_cards.is\_physical = true -> /upload-documentos

\- Checkout Upsell / Cartão MP -> frontend usa processCardPayment

\- Checkout Upsell / Cartão MP -> condição de bloqueio atual -> !result.success ou result.status = rejected : erro e não avança

\- Checkout Upsell / Cartão MP -> sucesso -> atualiza student\_cards.is\_physical = true + current\_onboarding\_step = upload\_documents -> /upload-documentos

\- Checkout Upsell / outros gateways -> sucesso -> mesmo destino /upload-documentos

\- UploadDocumentos -> usuário envia matricula , rg , foto 3x4 , selfie

\- UploadDocumentos -> frontend grava arquivo no bucket + registro em documents com status = pending

\- UploadDocumentos -> trigger SQL trigger\_validate\_document chama edge validate-document-v2

\- Validação IA -> approved -> atualiza documents.status = approved

\- Validação IA -> rejected -> atualiza documents.status = rejected + motivo -> usuário reenviará

\- Validação IA / foto 3x4 aprovada -> atualiza student\_profiles.profile\_photo\_url

\- Após aprovação de docs de rosto -> trigger SQL trigger\_compare\_faces chama edge compare-faces quando há rg/foto/selfie aprovados

\- Comparação Facial AWS Rekognition -> compara selfie x rg e selfie x foto

\- Comparação Facial -> passed = true -> student\_profiles.face\_validated = true + insere face\_validations

\- Comparação Facial -> passed = false -> rejeita selfie em documents + usuário reenviará

\- Comparação Facial -> não altera step diretamente

\- Ativação da Carteirinha -> trigger SQL activate\_student\_card\_on\_docs\_approved

\- Ativação da Carteirinha -> condição: 4 documentos approved

\- Ativação da Carteirinha -> destino: student\_cards.status = active + atualiza qr\_code

\- Atenção -> essa trigger não checa terms\_accepted nem face\_validated ; esse bloqueio fica no app

\- Termo de Responsabilidade -> aparece quando 4 documentos approved

\- Termo -> usuário aceita -> grava em student\_profiles ( terms\_accepted , data, IP, versão)

\- Termo + Face + 4 docs -> frontend chama RPC advance\_to\_review

\- advance\_to\_review -> condição esperada: 4 docs approved + face\_validated = true + terms\_accepted = true

\- advance\_to\_review -> true : current\_onboarding\_step = review\_data -> /gerar-carteirinha

\- advance\_to\_review -> false : permanece em /upload-documentos

\- Validação Manual -> comparação facial demorou/falhou repetidamente -> usuário solicita manual

\- Validação Manual -> grava student\_profiles.manual\_review\_requested = true -> /aguardando-aprovacao

\- GerarCarteirinha -> guarda exige review\_data

\- GerarCarteirinha -> revalida profile\_completed , 4 docs approved , face\_validated , terms\_accepted

\- GerarCarteirinha -> pendência encontrada -> volta para /upload-documentos

\- GerarCarteirinha -> tudo ok -> usuário confirma dados -> current\_onboarding\_step = completed -> /carteirinha

\- Carteirinha -> guarda exige completed

\- Carteirinha -> busca student\_profiles + student\_cards.status = active

\- Carteirinha -> se digital\_card\_url já existe -> exibe carteirinha

\- Carteirinha -> se digital\_card\_url não existe -> gera imagem com html2canvas , envia ao bucket student-cards , grava student\_cards.digital\_card\_url e digital\_card\_generated = true

\- Carteirinha -> destino final: aluno acessa a carteirinha digital pronta em /carteirinha

Tabelas Impactadas Por Etapa



\- CompleteProfile -> student\_profiles

\- EscolherPlano -> student\_profiles

\- Pagamento principal -> payments , trigger em student\_cards

\- Upsell físico -> payments , student\_cards , student\_profiles

\- Upload de docs -> bucket documents , tabela documents

\- Validação IA -> documents , audit\_logs , student\_profiles.profile\_photo\_url

\- Comparação facial -> student\_profiles , documents , face\_validations , audit\_logs

\- Advance to review -> student\_profiles

\- Ativação da carteirinha -> student\_cards

\- Entrega digital -> bucket student-cards , student\_cards

Pontos Críticos Do Fluxo



\- Pagamento rejected agora está bloqueado no Pagamento principal e também no Checkout do upsell para Mercado Pago cartão.

\- student\_cards.status = active pode acontecer antes de review\_data , porque a trigger de documentos não depende de termo/face.

\- O avanço de current\_onboarding\_step acontece majoritariamente no frontend, não nas triggers SQL.

