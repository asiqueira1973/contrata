// Consultas do MCP (classe C, regra 11.34): diretas, em linguagem natural, escopo leitura.
// Sempre no alcance da credencial; o avaliador vê só nome e área de pessoas e equipe (seção 5).
import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { copy } from "@/lib/copy";
import type { Papel } from "@/lib/limits";
import { listAreas } from "@/server/org/areas";
import { listTeam } from "@/server/org/members";
import { listPeople } from "@/server/org/people";
import { bloqueio, consultar, erro, type ToolContext } from "./kit";
import { companySettings } from "@/server/org/companies";
import { EXCLUSAO_EMPRESA_DIAS } from "@/lib/limits";

// Registra uma consulta com título e descrição da copy e a guarda de escopo leitura. `entrada`:
// os filtros que o modelo pode passar (zod com .describe() em português, 13.3). `papel`: papel
// mínimo, quando a consulta não é para todos (ex.: exportar, 14.1).
export function consulta<E extends z.ZodObject>(
  server: McpServer, ctx: ToolContext, nome: string, fn: (args: z.infer<E>) => Promise<Record<string, unknown>>, entrada?: E, papel?: Papel,
) {
  if (bloqueio(ctx, "leitura", papel)) return;
  // O SDK não infere o tipo de um schema genérico (como em forms/registrar.ts).
  const schema = (entrada ?? z.object({})) as unknown as z.ZodObject<z.ZodRawShape>;
  server.registerTool(
    nome,
    { title: copy.mcp.titulos[nome], description: copy.mcp.descricoes[nome], inputSchema: schema, _meta: { ui: { visibility: ["model"] } } },
    async (args: unknown) => {
      const b = bloqueio(ctx, "leitura", papel);
      return b ? erro(b) : consultar(() => fn((args ?? {}) as z.infer<E>));
    },
  );
}

// quem_sou_eu (8.2; 8.9): quem conectou, os escopos e a configuração da empresa (o que o agente
// precisa para preencher o formulário da empresa). Empresa excluída: a data do expurgo.
export function registrarQuemSouEu(server: McpServer, ctx: ToolContext): void {
  consulta(server, ctx, "quem_sou_eu", async () => {
    const e = await companySettings(ctx.empresa.id);
    return {
      empresa: {
        nome: e.nome, slug: e.slug, descricao: e.descricao, site_url: e.site_url, email_contato: e.email_contato, cor_destaque: e.cor_destaque,
        logo_url: e.logo_url, pagina_publicada: e.pagina_publicada, retencao_dias: e.retencao_dias, talentos_meses: e.talentos_meses,
        mensagens_agente: e.mensagens_agente, aviso_privacidade_extra: e.aviso_privacidade_extra,
        ...(e.excluida_em ? { excluida_em: e.excluida_em, expurgar_em: new Date(new Date(e.excluida_em).getTime() + EXCLUSAO_EMPRESA_DIAS * 86_400_000).toISOString() } : {}),
      },
      credencial: { tipo: ctx.credencial.tipo, nome: ctx.credencial.nome },
      membro: ctx.membro ? { nome: ctx.membro.usuario.nome, email: ctx.membro.usuario.email, papel: ctx.membro.membro.papel } : null,
      escopos: ctx.escopos,
      alcance: ctx.alcance.tipo,
    };
  });
}

export function registrarConsultas(server: McpServer, ctx: ToolContext): void {
  const avaliador = ctx.membro?.membro.papel === "avaliador";
  registrarQuemSouEu(server, ctx);
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
