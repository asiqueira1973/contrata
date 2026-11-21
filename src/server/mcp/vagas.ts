// Peças das ferramentas de vaga (8.3): achar a vaga que a pessoa citou ("a vaga de atendente")
// dentro do alcance (11.32) e os endereços públicos (página da vaga, pré-visualização).
import "server-only";
import { z } from "zod";
import { LISTA_MAX } from "@/lib/limits";
import { linkDePrevia } from "@/server/careers/preview";
import { empresaPorSlug } from "@/server/careers/public";
import { siteOrigin } from "@/server/oauth/server";
import { getJob, listJobs, type ContextoVagas, type VagaNaLista } from "@/server/recruiting/jobs";
import { acharPorNome } from "./forms/comum";

// Acha a vaga pelo id (qualquer uma do alcance) ou pelo título (exato, ou uma só que contenha o
// texto, entre as 200 mais novas). Devolve: a vaga ou null (nenhuma ou mais de uma).
export async function acharVaga(ctx: ContextoVagas, texto: unknown): Promise<Pick<VagaNaLista, "id" | "titulo" | "status"> | null> {
  if (typeof texto !== "string" || !texto.trim()) return null;
  if (z.uuid().safeParse(texto.trim()).success) {
    try {
      const v = await getJob(ctx, texto.trim());
      return { id: v.id, titulo: v.titulo, status: v.status };
    } catch {
      return null;
    }
  }
  const { itens } = await listJobs(ctx, {}, { inicio: 0, limite: LISTA_MAX });
  return acharPorNome(itens.map((v) => ({ ...v, nome: v.titulo })), texto);
}

// Endereços da vaga: a página pública (se a página e a vaga estão no ar) e, com a página ainda
// não publicada, o link de pré-visualização assinado de 10 min (critério do 8.3).
export async function enderecosDaVaga(empresaSlug: string, empresaId: string, vagaSlug: string, publicada: boolean) {
  const empresa = await empresaPorSlug(empresaSlug);
  const site = siteOrigin();
  return {
    url: empresa?.pagina_publicada && publicada ? `${site}/${empresaSlug}/vagas/${vagaSlug}` : null,
    pagina_publicada: !!empresa?.pagina_publicada,
    link_previa: empresa && !empresa.pagina_publicada ? linkDePrevia(site, empresaSlug, empresaId) : null,
  };
}
