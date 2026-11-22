// Monta o servidor MCP de uma requisição (stateless, seção 4): um McpServer novo por chamada, com
// as ferramentas que a credencial pode usar (escopo efetivo e papel, 11.16). Consultas sempre;
// formulários (MCP Apps) se o cliente mostra ou não diz; fallbacks se não mostra ou não diz.
import "server-only";
import { McpServer } from "@modelcontextprotocol/server";
import { NOME_PRODUTO } from "@/lib/copy";
import { formularioAcesso } from "./forms/acesso";
import { formularioAdicionarCandidato } from "./forms/adicionar_candidato";
import { formularioArea } from "./forms/area";
import { formularioAvaliacao } from "./forms/avaliacao";
import { formularioConvidarParaVaga } from "./forms/convidar_para_vaga";
import { formularioDecisoes } from "./forms/decisoes";
import { formularioMensagem } from "./forms/mensagem";
import { formularioModelos } from "./forms/modelos_mensagem";
import { formularioPropostas } from "./forms/propostas";
import { formularioRespostaRevisao } from "./forms/resposta_revisao";
import { formularioConexoes } from "./forms/conexoes";
import { formularioConvite } from "./forms/convite";
import { formularioEncerrarVaga } from "./forms/encerrar_vaga";
import { formularioPaginaDeCarreiras } from "./forms/pagina_de_carreiras";
import { formularioPausarVaga } from "./forms/pausar_vaga";
import { formularioPublicarVaga } from "./forms/publicar_vaga";
import { formularioVaga } from "./forms/vaga";
import { formularioPessoa } from "./forms/pessoa";
import { formularioWebhooks } from "./forms/webhooks";
import { registrarFormulario } from "./forms/registrar";
import { exigirAnotacoes, type ToolContext } from "./kit";
import { registrarConsultas } from "./read";
import { registrarConsultasDeCandidatura } from "./read-applications";
import { registrarConsultasDeVaga } from "./read-jobs";
import { registrarOperacoes } from "./operations";
import { registrarRecursoDoFormulario } from "./ui";

export const SERVER_INFO = { name: NOME_PRODUTO.toLowerCase().replace(/\s+/g, "-"), version: "0.7.0" } as const;

export function buildMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer(SERVER_INFO);
  exigirAnotacoes(server);
  registrarConsultas(server, ctx);
  registrarConsultasDeVaga(server, ctx);
  registrarConsultasDeCandidatura(server, ctx);
  registrarOperacoes(server, ctx);
  if (ctx.membro && ctx.ui !== "nao") registrarRecursoDoFormulario(server);
  if (ctx.membro) {
    registrarFormulario(server, ctx, formularioConvite);
    registrarFormulario(server, ctx, formularioAcesso);
    registrarFormulario(server, ctx, formularioArea);
    registrarFormulario(server, ctx, formularioPessoa);
    registrarFormulario(server, ctx, formularioConexoes);
    registrarFormulario(server, ctx, formularioVaga);
    registrarFormulario(server, ctx, formularioPublicarVaga);
    registrarFormulario(server, ctx, formularioPausarVaga);
    registrarFormulario(server, ctx, formularioEncerrarVaga);
    registrarFormulario(server, ctx, formularioPaginaDeCarreiras);
    registrarFormulario(server, ctx, formularioAdicionarCandidato);
    registrarFormulario(server, ctx, formularioAvaliacao);
    registrarFormulario(server, ctx, formularioDecisoes);
    registrarFormulario(server, ctx, formularioPropostas);
    registrarFormulario(server, ctx, formularioMensagem);
    registrarFormulario(server, ctx, formularioModelos);
    registrarFormulario(server, ctx, formularioRespostaRevisao);
    registrarFormulario(server, ctx, formularioConvidarParaVaga);
    registrarFormulario(server, ctx, formularioWebhooks);
  }
  return server;
}
