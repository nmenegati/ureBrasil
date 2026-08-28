import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createHash } from "https://deno.land/std@0.168.0/node/crypto.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type ConsultaCpfNormalizada = {
  nome: string
  dataNascimento: string
  genero: string | null
}

interface APICPFSuccess {
  code: 200
  data: {
    nome: string
    data_nascimento: string
    genero?: string
  }
}

interface APICPFError {
  code: number
  message?: string
  error?: string
}

type APICPFResponse = APICPFSuccess | APICPFError | Record<string, unknown>

interface CPFHubSuccess {
  success: true
  data: {
    name: string
    birthDate: string
    gender?: string
  }
}

interface CPFHubError {
  success: false
  error?: {
    message?: string
  }
}

type CPFHubResponse = CPFHubSuccess | CPFHubError | Record<string, unknown>

function hashCpf(cpf: string): string {
  return createHash("sha256").update(cpf).digest("hex")
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim())
    if (parts[0]) return parts[0]
  }
  const cfIp = req.headers.get("cf-connecting-ip")
  if (cfIp) return cfIp
  return "unknown"
}

async function consultaAPICPF(cpf: string, apiKey: string): Promise<ConsultaCpfNormalizada> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`https://apicpf.com/api/consulta?cpf=${cpf}`, {
      headers: {
        "X-API-KEY": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    if (response.status === 429) {
      throw new Error("APICPF_RATE_LIMIT")
    }

    if (response.status >= 500) {
      throw new Error(`APICPF_HTTP_${response.status}`)
    }

    const result = (await response.json()) as APICPFResponse

    if ("code" in result && result.code === 200 && "data" in result && result.data) {
      const data = (result as APICPFSuccess).data

      return {
        nome: data.nome,
        dataNascimento: data.data_nascimento,
        genero: data.genero ?? null,
      }
    }

    if (response.status >= 400 && response.status < 500) {
      const message =
        "message" in result && typeof result.message === "string"
          ? result.message
          : "error" in result && typeof result.error === "string"
            ? result.error
            : "CPF não encontrado"

      throw new Error(`APICPF_FUNCTIONAL:${message}`)
    }

    if (
      ("message" in result && typeof result.message === "string") ||
      ("error" in result && typeof result.error === "string")
    ) {
      const message =
        "message" in result && typeof result.message === "string"
          ? result.message
          : (result.error as string)

      throw new Error(`APICPF_FUNCTIONAL:${message}`)
    }

    throw new Error("APICPF_INVALID_RESPONSE")
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("APICPF_TIMEOUT")
    }

    if (error instanceof SyntaxError) {
      throw new Error("APICPF_INVALID_RESPONSE")
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function consultaCPFHub(cpf: string, apiKey: string): Promise<ConsultaCpfNormalizada> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`https://api.cpfhub.io/cpf/${cpf}`, {
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    if (response.status === 429) {
      throw new Error("CPFHUB_RATE_LIMIT")
    }

    if (response.status >= 500) {
      throw new Error(`CPFHUB_HTTP_${response.status}`)
    }

    const result = (await response.json()) as CPFHubResponse

    if ("success" in result && result.success === true && "data" in result && result.data) {
      const data = (result as CPFHubSuccess).data

      return {
        nome: data.name,
        dataNascimento: data.birthDate,
        genero: data.gender ?? null,
      }
    }

    if (response.status >= 400 && response.status < 500) {
      const message =
        "error" in result &&
        result.error &&
        typeof result.error === "object" &&
        "message" in result.error &&
        typeof result.error.message === "string"
          ? result.error.message
          : "CPF não encontrado"

      throw new Error(`CPFHUB_FUNCTIONAL:${message}`)
    }

    if (
      "error" in result &&
      result.error &&
      typeof result.error === "object" &&
      "message" in result.error &&
      typeof result.error.message === "string"
    ) {
      throw new Error(`CPFHUB_FUNCTIONAL:${result.error.message}`)
    }

    throw new Error("CPFHUB_INVALID_RESPONSE")
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("CPFHUB_TIMEOUT")
    }

    if (error instanceof SyntaxError) {
      throw new Error("CPFHUB_INVALID_RESPONSE")
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function shouldFallbackFromAPICPF(error: unknown): boolean {
  if (!(error instanceof Error)) return true

  const message = error.message || ""

  if (
    message === "APICPF_TIMEOUT" ||
    message === "APICPF_RATE_LIMIT" ||
    message === "APICPF_INVALID_RESPONSE"
  ) {
    return true
  }

  if (message.startsWith("APICPF_HTTP_")) {
    const status = Number(message.replace("APICPF_HTTP_", ""))
    return Number.isFinite(status) && status >= 500
  }

  if (message.startsWith("APICPF_FUNCTIONAL:")) {
    return false
  }

  return true
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body = (await req.json().catch(() => null)) as { cpf?: string } | null

    if (!body || typeof body.cpf !== "string" || !body.cpf.trim()) {
      return new Response(
        JSON.stringify({ valid: false, error: "CPF é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const cpf = body.cpf.replace(/\D/g, "")
    if (cpf.length !== 11) {
      return new Response(
        JSON.stringify({ valid: false, error: "CPF inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const apicpfApiKey = Deno.env.get("APICPF_API_KEY")
    if (!apicpfApiKey) {
      return new Response(
        JSON.stringify({ error: "APICPF_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const cpfhubApiKey = Deno.env.get("CPFHUB_API_KEY")
    if (!cpfhubApiKey) {
      return new Response(
        JSON.stringify({ error: "CPFHUB_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const ip = getClientIp(req)
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const { data: rateLimit } = await supabase
      .from("cpf_rate_limits")
      .select("*")
      .eq("ip_address", ip)
      .maybeSingle()

    if (rateLimit) {
      const lastAttempt = new Date(rateLimit.last_attempt as string)

      if (lastAttempt > oneHourAgo && rateLimit.attempts >= 10) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: "Muitas tentativas. Aguarde 1 hora.",
            requiresCaptcha: true,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      if (lastAttempt > oneHourAgo) {
        await supabase
          .from("cpf_rate_limits")
          .update({
            attempts: (rateLimit.attempts as number) + 1,
            last_attempt: now.toISOString(),
          })
          .eq("ip_address", ip)
      } else {
        await supabase
          .from("cpf_rate_limits")
          .update({
            attempts: 1,
            first_attempt: now.toISOString(),
            last_attempt: now.toISOString(),
          })
          .eq("ip_address", ip)
      }
    } else {
      await supabase
        .from("cpf_rate_limits")
        .insert({
          ip_address: ip,
          attempts: 1,
          first_attempt: now.toISOString(),
          last_attempt: now.toISOString(),
        })
    }

    const cpfHash = hashCpf(cpf)

    const { data: cached } = await supabase
      .from("cpf_validations")
      .select("*")
      .eq("cpf_hash", cpfHash)
      .gt("expires_at", now.toISOString())
      .maybeSingle()

    if (cached) {
      const nowIso = now.toISOString()
      const newExpires = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString()

      await supabase
        .from("cpf_validations")
        .update({
          validated_at: nowIso,
          expires_at: newExpires,
          updated_at: nowIso,
        })
        .eq("cpf_hash", cpfHash)

      return new Response(
        JSON.stringify({
          valid: true,
          nome: cached.name,
          dataNascimento: cached.birth_date,
          genero: null,
          fromCache: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    let consultaResult: ConsultaCpfNormalizada
    let usedFallback = false

    try {
      consultaResult = await consultaAPICPF(cpf, apicpfApiKey)
    } catch (primaryError) {
      if (!shouldFallbackFromAPICPF(primaryError)) {
        const message =
          primaryError instanceof Error && primaryError.message.startsWith("APICPF_FUNCTIONAL:")
            ? primaryError.message.replace("APICPF_FUNCTIONAL:", "")
            : "CPF não encontrado"

        return new Response(
          JSON.stringify({ valid: false, error: message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
      }

      console.warn("[validate-cpf] APICPF falhou. Tentando CPFHub...", primaryError)

      try {
        consultaResult = await consultaCPFHub(cpf, cpfhubApiKey)
        usedFallback = true
        console.warn("[validate-cpf] Fallback para CPFHub acionado com sucesso")
      } catch (fallbackError) {
        if (fallbackError instanceof Error && fallbackError.message.startsWith("CPFHUB_FUNCTIONAL:")) {
          return new Response(
            JSON.stringify({
              valid: false,
              error: fallbackError.message.replace("CPFHUB_FUNCTIONAL:", ""),
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          )
        }

        console.error("[validate-cpf] CPFHub também falhou", fallbackError)

        return new Response(
          JSON.stringify({
            valid: false,
            error: "Serviço de validação temporariamente indisponível. Tente novamente em alguns minutos.",
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
      }
    }

    await supabase.from("cpf_validations").insert({
      cpf_hash: cpfHash,
      name: consultaResult.nome,
      birth_date: consultaResult.dataNascimento,
    })

    if (usedFallback) {
      console.info("[validate-cpf] Resposta retornada usando CPFHub como fallback")
    }

    return new Response(
      JSON.stringify({
        valid: true,
        nome: consultaResult.nome,
        dataNascimento: consultaResult.dataNascimento,
        genero: consultaResult.genero,
        fromCache: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro inesperado"
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
