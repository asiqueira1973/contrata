// Resumos da faxina (8.10): o diário da equipe (11.11) e o semanal aos donos de vaga sem acesso
// (11.31). Só contagens por vaga: nenhum nome de candidato vai por e-mail. Um por destinatário por
// dia (ou por semana), pela chave da notificação: rodar a faxina duas vezes não manda de novo.
import "server-only";
import { copy } from "@/lib/copy";
import { CANDIDATURA_PARADA_DIAS, FAXINA_ORCAMENTO_MS, FUSO, REVISAO_ATRASADA_DIAS } from "@/lib/limits";
import { db } from "@/server/db/client";
import { enqueue } from "@/server/email/outbox";
import { resumoDiario, resumoDonoVaga } from "@/server/email/templates";
import { urlDoLogo } from "@/server/files/logo";
import { linkPedirAcesso } from "@/server/org/access-request";

// Data de hoje em São Paulo (AAAA-MM-DD): a chave dos e-mails por dia e por semana.
const diaEmSP = (agora: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(agora);
// Diz se é segunda-feira em São Paulo (11.31).
export const ehSegunda = (agora: Date) => new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short" }).format(agora) === "Mon";

type VagaDoResumo = { id: string; titulo: string; area_id: string | null; revisoes: number; revisoes_atrasadas: number; paradas: number; pausada_prazo: boolean; responsavel: string | null };
type MembroDoResumo = { id: string; papel: "administrador" | "recrutador"; todas_areas: boolean; areas: string[]; email: string; nome: string | null };

// Quem recebe os itens de uma vaga: o responsável válido; sem ele, administradores e recrutadores
// cujo alcance inclui a vaga (11.32).
function destinatarios(v: VagaDoResumo, membros: MembroDoResumo[]): MembroDoResumo[] {
  const resp = v.responsavel ? membros.find((m) => m.id === v.responsavel) : undefined;
  if (resp) return [resp];
  return membros.filter((m) => m.papel === "administrador" || m.todas_areas || (!!v.area_id && m.areas.includes(v.area_id)));
}

// Resumo diário (11.11): candidaturas paradas há 14+ dias, revisões pedidas sem resposta (as de 15+
// dias como atrasadas) e vagas pausadas pelo prazo, por vaga. Propostas pendentes seguem no e-mail
// próprio do 8.6 (decisoes_pendentes). Para no prazo (o resto sai amanhã: a chave é por dia, então
// quem já recebeu não recebe de novo). Recebe: o momento e o prazo em ms. Devolve quantos saíram.
export async function dailyDigest(agora = new Date(), prazoMs = FAXINA_ORCAMENTO_MS): Promise<number> {
  const limite = Date.now() + prazoMs;
  const { data: empresas, error } = await db().from("rs_empresas").select("id, nome").is("excluida_em", null).is("suspensa_em", null);
  if (error) throw error;
  const dia = diaEmSP(agora);
  const c = copy.resumoDiario;
  let n = 0;
  for (const e of empresas ?? []) {
    if (Date.now() >= limite) break;
    const { data, error: e2 } = await db().rpc("rs_fn_resumo_diario", { p_empresa: e.id, p_parada_dias: CANDIDATURA_PARADA_DIAS, p_revisao_dias: REVISAO_ATRASADA_DIAS });
    if (e2) throw e2;
    const r = data as { vagas: VagaDoResumo[]; membros: MembroDoResumo[] };
    const porMembro = new Map<string, { m: MembroDoResumo; linhas: string[]; itens: number }>();
    for (const v of r.vagas) {
      const itens = [
        ...(v.paradas ? [c.paradas(v.paradas)] : []),
        ...(v.revisoes ? [c.revisoes(v.revisoes, v.revisoes_atrasadas)] : []),
        ...(v.pausada_prazo ? [c.pausada] : []),
      ];
      if (!itens.length) continue;
      for (const m of destinatarios(v, r.membros)) {
        const atual = porMembro.get(m.id) ?? { m, linhas: [], itens: 0 };
        atual.linhas.push(c.linha(v.titulo, itens));
        atual.itens += v.paradas + v.revisoes + (v.pausada_prazo ? 1 : 0);
        porMembro.set(m.id, atual);
      }
    }
    for (const { m, linhas, itens } of porMembro.values()) {
      const email = resumoDiario({ empresa: e.nome, linhas, n: itens });
      const id = await enqueue({ empresaId: e.id, tipo: "resumo_diario", destinatario: m.email, chave: `resumo_diario:${m.id}:${dia}`,
        assunto: email.assunto, html: email.html, texto: email.texto });
      if (id) n++;
    }
  }
  return n;
}

// Resumo semanal aos donos de vaga sem acesso (11.31), às segundas. Recebe: o lote e o momento.
// Devolve quantos e-mails saíram (0 fora da segunda).
export async function weeklyOwnerDigest(lote: number, agora = new Date(), prazoMs = FAXINA_ORCAMENTO_MS): Promise<number> {
  if (!ehSegunda(agora)) return 0;
  const limite = Date.now() + prazoMs;
  // Todas as vagas, de lote em lote (achado A2 do verifier), dentro do prazo.
  const linhas: unknown[] = [];
  for (let inicio = 0; Date.now() < limite; inicio += lote) {
    const { data, error } = await db().rpc("rs_fn_resumo_donos", { p_lote: lote, p_inicio: inicio });
    if (error) throw error;
    const pagina = (data ?? []) as unknown[];
    linhas.push(...pagina);
    if (pagina.length < lote) break;
  }
  const data = linhas;
  type Linha = { vaga_id: string; titulo: string; empresa_id: string; empresa: string; slug: string; cor_destaque: string | null; logo_path: string | null;
    email_contato: string; pessoa_id: string; nome: string; email: string; em_analise: number; entrevistas: number; fase_final: number;
    encerradas_semana: number; contratada: boolean; recrutador: string | null };
  const semana = diaEmSP(agora);
  let n = 0;
  for (const l of (data ?? []) as Linha[]) {
    const m = resumoDonoVaga({
      empresa: l.empresa, cor: l.cor_destaque, logo: urlDoLogo(l.slug, l.logo_path), nome: l.nome.split(/\s+/)[0], vaga: l.titulo, recrutador: l.recrutador,
      url: linkPedirAcesso(l.slug, l.empresa_id, l.pessoa_id, agora), contagens: l,
    });
    const id = await enqueue({ empresaId: l.empresa_id, tipo: "resumo_dono_vaga", destinatario: l.email, chave: `resumo_dono:${l.vaga_id}:${l.pessoa_id}:${semana}`,
      assunto: m.assunto, html: m.html, texto: m.texto, replyTo: l.email_contato, fromName: l.empresa });
    if (id) n++;
  }
  return n;
}
