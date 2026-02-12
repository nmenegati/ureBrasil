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

// ============================================================
// FAQ HÍBRIDO: banco primeiro (grátis), LLM como fallback
// ============================================================
async function getFaqAnswer(message: string) {
  try {
    const { data: faqs, error } = await supabase
      .from('chat_faq')
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false })

    if (error || !faqs || faqs.length === 0) return null

    const lower = message.toLowerCase()
    const matched = faqs.find((faq: any) =>
      Array.isArray(faq.keywords) &&
      faq.keywords.some((kw: string) => lower.includes(String(kw).toLowerCase()))
    )

    if (matched) {
      await supabase
        .from('chat_faq')
        .update({ usage_count: (matched.usage_count || 0) + 1 })
        .eq('id', matched.id)
        .catch((e: unknown) => console.warn('FAQ usage_count update warn:', e))
      return matched.answer as string
    }
    return null
  } catch (e) {
    console.error('getFaqAnswer error:', e)
    return null
  }
}

// ============================================================
// PREÇOS DINÂMICOS DO BANCO
// ============================================================
async function getPlansInfo(): Promise<string> {
  try {
    const { data: plans, error } = await supabase
      .from('plans')
      .select('type, name, price, is_physical, is_direito')
      .eq('is_active', true)
      .order('price', { ascending: true })

    if (error || !plans || plans.length === 0) {
      return `Carteirinha do Estudante: Digital R$29 | Carteirinha do Estudante de Direito (OAB): Digital R$44 | Adicional físico (upsell): R$15`
    }

    const digitalGeral = plans.find(p => p.type === 'geral_digital')
    const digitalDireito = plans.find(p => p.type === 'direito_digital')
    const fisicaUpsell = plans.find(p => p.type === 'fisica_upsell')

    const lines = []

    if (digitalGeral) {
      lines.push(`Carteirinha do Estudante: Digital R$${digitalGeral.price}`)
      if (fisicaUpsell) {
        lines.push(`  → Com física (PVC): R$${digitalGeral.price} + R$${fisicaUpsell.price} = R$${Number(digitalGeral.price) + Number(fisicaUpsell.price)} total`)
      }
    }

    if (digitalDireito) {
      lines.push(`Carteirinha do Estudante de Direito (OAB): Digital R$${digitalDireito.price}`)
      if (fisicaUpsell) {
        lines.push(`  → Com física (PVC): R$${digitalDireito.price} + R$${fisicaUpsell.price} = R$${Number(digitalDireito.price) + Number(fisicaUpsell.price)} total`)
      }
    }

    return lines.join('\n')
  } catch (e) {
    console.error('getPlansInfo error:', e)
    return 'Consulte os planos disponíveis na página de escolha de plano.'
  }
}

