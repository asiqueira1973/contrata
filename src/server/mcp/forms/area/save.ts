// salvar_area / registrar_area (8.2): cria, edita ou arquiva área pelo domínio do 8.1 (7.4, 11.32).
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { areaSchema } from "@/lib/schemas/org";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { DomainError } from "@/server/http";
import { archiveArea, saveArea } from "@/server/org/areas";
import type { schemaArea } from "./index";

export async function gravarArea(dados: z.infer<typeof schemaArea>, ctx: ContextoMembro) {
  const r = copy.mcp.form.area.resumo;
  if (dados.operacao === "arquivar") {
    if (!dados.area) throw new DomainError("campo_invalido");
    await archiveArea(ctx, dados.area);
    return { ok: true as const, ids: [dados.area], resumo: r.arquivar("") };
  }
  const corpo = areaSchema.parse({ nome: dados.nome, responsavel_pessoa_id: dados.responsavel || null });
  if (dados.operacao === "editar" && !dados.area) throw new DomainError("campo_invalido");
  const id = await saveArea(ctx, dados.operacao === "editar" ? dados.area! : null, corpo);
  return { ok: true as const, ids: [id], resumo: r[dados.operacao](corpo.nome) };
}
