import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPublishedSiteBySlug } from "@/lib/departmentSiteService";
import { resolveCampoFromRequest } from "@/lib/publicTenant";
import { generateCheckInCode, normalizeBrazilPhone } from "@/lib/penielTicket";
import { enviarIngressoDepartamento } from "@/lib/departmentTicket";

/** Valida CPF pelos dois dígitos verificadores. */
function cpfValido(bruto: string): boolean {
  const cpf = bruto.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const [tamanho, posicao] of [[9, 10], [10, 11]] as const) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (posicao - i);
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(cpf[tamanho])) return false;
  }
  return true;
}

/**
 * POST /api/public/dept/[slug]/registrations
 *
 * Inscrição pública em um evento do departamento. Mesmo fluxo do Peniel:
 * formulário enxuto (nome, telefone, CPF) → código de check-in → QR →
 * mensagem no WhatsApp.
 *
 * A validação de prazo, vagas e duplicidade acontece SEMPRE aqui, no servidor.
 * O botão sumir na tela é conveniência; a regra é esta.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const campoId = await resolveCampoFromRequest(req);

    const dados = await getPublishedSiteBySlug(slug, campoId);
    if (!dados?.site.campo_id) {
      return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
    }
    const { site } = dados;

    const body = await req.json();
    const eventId: string | undefined = body.eventId;
    const nome = String(body.nome ?? "").trim();
    const telefone = String(body.telefone ?? "").trim();
    const cpf = String(body.cpf ?? "").replace(/\D/g, "");

    // ── Campos essenciais ───────────────────────────────────────────────────
    if (!eventId) return NextResponse.json({ error: "Evento não informado." }, { status: 400 });
    if (nome.length < 3) return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });

    const telefoneNormalizado = normalizeBrazilPhone(telefone);
    if (!telefoneNormalizado || telefoneNormalizado.replace(/\D/g, "").length < 12) {
      return NextResponse.json({ error: "Telefone inválido. Use DDD + número." }, { status: 400 });
    }
    if (!cpfValido(cpf)) {
      return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
    }

    // ── O evento é mesmo deste departamento e deste campo? ──────────────────
    const { data: evento } = await supabaseAdmin
      .from("app_events")
      .select("id, nome, title, data_inicio, data_fim, local, campo_id, department_id, status")
      .eq("id", eventId)
      .maybeSingle();

    if (
      !evento ||
      evento.campo_id !== site.campo_id ||
      evento.department_id !== site.department_id ||
      evento.status !== "PUBLICADO"
    ) {
      return NextResponse.json({ error: "Evento indisponível." }, { status: 404 });
    }

    const { data: form } = await supabaseAdmin
      .from("department_event_forms")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (!form || form.ativo === false) {
      return NextResponse.json({ error: "As inscrições deste evento não estão abertas." }, { status: 409 });
    }

    // ── Prazo ───────────────────────────────────────────────────────────────
    const agora = Date.now();
    const inicio = evento.data_inicio ? new Date(evento.data_inicio).getTime() : null;
    const abreEm = form.inscricoes_de ? new Date(form.inscricoes_de).getTime() : null;
    const fechaEm = form.inscricoes_ate ? new Date(form.inscricoes_ate).getTime() : inicio;

    if (abreEm && agora < abreEm) {
      return NextResponse.json({ error: "As inscrições ainda não abriram." }, { status: 409 });
    }
    if (fechaEm && agora > fechaEm) {
      return NextResponse.json({ error: "As inscrições para este evento já encerraram." }, { status: 409 });
    }

    // ── Vagas ───────────────────────────────────────────────────────────────
    const quantidade = Math.max(1, Math.min(Number(body.quantidade ?? 1), form.vagas_por_pessoa ?? 1));

    if (form.vagas_total != null) {
      const { count } = await supabaseAdmin
        .from("department_event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId).eq("status", "ATIVA").is("deleted_at", null);
      if ((count ?? 0) + quantidade > form.vagas_total) {
        return NextResponse.json({ error: "As vagas para este evento esgotaram." }, { status: 409 });
      }
    }

    // ── Duplicidade ─────────────────────────────────────────────────────────
    const { data: jaInscrito } = await supabaseAdmin
      .from("department_event_registrations")
      .select("id, check_in_code, lookup_token")
      .eq("event_id", eventId).eq("cpf", cpf)
      .neq("status", "CANCELADA").is("deleted_at", null)
      .maybeSingle();

    if (jaInscrito) {
      return NextResponse.json(
        {
          error: "Este CPF já está inscrito neste evento.",
          jaInscrito: true,
          codigo: jaInscrito.check_in_code,
          token: jaInscrito.lookup_token,
        },
        { status: 409 },
      );
    }

    // ── Grava ───────────────────────────────────────────────────────────────
    const checkInCode = generateCheckInCode();
    const lookupToken = randomBytes(16).toString("hex");
    const gratuito = form.gratuito || Number(form.valor ?? 0) <= 0;
    const valorTotal = gratuito ? 0 : Number(form.valor) * quantidade;

    const { data: inscricao, error } = await supabaseAdmin
      .from("department_event_registrations")
      .insert({
        campo_id: site.campo_id,
        event_id: eventId,
        department_id: site.department_id,
        nome,
        telefone: telefoneNormalizado,
        cpf,
        email: body.email ? String(body.email).trim() : null,
        data_nascimento: body.dataNascimento || null,
        campos_extras: body.camposExtras ?? {},
        quantidade,
        valor_total: valorTotal,
        check_in_code: checkInCode,
        lookup_token: lookupToken,
        payment_status: gratuito ? "ISENTO" : "PENDENTE",
        status: "ATIVA",
        origem: body.origem === "app" ? "app" : "site",
      })
      .select("*")
      .single();

    if (error) {
      // A unique parcial (event_id, cpf) pode estourar numa corrida entre dois
      // envios simultâneos — a mensagem tem de ser a mesma do caminho acima.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Este CPF já está inscrito neste evento.", jaInscrito: true },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ── QR + WhatsApp ───────────────────────────────────────────────────────
    // Gera o QR e dispara a mensagem. Uma falha aqui NÃO invalida a inscrição:
    // ela já está gravada e o código pode ser reenviado pelo painel.
    await enviarIngressoDepartamento(inscricao.id);

    // Relê para devolver a URL do QR que o helper acabou de persistir.
    const { data: atualizada } = await supabaseAdmin
      .from("department_event_registrations")
      .select("qr_code_url")
      .eq("id", inscricao.id)
      .maybeSingle();
    const qrUrl = atualizada?.qr_code_url ?? null;

    return NextResponse.json(
      {
        ok: true,
        inscricao: {
          id: inscricao.id,
          nome: inscricao.nome,
          codigo: checkInCode,
          token: lookupToken,
          qrUrl,
          valorTotal,
          pagamentoPendente: !gratuito,
          paymentLink: form.payment_link || site.payment_link,
          instrucoes: form.instrucoes_pagamento,
          mensagem: form.mensagem_confirmacao,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/public/dept/[slug]/registrations?token=…  ou  ?cpf=…&eventId=…
 *
 * Consulta pública da inscrição — o "onde está meu ingresso" do Peniel.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const campoId = await resolveCampoFromRequest(req);
    const dados = await getPublishedSiteBySlug(slug, campoId);
    if (!dados?.site.campo_id) {
      return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
    }

    const { searchParams } = req.nextUrl;
    const token = searchParams.get("token");
    const cpf = (searchParams.get("cpf") || "").replace(/\D/g, "");
    const eventId = searchParams.get("eventId");

    let q = supabaseAdmin
      .from("department_event_registrations")
      .select("id, nome, check_in_code, qr_code_url, quantidade, valor_total, " +
              "payment_status, status, checked_in, checked_in_at, event_id, created_at")
      .eq("campo_id", dados.site.campo_id)
      .is("deleted_at", null);

    if (token) {
      q = q.eq("lookup_token", token);
    } else if (cpf && eventId) {
      q = q.eq("cpf", cpf).eq("event_id", eventId);
    } else {
      return NextResponse.json(
        { error: "Informe o token da inscrição, ou CPF e evento." },
        { status: 400 },
      );
    }

    const { data } = await q.maybeSingle();
    if (!data) return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });

    return NextResponse.json({ inscricao: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
