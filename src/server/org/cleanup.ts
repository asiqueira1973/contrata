// Passos da faxina diária que apagam (8.10; 7.4, 11.12): convites vencidos, expurgo das candidaturas
// (com a exceção do banco de talentos) e das empresas excluídas há 7 dias. Os arquivos saem do
// bucket depois que o banco aceitou; falha ao apagar arquivo só vai ao log (sem o caminho).
import "server-only";
import { db } from "@/server/db/client";
import { errorCode } from "@/server/error-code";
import { storage } from "@/server/files/storage";

// Convites de membro vencidos (8.10). Recebe: o lote. Devolve quantos saíram.
export async function expireInvites(lote: number): Promise<number> {
  const { data, error } = await db().rpc("rs_fn_faxina_convites", { p_lote: lote });
  if (error) throw error;
  return data ?? 0;
}

// Expurgo (11.12): anonimiza as candidaturas vencidas e as pessoas que ficaram sem nada vivo, e
// apaga os arquivos. Recebe: o lote. Devolve as contagens.
export async function purgeExpired(lote: number): Promise<{ candidaturas: number; pessoas: number; arquivos: number }> {
  const { data, error } = await db().rpc("rs_fn_faxina_expurgos", { p_lote: lote });
  if (error) throw error;
  const r = data as { candidaturas: number; pessoas: number; paths: string[] };
  for (const path of r.paths) {
    await storage().delete(path).catch(() => console.error("arquivo_nao_apagado"));
  }
  return { candidaturas: r.candidaturas, pessoas: r.pessoas, arquivos: r.paths.length };
}

// Empresas excluídas há 7+ dias (7.4): a pasta inteira no bucket e depois tudo no banco. Recebe:
// o lote. Devolve quantas.
export async function purgeCompanies(lote: number): Promise<number> {
  const { data, error } = await db().rpc("rs_fn_empresas_a_expurgar", { p_lote: lote });
  if (error) throw error;
  let n = 0;
  for (const id of (data ?? []) as string[]) {
    // Uma empresa que falha não segura as outras: vai ao log (só o código) e tenta de novo amanhã.
    try {
      await storage().deletePrefix(`${id}/`);
      const { error: e2 } = await db().rpc("rs_fn_expurga_empresa", { p_empresa: id });
      if (e2) throw e2;
      n++;
    } catch (e) {
      console.error("expurgo_empresa_falhou", errorCode(e));
    }
  }
  return n;
}
