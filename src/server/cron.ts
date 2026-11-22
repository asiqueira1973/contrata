// Faxina diária (8.10; regra 11.11), chamada 1×/dia pelo cron da Vercel, na ordem da 8.10:
// convites vencidos → propostas → vagas vencidas → expurgo de candidaturas → expurgo de empresas →
// uploads não concluídos → banco de talentos → resumo diário → às segundas, resumo semanal aos
// donos sem acesso → retentativa de e-mails e webhooks → notificações antigas → CSVs velhos.
// Lotes de 200 até ~45 s; o que sobrar fica para o dia seguinte e vai no log (`sobrou`). Idempotente
// (e-mails com chave por dia/semana). O log leva só contagens (20.2).
import "server-only";
import { FAXINA_LOTE, FAXINA_ORCAMENTO_MS } from "@/lib/limits";
import { cleanOldNotifications, retryNotifications } from "@/server/email/outbox";
import { expireInvites, purgeCompanies, purgeExpired } from "@/server/org/cleanup";
import { cleanAbandonedApplications } from "@/server/recruiting/applications";
import { dailyDigest, weeklyOwnerDigest } from "@/server/recruiting/digests";
import { pauseExpiredJobs } from "@/server/recruiting/jobs";
import { cleanOldExports } from "@/server/recruiting/pipeline";
import { expireProposals, pendingProposalsDigest } from "@/server/recruiting/decisions";
import { expiringTalentsDigest } from "@/server/recruiting/talents";
import { retryWebhooks } from "@/server/webhooks/deliver";

// Empresas expurgadas por rodada: cada uma apaga uma pasta inteira no bucket.
const EMPRESAS_POR_RODADA = 5;

export async function runDailyCleanup(agora = () => Date.now(), hoje = new Date()) {
  const inicio = agora();
  const resta = () => Math.max(0, FAXINA_ORCAMENTO_MS - (agora() - inicio));
  const sobrou: string[] = [];
  const r: Record<string, number> = {};
  // Roda um passo em lotes até vir um lote incompleto; sem tempo, anota que sobrou.
  async function emLotes(nome: string, passo: () => Promise<number>, lote = FAXINA_LOTE) {
    r[nome] = 0;
    for (;;) {
      if (!resta()) {
        sobrou.push(nome);
        return;
      }
      const n = await passo();
      r[nome] += n;
      if (n < lote) return;
    }
  }
  // Passo de uma vez só (resumos, retentativas): pula sem tempo.
  async function umaVez(nome: string, passo: () => Promise<number>) {
    r[nome] = 0;
    if (!resta()) {
      sobrou.push(nome);
      return;
    }
    r[nome] = await passo();
  }

  await emLotes("convites_expirados", () => expireInvites(FAXINA_LOTE));
  await emLotes("propostas_expiradas", () => expireProposals(FAXINA_LOTE));
  await emLotes("vagas_pausadas", () => pauseExpiredJobs(FAXINA_LOTE));
  // Expurgo (11.12): anonimiza as candidaturas vencidas e as pessoas que ficaram sem nada vivo.
  r.pessoas_anonimizadas = 0;
  r.arquivos_apagados = 0;
  await emLotes("candidaturas_expurgadas", async () => {
    const x = await purgeExpired(FAXINA_LOTE);
    r.pessoas_anonimizadas += x.pessoas;
    r.arquivos_apagados += x.arquivos;
    return Math.max(x.candidaturas, x.pessoas);
  });
  await emLotes("empresas_expurgadas", () => purgeCompanies(EMPRESAS_POR_RODADA), EMPRESAS_POR_RODADA);
  // Candidaturas que não terminaram o envio em 24 h (9.4) e as tentativas públicas antigas.
  await emLotes("candidaturas_abandonadas", () => cleanAbandonedApplications(FAXINA_LOTE));
  // Banco de talentos (11.12; 8.7): tira quem venceu e avisa quem vence em até 30 dias.
  r.talentos_avisados = 0;
  await emLotes("talentos_retirados", async () => {
    const t = await expiringTalentsDigest(FAXINA_LOTE);
    r.talentos_avisados += t.avisados;
    return Math.max(t.retirados, t.avisados);
  });
  // Resumos (11.11): o diário da equipe e o das propostas pendentes há 24 h (8.6).
  await umaVez("resumos_diarios", () => dailyDigest(hoje));
  await umaVez("resumos_propostas", () => pendingProposalsDigest(hoje));
  // Às segundas (11.31): resumo semanal aos donos de vaga sem acesso.
  await umaVez("resumos_semanais", () => weeklyOwnerDigest(FAXINA_LOTE, hoje));
  // Retentativas (12.4, 11.17), cada uma com o tempo que sobra.
  await umaVez("emails_retentados", () => retryNotifications(FAXINA_LOTE, resta()));
  r.webhooks_desistidos = 0;
  await umaVez("webhooks_entregues", async () => {
    const w = await retryWebhooks(FAXINA_LOTE, resta());
    r.webhooks_desistidos = w.desistiu;
    return w.entregues;
  });
  await emLotes("notificacoes_apagadas", () => cleanOldNotifications(FAXINA_LOTE));
  // CSVs exportados (14.1) dos dias anteriores: o link já venceu (5 min), o arquivo não serve mais.
  await umaVez("pastas_exportacao", () => cleanOldExports());
  const resultado = { ...r, sobrou, duracao_ms: agora() - inicio };
  console.info("faxina_diaria", resultado);
  return resultado;
}
