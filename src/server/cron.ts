// Faxina diária (8.10; regra 11.11), chamada 1×/dia pelo cron da Vercel. No 8.3 só tem a pausa das
// vagas vencidas; o 8.10 acrescenta convites, propostas, expurgo e resumos, nesta mesma ordem da
// seção 9. Lotes de 200 até ~45 s; o que sobrar fica para o dia seguinte. Idempotente. O log leva
// só contagens (20.2).
import "server-only";
import { FAXINA_LOTE } from "@/lib/limits";
import { cleanAbandonedApplications } from "@/server/recruiting/applications";
import { pauseExpiredJobs } from "@/server/recruiting/jobs";
import { cleanOldExports } from "@/server/recruiting/pipeline";
import { expireProposals, pendingProposalsDigest } from "@/server/recruiting/decisions";

const ORCAMENTO_MS = 45_000;

export async function runDailyCleanup(agora = () => Date.now()) {
  const inicio = agora();
  let vagasPausadas = 0;
  for (;;) {
    const n = await pauseExpiredJobs(FAXINA_LOTE);
    vagasPausadas += n;
    if (n < FAXINA_LOTE || agora() - inicio > ORCAMENTO_MS) break;
  }
  // Candidaturas que não terminaram o envio em 24 h (9.4) e as tentativas públicas antigas.
  let abandonadas = 0;
  for (;;) {
    const n = await cleanAbandonedApplications(FAXINA_LOTE);
    abandonadas += n;
    if (n < FAXINA_LOTE || agora() - inicio > ORCAMENTO_MS) break;
  }
  // Propostas vencidas (12.3) e, depois, o resumo das pendentes há mais de 24 h (8.6).
  let propostasExpiradas = 0;
  for (;;) {
    const n = await expireProposals(FAXINA_LOTE);
    propostasExpiradas += n;
    if (n < FAXINA_LOTE || agora() - inicio > ORCAMENTO_MS) break;
  }
  const resumosPropostas = await pendingProposalsDigest();
  // CSVs exportados (14.1) dos dias anteriores: o link já venceu (5 min), o arquivo não serve mais.
  const exportacoes = await cleanOldExports();
  const r = { vagas_pausadas: vagasPausadas, candidaturas_abandonadas: abandonadas, propostas_expiradas: propostasExpiradas,
    resumos_propostas: resumosPropostas, pastas_exportacao: exportacoes };
  console.info("faxina_diaria", r);
  return r;
}