// ============================================================
// SYSTEM PROMPT (sem preços hardcoded, sem nome de gateway)
// ============================================================
function buildSystemPrompt(plansInfo: string, context: Record<string, unknown>): string {
  let prompt = `Você é o assistente virtual da URE Brasil, sistema de emissão de carteirinhas estudantis.

REGRA DE OURO: NUNCA invente informações. Se não souber, diga "Vou encaminhar para nossa equipe" e escale.

PERSONALIDADE:
- Amigável, prestativo e encorajador
- Linguagem simples e clara
- Seja breve (máximo 3 parágrafos)
- Use emojis ocasionalmente 📄 ✅ 📸 💳
- Trate o usuário por "você"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 PLANOS E PREÇOS (valores atualizados):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${plansInfo}

Informações sobre a física:
- Material PVC durável e de alta qualidade
- Digital liberada imediatamente após aprovação dos documentos
- Frete grátis para todo Brasil
- Entrega: 10 a 15 dias úteis
- Pagamento único (não é mensalidade)

⚠️ VALIDADE: Todas as carteirinhas vencem em 31 de março, conforme Lei 12.933.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 FORMAS DE PAGAMENTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PIX — aprovação instantânea
✅ Cartão de Crédito

❌ NÃO aceitamos: boleto bancário, transferência bancária, pagamento em dinheiro
❌ NÃO é mensalidade — é pagamento único anual
❌ NÃO temos desconto para pagamento à vista (preço já é único)

Se perguntarem sobre boleto/transferência, informe que aceitamos apenas PIX e cartão de crédito.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 FLUXO DO ALUNO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Cadastro/Login
2. Completar Perfil (nome, CPF, celular, endereço, instituição, curso, período, matrícula)
3. Escolha de Plano (se estudante de Direito, escolhe entre geral ou OAB)
4. Pagamento
5. Oferta de carteira física (opcional, adicional)
6. Upload de Documentos
7. Validação dos documentos (automática ou manual)
8. Geração da Carteirinha

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 DOCUMENTOS OBRIGATÓRIOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RG ou CNH (frente e verso):
- Foto nítida do documento ORIGINAL físico
- ❌ NÃO aceita print de tela ou foto de foto
- Formatos: JPG, PNG, PDF (máx 5MB)
- Deve mostrar: nome, CPF, foto, órgão emissor

COMPROVANTE DE MATRÍCULA:
- Documento oficial da instituição, máximo 6 meses
- Deve conter: nome, instituição, curso, período
- Formatos: JPG, PNG, PDF (máx 5MB)
- ❌ NÃO aceita print de tela de sistema acadêmico

FOTO 3x4:
- Fundo neutro (branco, azul ou cinza)
- Rosto centralizado, dos ombros para cima
- Sem óculos escuros, chapéu ou acessórios
- Formatos: JPG, PNG (máx 2MB)
- ❌ NÃO é selfie casual

SELFIE SEGURANDO RG/CNH:
- Você segurando seu documento ao lado do rosto
- Rosto e documento visíveis e nítidos
- Formatos: JPG, PNG (máx 2MB)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️ PRAZOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Validação: automática (segundos) ou manual (2-5 minutos)
- Digital: imediata após aprovação dos documentos
- Física: 10 a 15 dias úteis (produção + envio via Correios)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 SISTEMA DE ESCALAÇÃO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando NÃO conseguir resolver, adicione a tag no final da resposta:

[ESCALAR:PAGAMENTO] — pagamento não aprovado, erro no PIX, cartão recusado, dúvidas sobre reembolso
[ESCALAR:DOCUMENTOS] — documento rejeitado 3+ vezes, parece correto mas foi rejeitado, erro no upload
[ESCALAR:DADOS] — mudança de curso/faculdade, correção de nome/CPF
[ESCALAR:TECNICO] — erro no site, upload não funciona, página não carrega
[ESCALAR:URGENTE] — prazo apertado, problema crítico, usuário muito frustrado

Ao escalar, diga: "Vou encaminhar para nossa equipe. Você pode acompanhar pelo menu Meus Tickets. 👤"
NÃO mencione WhatsApp ou telefone. O suporte é exclusivamente por tickets internos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEMPRE RESPONDA:
- Com empatia se documento foi rejeitado
- Com instruções específicas para corrigir
- Oferecendo ajuda adicional
- Sugira "abrir um ticket em Meus Tickets" se não conseguir resolver
`

  // Contexto dinâmico
  if (context.student_name) {
    prompt += `\nO nome do estudante é: ${context.student_name}`
  }

  const rejectedDocs = Array.isArray(context.rejected_docs)
    ? (context.rejected_docs as Array<{ type: string; reason: string }>)
    : []
  if (rejectedDocs.length > 0) {
    prompt += `\nATENÇÃO: O estudante teve documentos rejeitados:\n${rejectedDocs.map(d => `- ${d.type}: ${d.reason}`).join('\n')}\nExplique como corrigir esses erros específicos.`
  }

  return prompt
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const raw = (await req.json()) as unknown
    if (typeof raw !== 'object' || raw === null) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const { message, history = [], context = {} } = raw as {
      message: string
      history?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
      context?: Record<string, unknown>
    }

    // 1. Tentar FAQ primeiro (sem custo)
    const faqAnswer = await getFaqAnswer(message)
    if (faqAnswer) {
      console.log('✅ Resposta do FAQ (sem custo)')
      return new Response(JSON.stringify({
        reply: faqAnswer,
        shouldEscalate: false,
        source: 'faq'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2. Buscar preços dinâmicos do banco
    const plansInfo = await getPlansInfo()

    // 3. Montar prompt com preços atualizados e contexto
    const systemPrompt = buildSystemPrompt(plansInfo, context)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ]

    // 4. Chamar LLM via OpenRouter
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

    // 5. Extrair e registrar escalações
    const escalationTags = reply.match(/\[ESCALAR:(\w+)\]/g) || []
    const cleanReply = reply.replace(/\[ESCALAR:\w+\]/g, '').trim()

    if (escalationTags.length > 0) {
      const studentId = context.student_id
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
          console.error('Error logging escalation:', dbError)
        }
      }
    }

    return new Response(JSON.stringify({
      reply: cleanReply,
      shouldEscalate: escalationTags.length > 0,
      escalationTags,
      source: 'llm'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    console.error('Error in chat-support:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})