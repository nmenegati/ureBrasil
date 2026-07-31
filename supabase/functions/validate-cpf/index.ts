import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createHash } from "https://deno.land/std@0.168.0/node/crypto.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface CpfHubSuccess {
  code: 200
  data: {
    nome: string
    data_nascimento: string
    genero?: string
  }
}

interface CpfHubError {
  code: number
  message?: string
  error?: string
}

type CpfHubResponse = CpfHubSuccess | CpfHubError | Record<string, unknown>

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

    const apiKey = Deno.env.get("CPFHUB_API_KEY")
    if (!apiKey) {
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
          fromCache: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const response = await fetch(`https://apicpf.com/api/consulta?cpf=${cpf}`, {
      headers: {
        "X-API-KEY": apiKey,
        Accept: "application/json",
      },
    })

    // Tratar 429 (rate limit diário da APICPF) antes de parsear JSON
    if (response.status === 429) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Serviço de consulta de CPF temporariamente indisponível. Tente novamente mais tarde.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const result = (await response.json()) as CpfHubResponse

    const isSuccess = "code" in result ? result.code === 200 : response.ok

    if (isSuccess && "data" in result && result.data) {
      const data = (result as CpfHubSuccess).data

      await supabase.from("cpf_validations").insert({
        cpf_hash: cpfHash,
        name: data.nome,
        birth_date: data.data_nascimento,
      })

      return new Response(
        JSON.stringify({
          valid: true,
          nome: data.nome,
          dataNascimento: data.data_nascimento,
          genero: data.genero ?? null,
          fromCache: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const errorMessage =
      "message" in result && typeof result.message === "string"
        ? result.message
        : "error" in result && typeof result.error === "string"
          ? result.error
          : "CPF não encontrado"

    return new Response(
      JSON.stringify({ valid: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro inesperado"
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
