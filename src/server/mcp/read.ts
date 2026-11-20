// Consultas do MCP (classe C, regra 11.34): diretas, em linguagem natural, escopo leitura.
// Sempre no alcance da credencial; o avaliador vê só nome e área de pessoas e equipe (seção 5).
import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { listAreas } from "@/server/org/areas";
import { listTeam } from "@/server/org/members";
import { listPeople } from "@/server/org/people";
import { bloqueio, consultar, erro, type ToolContext } from "./kit";

// Registra uma consulta com título e descrição da copy e a guarda de escopo leitura.
function consulta(server: McpServer, ctx: ToolContext, nome: string, fn: () => Promise<Record<string, unknown>>) {
  if (bloqueio(ctx, "leitura")) return;
  server.registerTool(
    nome,
    { title: copy.mcp.titulos[nome], description: copy.mcp.descricoes[nome], inputSchema: z.object({}), _meta: { ui: { visibility: ["model"] } } },
    async () => {
      const b = bloqueio(ctx, "leitura");
      return b ? erro(b) : consultar(fn);
    },
  );
}

export function registrarConsultas(server: McpServer, ctx: ToolContext): void {
  const avaliador = ctx.membro?.membro.papel === "avaliador";
  consulta(server, ctx, "quem_sou_eu", async () => ({
    empresa: { nome: ctx.empresa.nome, slug: ctx.empresa.slug },
    credencial: { tipo: ctx.credencial.tipo, nome: ctx.credencial.nome },
    membro: ctx.membro ? { nome: ctx.membro.usuario.nome, email: ctx.membro.usuario.email, papel: ctx.membro.membro.papel } : null,
    escopos: ctx.escopos,
    alcance: ctx.alcance.tipo,
  }));
  consulta(server, ctx, "listar_equipe", async () => {
    const equipe = await listTeam(ctx.empresa.id);
    return {
      equipe: equipe.map((m) =>
        avaliador
          ? { nome: m.nome ?? null, areas: m.areas.map((a) => a.nome) }
          : { id: m.id, nome: m.nome, email: m.email, papel: m.papel, todas_areas: m.todas_areas, areas: m.areas.map((a) => a.nome), convite_pendente: m.pendente, convite_expira_em: m.convite_expira_em, ultimo_acesso_em: m.ultimo_acesso_em },
      ),
    };
  });
  consulta(server, ctx, "listar_areas", async () => ({ areas: await listAreas(ctx.empresa.id) }));
  consulta(server, ctx, "listar_pessoas", async () => {
    const pessoas = await listPeople(ctx.empresa.id);
    return {
      pessoas: pessoas.map((p) =>
        avaliador
          ? { nome: p.nome, area: p.area?.nome ?? null }
          : { id: p.id, nome: p.nome, email: p.email, cargo: p.cargo, area: p.area?.nome ?? null, area_id: p.area?.id ?? null, tem_acesso: !!p.acesso && !p.acesso.pendente, convite_pendente: !!p.acesso?.pendente, papel: p.acesso?.papel ?? null, vagas_como_dono: p.vagas_como_dono },
      ),
    };
  });
}
