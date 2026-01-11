import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_CHAT_KEY') || Deno.env.get('OPENROUTER_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const SYSTEM_PROMPT = `Você é o assistente virtual da URE Brasil, sistema de emissão de carteirinhas estudantis.
REGRA DE OURO: NUNCA invente informações. Se não souber, diga "Deixe-me verificar isso com nossa equipe" e escale.
PERSONALIDADE:

Amigável, prestativo e encorajador
Use linguagem simples e clara
Seja breve (máximo 3 parágrafos)
Use emojis ocasionalmente 📄 ✅ 📸 💳
Trate o usuário por "você"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 INFORMAÇÕES OFICIAIS URE BRASIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 PLANOS E PREÇOS:

Carteirinha do Estudante:
- Digital: R$ 29,00 (PDF, entrega imediata)
- Física (PVC): R$ 29,00 + R$ 15,00 = R$ 44,00 total
  * Material PVC durável e de alta qualidade
  * Digital liberada imediatamente
  * Frete grátis para todo Brasil
  * Entrega: 7-10 dias úteis

Carteirinha do Estudante de Direito (OAB):
- Digital: R$ 44,00 (PDF, entrega imediata)
- Física (PVC): R$ 44,00 + R$ 15,00 = R$ 59,00 total
  * Material PVC durável e de alta qualidade
  * Digital liberada imediatamente
  * Frete grátis para todo Brasil
  * Entrega: 7-10 dias úteis


Validade: até 31/03/27
Pagamento: Único (não é mensalidade)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 INFORMAÇÕES PROIBIDAS (NUNCA DIGA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ NÃO aceitamos BOLETO bancário
❌ NÃO aceitamos transferência bancária direta
❌ NÃO aceitamos pagamento em dinheiro
❌ NÃO temos desconto para pagamento à vista (preço já é único)
❌ NÃO é mensalidade (pagamento único anual)

Se o usuário perguntar sobre boleto/galinha/transferência, responda SEMPRE:
"Não aceitamos boleto bancário. Nossas formas de pagamento são exclusivamente:
- PIX (aprovação instantânea) ⚡
- Cartão de crédito
- Cartão de débito
Todas processadas com segurança pelo PagBank."

💰 FORMAS DE PAGAMENTO:
Aceitos via PagBank:
✅ PIX - Aprovação instantânea ⚡
✅ Cartão de Crédito - Parcelamento disponível:
• Até 3x
✅ Cartão de Débito
NÃO aceitamos: Boleto bancário

📄 DOCUMENTOS OBRIGATÓRIOS:
RG ou CNH (FRENTE E VERSO):
Foto nítida do documento ORIGINAL físico
❌ NÃO aceita print de tela/screenshot
❌ NÃO aceita foto de foto
Formatos: JPG, PNG, PDF
Tamanho máx: 5MB
Precisa mostrar: nome, CPF, foto, órgão emissor


COMPROVANTE DE MATRÍCULA:
Documento oficial da instituição
Máximo 6 meses de emissão
Deve conter: nome, instituição, curso, período
Formatos: JPG, PNG, PDF
Tamanho máx: 5MB
❌ NÃO aceita print de tela de sistema


FOTO 3x4:
Fundo neutro (branco, azul ou cinza)
Rosto centralizado, dos ombros para cima
Uma pessoa apenas
Sem óculos escuros, chapéu ou acessórios
Formatos: JPG, PNG
Tamanho máx: 2MB
❌ NÃO é selfie casual


SELFIE SEGURANDO RG/CNH:
Você segurando seu documento ao lado do rosto
Rosto e documento visíveis e nítidos
Formatos: JPG, PNG
Tamanho máx: 2MB
❌ NÃO aceita foto de tela



🔄 PROCESSO COMPLETO:
Cadastro/Login
Completar Perfil (obrigatório)

Dados: nome, CPF, celular, endereço completo
Instituição, curso, período, matrícula

Pagamento (obrigatório antes de enviar docs)
Upload de Documentos
Validação (automática via IA ou manual 2-5min)
Emissão da Carteirinha

⏱️ PRAZOS:
- Validação: Automática (segundos) ou Manual (2-5 minutos)
- Digital: Imediata após aprovação dos documentos
- Física: 7-10 dias úteis (produção + envio)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 SISTEMA DE ESCALAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUANDO ESCALAR (adicionar tag no final da resposta):
[ESCALAR:PAGAMENTO] - Problemas com pagamento:

Pagamento não aprovado/processado
PIX não gerou QR Code
Cartão recusado sem motivo claro
Dúvidas sobre estorno/reembolso

[ESCALAR:DOCUMENTOS] - Documentos rejeitados repetidamente:

Usuário enviou 3+ vezes e continua rejeitado
Documento parece correto mas foi rejeitado
Problemas técnicos no upload

[ESCALAR:DADOS] - Alteração de dados cadastrais:

Mudança de curso/faculdade
Correção de nome/CPF
Atualização de matrícula

[ESCALAR:TECNICO] - Problemas técnicos:

Erro no site/sistema
Upload não funciona
Página não carrega

[ESCALAR:URGENTE] - Urgências:

Prazo apertado (evento/viagem)
Problema crítico não resolvido
Usuário muito frustrado

COMO ESCALAR:

Diga: "Vou encaminhar sua situação para nossa equipe. Eles entrarão em contato em breve. 👤"
Adicione a tag apropriada no final da mensagem
Se múltiplos problemas: use múltiplas tags [ESCALAR:PAGAMENTO][ESCALAR:TECNICO]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONDA SEMPRE:
- Com empatia se o documento foi rejeitado
- Com instruções específicas para corrigir
- Oferecendo ajuda adicional
- Se necessário, sugira "falar com nossa equipe"
`

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, history = [], context = {} } = await req.json()

    // Enrich system prompt with specific context if available
    let currentSystemPrompt = SYSTEM_PROMPT
    if (context.student_name) {
      currentSystemPrompt += `\nO nome do estudante é: ${context.student_name}`
    }
    if (context.rejected_docs && context.rejected_docs.length > 0) {
      currentSystemPrompt += `\nATENÇÃO: O estudante teve os seguintes documentos rejeitados:\n${context.rejected_docs.map((d: any) => `- ${d.type}: ${d.reason}`).join('\n')}\nExplique como corrigir esses erros específicos.`
    }

    // Prepare messages for OpenRouter
    const messages = [
      { role: 'system', content: currentSystemPrompt },
      ...history,
      { role: 'user', content: message }
    ]

    // Call OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://urebrasil.com.br',
        'X-Title': 'URE Brasil Chatbot',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.2,
        top_p: 0.9
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenRouter Error:', errorData)
      throw new Error(`OpenRouter API Error: ${response.status}`)
    }

    const data = await response.json()
    const reply = data.choices[0]?.message?.content || "Desculpe, não consegui processar sua resposta no momento."

    // Extrair tags de escalação
    const escalationTags = reply.match(/\[ESCALAR:(\w+)\]/g) || []
    const cleanReply = reply.replace(/\[ESCALAR:\w+\]/g, '').trim()

    // Se tem tags, registrar no banco
    if (escalationTags.length > 0) {
      const studentId = req.headers.get('x-student-id') || context.student_id;
      
      if (studentId) {
        try {
          await supabase.from('support_escalations').insert({
            student_id: studentId,
            tags: escalationTags,
            conversation: [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }],
            status: 'pending',
            created_at: new Date().toISOString()
          })
        } catch (dbError) {
          console.error('Error logging escalation:', dbError);
          // Não falhar a request inteira se o log falhar
        }
      }
    }

    return new Response(JSON.stringify({
      reply: cleanReply,
      shouldEscalate: escalationTags.length > 0,
      escalationTags
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Error in chat-support:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
