// Faxina diária (8.10; regra 11.11), chamada 1×/dia pelo cron da Vercel. No 8.3 só tem a pausa das
// vagas vencidas; o 8.10 acrescenta convites, propostas, expurgo e resumos, nesta mesma ordem da
// seção 9. Lotes de 200 até ~45 s; o que sobrar fica para o dia seguinte. Idempotente. O log leva
// só contagens (20.2).
import "server-only";
import { FAXINA_LOTE } from "@/lib/limits";
import { cleanAbandonedApplications } from "@/server/recruiting/applications";
import { pauseExpiredJobs } from "@/server/recruiting/jobs";

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
  console.info("faxina_diaria", { vagas_pausadas: vagasPausadas, candidaturas_abandonadas: abandonadas });
  return { vagas_pausadas: vagasPausadas, candidaturas_abandonadas: abandonadas };
}
