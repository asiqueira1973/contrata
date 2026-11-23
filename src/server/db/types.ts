// Gerado por `npm run db:types` (supabase gen types). Não editar à mão.
import "server-only";


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "rs_areas": {
                  Row: {
                    "arquivada_em": string | null,"atualizado_em": string,"criado_em": string,"empresa_id": string,"id": string,"nome": string,"responsavel_pessoa_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arquivada_em"?: string | null,"atualizado_em"?: string,"criado_em"?: string,"empresa_id": string,"id"?: string,"nome": string,"responsavel_pessoa_id"?: string | null
                  }
                  Update: {
                    "arquivada_em"?: string | null,"atualizado_em"?: string,"criado_em"?: string,"empresa_id"?: string,"id"?: string,"nome"?: string,"responsavel_pessoa_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_areas_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_areas_responsavel_fk"
      columns: ["responsavel_pessoa_id"]
isOneToOne: false
      referencedRelation: "rs_pessoas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_arquivos": {
                  Row: {
                    "bytes": number,"candidatura_id": string | null,"confirmado_em": string | null,"criado_em": string,"empresa_id": string,"extracao_status": Database["public"]['Enums']["rs_status_extracao"],"id": string,"mime": string,"nome_original": string,"path": string,"sha256": string | null,"texto_extraido": string | null,"tipo": Database["public"]['Enums']["rs_tipo_arquivo"]
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes": number,"candidatura_id"?: string | null,"confirmado_em"?: string | null,"criado_em"?: string,"empresa_id": string,"extracao_status"?: Database["public"]['Enums']["rs_status_extracao"],"id"?: string,"mime": string,"nome_original": string,"path": string,"sha256"?: string | null,"texto_extraido"?: string | null,"tipo": Database["public"]['Enums']["rs_tipo_arquivo"]
                  }
                  Update: {
                    "bytes"?: number,"candidatura_id"?: string | null,"confirmado_em"?: string | null,"criado_em"?: string,"empresa_id"?: string,"extracao_status"?: Database["public"]['Enums']["rs_status_extracao"],"id"?: string,"mime"?: string,"nome_original"?: string,"path"?: string,"sha256"?: string | null,"texto_extraido"?: string | null,"tipo"?: Database["public"]['Enums']["rs_tipo_arquivo"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_arquivos_candidatura_id_fkey"
      columns: ["candidatura_id"]
isOneToOne: false
      referencedRelation: "rs_candidaturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_arquivos_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_arquivos_a_apagar": {
                  Row: {
                    "criado_em": string,"empresa_id": string,"path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"empresa_id": string,"path": string
                  }
                  Update: {
                    "criado_em"?: string,"empresa_id"?: string,"path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_arquivos_a_apagar_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_avaliacoes": {
                  Row: {
                    "atualizado_em": string,"candidatura_id": string,"comentario": string,"criado_em": string,"etapa_id": string,"id": string,"membro_id": string,"recomendacao": Database["public"]['Enums']["rs_recomendacao"]
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"candidatura_id": string,"comentario": string,"criado_em"?: string,"etapa_id": string,"id"?: string,"membro_id": string,"recomendacao": Database["public"]['Enums']["rs_recomendacao"]
                  }
                  Update: {
                    "atualizado_em"?: string,"candidatura_id"?: string,"comentario"?: string,"criado_em"?: string,"etapa_id"?: string,"id"?: string,"membro_id"?: string,"recomendacao"?: Database["public"]['Enums']["rs_recomendacao"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_avaliacoes_candidatura_id_fkey"
      columns: ["candidatura_id"]
isOneToOne: false
      referencedRelation: "rs_candidaturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_avaliacoes_etapa_id_fkey"
      columns: ["etapa_id"]
isOneToOne: false
      referencedRelation: "rs_etapas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_avaliacoes_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_avisos_privacidade": {
                  Row: {
                    "criado_em": string,"empresa_id": string,"id": string,"texto_extra": string,"versao": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"empresa_id": string,"id"?: string,"texto_extra": string,"versao": string
                  }
                  Update: {
                    "criado_em"?: string,"empresa_id"?: string,"id"?: string,"texto_extra"?: string,"versao"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_avisos_privacidade_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_candidatos": {
                  Row: {
                    "anonimizado_em": string | null,"atualizado_em": string,"cidade": string | null,"criado_em": string,"email": string | null,"empresa_id": string,"id": string,"linkedin_url": string | null,"nome": string,"talentos_avisado_em": string | null,"talentos_consentido_em": string | null,"talentos_expira_em": string | null,"telefone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anonimizado_em"?: string | null,"atualizado_em"?: string,"cidade"?: string | null,"criado_em"?: string,"email"?: string | null,"empresa_id": string,"id"?: string,"linkedin_url"?: string | null,"nome": string,"talentos_avisado_em"?: string | null,"talentos_consentido_em"?: string | null,"talentos_expira_em"?: string | null,"telefone"?: string | null
                  }
                  Update: {
                    "anonimizado_em"?: string | null,"atualizado_em"?: string,"cidade"?: string | null,"criado_em"?: string,"email"?: string | null,"empresa_id"?: string,"id"?: string,"linkedin_url"?: string | null,"nome"?: string,"talentos_avisado_em"?: string | null,"talentos_consentido_em"?: string | null,"talentos_expira_em"?: string | null,"telefone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_candidatos_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_candidaturas": {
                  Row: {
                    "atualizado_em": string,"candidato_id": string,"consentimento_em": string,"consentimento_versao": string,"criado_em": string,"empresa_id": string,"encerrada_em": string | null,"etapa_id": string | null,"exclusao_codigo_hash": string | null,"exclusao_codigos_hora": number,"exclusao_expira_em": string | null,"exclusao_janela_desde": string | null,"exclusao_tentativas": number,"expurgada_em": string | null,"expurgar_em": string | null,"id": string,"link_versao": number,"motivo_reprovacao": Database["public"]['Enums']["rs_motivo_reprovacao"] | null,"movida_em": string,"origem": Database["public"]['Enums']["rs_origem_candidatura"],"recebida_em": string | null,"revisao_pedida_em": string | null,"revisao_respondida_em": string | null,"revisao_texto": string | null,"sinalizada": boolean,"situacao": Database["public"]['Enums']["rs_situacao_candidatura"],"talentos_pedido": boolean,"texto_busca": unknown,"token_hash": string,"vaga_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"candidato_id": string,"consentimento_em": string,"consentimento_versao": string,"criado_em"?: string,"empresa_id": string,"encerrada_em"?: string | null,"etapa_id"?: string | null,"exclusao_codigo_hash"?: string | null,"exclusao_codigos_hora"?: number,"exclusao_expira_em"?: string | null,"exclusao_janela_desde"?: string | null,"exclusao_tentativas"?: number,"expurgada_em"?: string | null,"expurgar_em"?: string | null,"id"?: string,"link_versao"?: number,"motivo_reprovacao"?: Database["public"]['Enums']["rs_motivo_reprovacao"] | null,"movida_em"?: string,"origem": Database["public"]['Enums']["rs_origem_candidatura"],"recebida_em"?: string | null,"revisao_pedida_em"?: string | null,"revisao_respondida_em"?: string | null,"revisao_texto"?: string | null,"sinalizada"?: boolean,"situacao"?: Database["public"]['Enums']["rs_situacao_candidatura"],"talentos_pedido"?: boolean,"texto_busca"?: unknown,"token_hash": string,"vaga_id": string
                  }
                  Update: {
                    "atualizado_em"?: string,"candidato_id"?: string,"consentimento_em"?: string,"consentimento_versao"?: string,"criado_em"?: string,"empresa_id"?: string,"encerrada_em"?: string | null,"etapa_id"?: string | null,"exclusao_codigo_hash"?: string | null,"exclusao_codigos_hora"?: number,"exclusao_expira_em"?: string | null,"exclusao_janela_desde"?: string | null,"exclusao_tentativas"?: number,"expurgada_em"?: string | null,"expurgar_em"?: string | null,"id"?: string,"link_versao"?: number,"motivo_reprovacao"?: Database["public"]['Enums']["rs_motivo_reprovacao"] | null,"movida_em"?: string,"origem"?: Database["public"]['Enums']["rs_origem_candidatura"],"recebida_em"?: string | null,"revisao_pedida_em"?: string | null,"revisao_respondida_em"?: string | null,"revisao_texto"?: string | null,"sinalizada"?: boolean,"situacao"?: Database["public"]['Enums']["rs_situacao_candidatura"],"talentos_pedido"?: boolean,"texto_busca"?: unknown,"token_hash"?: string,"vaga_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_candidaturas_candidato_id_fkey"
      columns: ["candidato_id"]
isOneToOne: false
      referencedRelation: "rs_candidatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_candidaturas_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_candidaturas_etapa_id_fkey"
      columns: ["etapa_id"]
isOneToOne: false
      referencedRelation: "rs_etapas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_candidaturas_vaga_id_fkey"
      columns: ["vaga_id"]
isOneToOne: false
      referencedRelation: "rs_vagas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_convites_talento": {
                  Row: {
                    "ator_tipo": Database["public"]['Enums']["rs_tipo_ator"],"candidato_id": string,"credencial_id": string | null,"criado_em": string,"empresa_id": string,"expira_em": string,"id": string,"membro_id": string | null,"usado_em": string | null,"vaga_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ator_tipo": Database["public"]['Enums']["rs_tipo_ator"],"candidato_id": string,"credencial_id"?: string | null,"criado_em"?: string,"empresa_id": string,"expira_em"?: string,"id"?: string,"membro_id"?: string | null,"usado_em"?: string | null,"vaga_id": string
                  }
                  Update: {
                    "ator_tipo"?: Database["public"]['Enums']["rs_tipo_ator"],"candidato_id"?: string,"credencial_id"?: string | null,"criado_em"?: string,"empresa_id"?: string,"expira_em"?: string,"id"?: string,"membro_id"?: string | null,"usado_em"?: string | null,"vaga_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_convites_talento_candidato_id_fkey"
      columns: ["candidato_id"]
isOneToOne: false
      referencedRelation: "rs_candidatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_convites_talento_credencial_id_fkey"
      columns: ["credencial_id"]
isOneToOne: false
      referencedRelation: "rs_credenciais"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_convites_talento_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_convites_talento_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_convites_talento_vaga_id_fkey"
      columns: ["vaga_id"]
isOneToOne: false
      referencedRelation: "rs_vagas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_credenciais": {
                  Row: {
                    "criada_por_membro_id": string,"criado_em": string,"empresa_id": string,"escopos": (Database["public"]['Enums']["rs_escopo"])[],"id": string,"membro_id": string | null,"nome": string,"oauth_cliente_id": string | null,"prefixo": string,"revogada_em": string | null,"tipo": Database["public"]['Enums']["rs_tipo_credencial"],"ultimo_uso_em": string | null,"valor_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criada_por_membro_id": string,"criado_em"?: string,"empresa_id": string,"escopos": (Database["public"]['Enums']["rs_escopo"])[],"id"?: string,"membro_id"?: string | null,"nome": string,"oauth_cliente_id"?: string | null,"prefixo": string,"revogada_em"?: string | null,"tipo": Database["public"]['Enums']["rs_tipo_credencial"],"ultimo_uso_em"?: string | null,"valor_hash": string
                  }
                  Update: {
                    "criada_por_membro_id"?: string,"criado_em"?: string,"empresa_id"?: string,"escopos"?: (Database["public"]['Enums']["rs_escopo"])[],"id"?: string,"membro_id"?: string | null,"nome"?: string,"oauth_cliente_id"?: string | null,"prefixo"?: string,"revogada_em"?: string | null,"tipo"?: Database["public"]['Enums']["rs_tipo_credencial"],"ultimo_uso_em"?: string | null,"valor_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_credenciais_criada_por_membro_id_fkey"
      columns: ["criada_por_membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_credenciais_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_credenciais_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_credenciais_oauth_cliente_id_fkey"
      columns: ["oauth_cliente_id"]
isOneToOne: false
      referencedRelation: "rs_oauth_clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_decisoes": {
                  Row: {
                    "candidatura_id": string | null,"credencial_id": string,"criado_em": string,"decidida_em": string | null,"decidida_por_membro_id": string | null,"empresa_id": string,"expira_em": string,"id": string,"justificativa": string | null,"payload": NonNullable<Json>,"proposta_por_membro_id": string | null,"proposta_por_tipo": Database["public"]['Enums']["rs_tipo_ator"],"status": Database["public"]['Enums']["rs_status_decisao"],"tipo": Database["public"]['Enums']["rs_tipo_decisao"],"vaga_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "candidatura_id"?: string | null,"credencial_id": string,"criado_em"?: string,"decidida_em"?: string | null,"decidida_por_membro_id"?: string | null,"empresa_id": string,"expira_em"?: string,"id"?: string,"justificativa"?: string | null,"payload": NonNullable<Json>,"proposta_por_membro_id"?: string | null,"proposta_por_tipo": Database["public"]['Enums']["rs_tipo_ator"],"status"?: Database["public"]['Enums']["rs_status_decisao"],"tipo": Database["public"]['Enums']["rs_tipo_decisao"],"vaga_id"?: string | null
                  }
                  Update: {
                    "candidatura_id"?: string | null,"credencial_id"?: string,"criado_em"?: string,"decidida_em"?: string | null,"decidida_por_membro_id"?: string | null,"empresa_id"?: string,"expira_em"?: string,"id"?: string,"justificativa"?: string | null,"payload"?: NonNullable<Json>,"proposta_por_membro_id"?: string | null,"proposta_por_tipo"?: Database["public"]['Enums']["rs_tipo_ator"],"status"?: Database["public"]['Enums']["rs_status_decisao"],"tipo"?: Database["public"]['Enums']["rs_tipo_decisao"],"vaga_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_decisoes_candidatura_id_fkey"
      columns: ["candidatura_id"]
isOneToOne: false
      referencedRelation: "rs_candidaturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_decisoes_credencial_id_fkey"
      columns: ["credencial_id"]
isOneToOne: false
      referencedRelation: "rs_credenciais"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_decisoes_decidida_por_membro_id_fkey"
      columns: ["decidida_por_membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_decisoes_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_decisoes_proposta_por_membro_id_fkey"
      columns: ["proposta_por_membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_decisoes_vaga_id_fkey"
      columns: ["vaga_id"]
isOneToOne: false
      referencedRelation: "rs_vagas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_empresas": {
                  Row: {
                    "atualizado_em": string,"aviso_privacidade_extra": string | null,"cor_destaque": string | null,"criada_por_usuario_id": string,"criado_em": string,"descricao": string | null,"email_contato": string,"excluida_em": string | null,"id": string,"logo_path": string | null,"mensagens_agente": Database["public"]['Enums']["rs_mensagens_agente"],"nome": string,"pagina_publicada": boolean,"retencao_dias": number,"site_url": string | null,"slug": string,"suspensa_em": string | null,"talentos_meses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"aviso_privacidade_extra"?: string | null,"cor_destaque"?: string | null,"criada_por_usuario_id": string,"criado_em"?: string,"descricao"?: string | null,"email_contato": string,"excluida_em"?: string | null,"id"?: string,"logo_path"?: string | null,"mensagens_agente"?: Database["public"]['Enums']["rs_mensagens_agente"],"nome": string,"pagina_publicada"?: boolean,"retencao_dias"?: number,"site_url"?: string | null,"slug": string,"suspensa_em"?: string | null,"talentos_meses"?: number
                  }
                  Update: {
                    "atualizado_em"?: string,"aviso_privacidade_extra"?: string | null,"cor_destaque"?: string | null,"criada_por_usuario_id"?: string,"criado_em"?: string,"descricao"?: string | null,"email_contato"?: string,"excluida_em"?: string | null,"id"?: string,"logo_path"?: string | null,"mensagens_agente"?: Database["public"]['Enums']["rs_mensagens_agente"],"nome"?: string,"pagina_publicada"?: boolean,"retencao_dias"?: number,"site_url"?: string | null,"slug"?: string,"suspensa_em"?: string | null,"talentos_meses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_empresas_criada_por_usuario_id_fkey"
      columns: ["criada_por_usuario_id"]
isOneToOne: false
      referencedRelation: "rs_usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_entregas_webhook": {
                  Row: {
                    "corpo": NonNullable<Json>,"criado_em": string,"empresa_id": string,"entregue_em": string | null,"evento_id": number,"id": string,"proxima_tentativa_em": string,"reservada_em": string | null,"status": Database["public"]['Enums']["rs_status_entrega"],"tentativas": number,"tipo": string,"ultimo_status_http": number | null,"webhook_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "corpo": NonNullable<Json>,"criado_em"?: string,"empresa_id": string,"entregue_em"?: string | null,"evento_id": number,"id"?: string,"proxima_tentativa_em"?: string,"reservada_em"?: string | null,"status"?: Database["public"]['Enums']["rs_status_entrega"],"tentativas"?: number,"tipo": string,"ultimo_status_http"?: number | null,"webhook_id": string
                  }
                  Update: {
                    "corpo"?: NonNullable<Json>,"criado_em"?: string,"empresa_id"?: string,"entregue_em"?: string | null,"evento_id"?: number,"id"?: string,"proxima_tentativa_em"?: string,"reservada_em"?: string | null,"status"?: Database["public"]['Enums']["rs_status_entrega"],"tentativas"?: number,"tipo"?: string,"ultimo_status_http"?: number | null,"webhook_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_entregas_webhook_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_entregas_webhook_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "rs_eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_entregas_webhook_webhook_id_fkey"
      columns: ["webhook_id"]
isOneToOne: false
      referencedRelation: "rs_webhooks"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_etapas": {
                  Row: {
                    "id": string,"nome": string,"ordem": number,"tipo": Database["public"]['Enums']["rs_tipo_etapa"],"vaga_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"nome": string,"ordem": number,"tipo": Database["public"]['Enums']["rs_tipo_etapa"],"vaga_id": string
                  }
                  Update: {
                    "id"?: string,"nome"?: string,"ordem"?: number,"tipo"?: Database["public"]['Enums']["rs_tipo_etapa"],"vaga_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_etapas_vaga_id_fkey"
      columns: ["vaga_id"]
isOneToOne: false
      referencedRelation: "rs_vagas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_eventos": {
                  Row: {
                    "ator_tipo": Database["public"]['Enums']["rs_tipo_ator"],"autorizado_por_membro_id": string | null,"candidatura_id": string | null,"credencial_id": string | null,"criado_em": string,"dados": NonNullable<Json>,"empresa_id": string,"id": number,"membro_id": string | null,"origem": Database["public"]['Enums']["rs_origem_evento"],"tipo": string,"vaga_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ator_tipo": Database["public"]['Enums']["rs_tipo_ator"],"autorizado_por_membro_id"?: string | null,"candidatura_id"?: string | null,"credencial_id"?: string | null,"criado_em"?: string,"dados"?: NonNullable<Json>,"empresa_id": string,"id"?: never,"membro_id"?: string | null,"origem": Database["public"]['Enums']["rs_origem_evento"],"tipo": string,"vaga_id"?: string | null
                  }
                  Update: {
                    "ator_tipo"?: Database["public"]['Enums']["rs_tipo_ator"],"autorizado_por_membro_id"?: string | null,"candidatura_id"?: string | null,"credencial_id"?: string | null,"criado_em"?: string,"dados"?: NonNullable<Json>,"empresa_id"?: string,"id"?: never,"membro_id"?: string | null,"origem"?: Database["public"]['Enums']["rs_origem_evento"],"tipo"?: string,"vaga_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_eventos_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_membro_areas": {
                  Row: {
                    "area_id": string,"criado_em": string,"membro_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": string,"criado_em"?: string,"membro_id": string
                  }
                  Update: {
                    "area_id"?: string,"criado_em"?: string,"membro_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_membro_areas_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "rs_areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_membro_areas_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_membros": {
                  Row: {
                    "aceito_em": string | null,"convidado_por_membro_id": string | null,"convite_expira_em": string | null,"convite_token_hash": string | null,"criado_em": string,"email": string,"empresa_id": string,"id": string,"link_agenda": string | null,"papel": Database["public"]['Enums']["rs_papel_membro"],"removido_em": string | null,"todas_areas": boolean,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aceito_em"?: string | null,"convidado_por_membro_id"?: string | null,"convite_expira_em"?: string | null,"convite_token_hash"?: string | null,"criado_em"?: string,"email": string,"empresa_id": string,"id"?: string,"link_agenda"?: string | null,"papel": Database["public"]['Enums']["rs_papel_membro"],"removido_em"?: string | null,"todas_areas"?: boolean,"usuario_id"?: string | null
                  }
                  Update: {
                    "aceito_em"?: string | null,"convidado_por_membro_id"?: string | null,"convite_expira_em"?: string | null,"convite_token_hash"?: string | null,"criado_em"?: string,"email"?: string,"empresa_id"?: string,"id"?: string,"link_agenda"?: string | null,"papel"?: Database["public"]['Enums']["rs_papel_membro"],"removido_em"?: string | null,"todas_areas"?: boolean,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_membros_convidado_por_membro_id_fkey"
      columns: ["convidado_por_membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_membros_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_membros_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "rs_usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_mensagens": {
                  Row: {
                    "assunto": string,"ator_tipo": Database["public"]['Enums']["rs_tipo_ator"],"candidatura_id": string,"corpo": string,"credencial_id": string | null,"criado_em": string,"decisao_id": string | null,"empresa_id": string,"id": string,"membro_id": string | null,"notificacao_id": string | null,"tipo": Database["public"]['Enums']["rs_tipo_mensagem"]
                  }
                  ComputedFields: never
                  Insert: {
                    "assunto": string,"ator_tipo": Database["public"]['Enums']["rs_tipo_ator"],"candidatura_id": string,"corpo": string,"credencial_id"?: string | null,"criado_em"?: string,"decisao_id"?: string | null,"empresa_id": string,"id"?: string,"membro_id"?: string | null,"notificacao_id"?: string | null,"tipo": Database["public"]['Enums']["rs_tipo_mensagem"]
                  }
                  Update: {
                    "assunto"?: string,"ator_tipo"?: Database["public"]['Enums']["rs_tipo_ator"],"candidatura_id"?: string,"corpo"?: string,"credencial_id"?: string | null,"criado_em"?: string,"decisao_id"?: string | null,"empresa_id"?: string,"id"?: string,"membro_id"?: string | null,"notificacao_id"?: string | null,"tipo"?: Database["public"]['Enums']["rs_tipo_mensagem"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_mensagens_candidatura_id_fkey"
      columns: ["candidatura_id"]
isOneToOne: false
      referencedRelation: "rs_candidaturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_mensagens_credencial_id_fkey"
      columns: ["credencial_id"]
isOneToOne: false
      referencedRelation: "rs_credenciais"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_mensagens_decisao_id_fkey"
      columns: ["decisao_id"]
isOneToOne: false
      referencedRelation: "rs_decisoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_mensagens_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_mensagens_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_mensagens_notificacao_id_fkey"
      columns: ["notificacao_id"]
isOneToOne: false
      referencedRelation: "rs_notificacoes"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_modelos_mensagem": {
                  Row: {
                    "assunto": string,"atualizado_em": string,"chave": string,"corpo": string,"empresa_id": string,"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assunto": string,"atualizado_em"?: string,"chave": string,"corpo": string,"empresa_id": string,"id"?: string,"nome": string
                  }
                  Update: {
                    "assunto"?: string,"atualizado_em"?: string,"chave"?: string,"corpo"?: string,"empresa_id"?: string,"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_modelos_mensagem_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_notas": {
                  Row: {
                    "ator_tipo": Database["public"]['Enums']["rs_tipo_ator"],"candidatura_id": string,"credencial_id": string | null,"criado_em": string,"id": string,"membro_id": string | null,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ator_tipo": Database["public"]['Enums']["rs_tipo_ator"],"candidatura_id": string,"credencial_id"?: string | null,"criado_em"?: string,"id"?: string,"membro_id"?: string | null,"texto": string
                  }
                  Update: {
                    "ator_tipo"?: Database["public"]['Enums']["rs_tipo_ator"],"candidatura_id"?: string,"credencial_id"?: string | null,"criado_em"?: string,"id"?: string,"membro_id"?: string | null,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_notas_candidatura_id_fkey"
      columns: ["candidatura_id"]
isOneToOne: false
      referencedRelation: "rs_candidaturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_notas_credencial_id_fkey"
      columns: ["credencial_id"]
isOneToOne: false
      referencedRelation: "rs_credenciais"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_notas_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_notificacoes": {
                  Row: {
                    "assunto": string,"candidatura_id": string | null,"chave_idempotencia": string,"criado_em": string,"destinatario": string,"empresa_id": string | null,"enviada_em": string | null,"enviar_apos": string,"html": string,"id": string,"remetente_nome": string | null,"reply_to": string | null,"resend_id": string | null,"status": Database["public"]['Enums']["rs_status_notificacao"],"tentativas": number,"texto": string,"tipo": Database["public"]['Enums']["rs_tipo_notificacao"],"ultimo_erro": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assunto": string,"candidatura_id"?: string | null,"chave_idempotencia": string,"criado_em"?: string,"destinatario": string,"empresa_id"?: string | null,"enviada_em"?: string | null,"enviar_apos"?: string,"html": string,"id"?: string,"remetente_nome"?: string | null,"reply_to"?: string | null,"resend_id"?: string | null,"status"?: Database["public"]['Enums']["rs_status_notificacao"],"tentativas"?: number,"texto": string,"tipo": Database["public"]['Enums']["rs_tipo_notificacao"],"ultimo_erro"?: string | null
                  }
                  Update: {
                    "assunto"?: string,"candidatura_id"?: string | null,"chave_idempotencia"?: string,"criado_em"?: string,"destinatario"?: string,"empresa_id"?: string | null,"enviada_em"?: string | null,"enviar_apos"?: string,"html"?: string,"id"?: string,"remetente_nome"?: string | null,"reply_to"?: string | null,"resend_id"?: string | null,"status"?: Database["public"]['Enums']["rs_status_notificacao"],"tentativas"?: number,"texto"?: string,"tipo"?: Database["public"]['Enums']["rs_tipo_notificacao"],"ultimo_erro"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_notificacoes_candidatura_id_fkey"
      columns: ["candidatura_id"]
isOneToOne: false
      referencedRelation: "rs_candidaturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_notificacoes_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_oauth_clientes": {
                  Row: {
                    "criado_em": string,"id": string,"nome": string,"redirect_uris": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"id"?: string,"nome"?: string,"redirect_uris": (string)[]
                  }
                  Update: {
                    "criado_em"?: string,"id"?: string,"nome"?: string,"redirect_uris"?: (string)[]
                  }
                  Relationships: [
                    
                  ]
                },"rs_oauth_codigos": {
                  Row: {
                    "cliente_id": string,"code_challenge": string,"codigo_hash": string,"credencial_id": string | null,"criado_em": string,"empresa_id": string,"escopos": (Database["public"]['Enums']["rs_escopo"])[],"expira_em": string,"membro_id": string,"redirect_uri": string,"usado_em": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": string,"code_challenge": string,"codigo_hash": string,"credencial_id"?: string | null,"criado_em"?: string,"empresa_id": string,"escopos": (Database["public"]['Enums']["rs_escopo"])[],"expira_em"?: string,"membro_id": string,"redirect_uri": string,"usado_em"?: string | null
                  }
                  Update: {
                    "cliente_id"?: string,"code_challenge"?: string,"codigo_hash"?: string,"credencial_id"?: string | null,"criado_em"?: string,"empresa_id"?: string,"escopos"?: (Database["public"]['Enums']["rs_escopo"])[],"expira_em"?: string,"membro_id"?: string,"redirect_uri"?: string,"usado_em"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_oauth_codigos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "rs_oauth_clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_oauth_codigos_credencial_id_fkey"
      columns: ["credencial_id"]
isOneToOne: false
      referencedRelation: "rs_credenciais"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_oauth_codigos_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_oauth_codigos_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_perguntas": {
                  Row: {
                    "id": string,"obrigatoria": boolean,"opcoes": (string)[] | null,"ordem": number,"resposta_esperada": string | null,"texto": string,"tipo": Database["public"]['Enums']["rs_tipo_pergunta"],"vaga_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"obrigatoria"?: boolean,"opcoes"?: (string)[] | null,"ordem": number,"resposta_esperada"?: string | null,"texto": string,"tipo": Database["public"]['Enums']["rs_tipo_pergunta"],"vaga_id": string
                  }
                  Update: {
                    "id"?: string,"obrigatoria"?: boolean,"opcoes"?: (string)[] | null,"ordem"?: number,"resposta_esperada"?: string | null,"texto"?: string,"tipo"?: Database["public"]['Enums']["rs_tipo_pergunta"],"vaga_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_perguntas_vaga_id_fkey"
      columns: ["vaga_id"]
isOneToOne: false
      referencedRelation: "rs_vagas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_pessoas": {
                  Row: {
                    "area_id": string | null,"arquivada_em": string | null,"atualizado_em": string,"cargo": string | null,"criado_em": string,"email": string,"empresa_id": string,"id": string,"membro_id": string | null,"nome": string,"recebe_resumo": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: string | null,"arquivada_em"?: string | null,"atualizado_em"?: string,"cargo"?: string | null,"criado_em"?: string,"email": string,"empresa_id": string,"id"?: string,"membro_id"?: string | null,"nome": string,"recebe_resumo"?: boolean
                  }
                  Update: {
                    "area_id"?: string | null,"arquivada_em"?: string | null,"atualizado_em"?: string,"cargo"?: string | null,"criado_em"?: string,"email"?: string,"empresa_id"?: string,"id"?: string,"membro_id"?: string | null,"nome"?: string,"recebe_resumo"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_pessoas_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "rs_areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_pessoas_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_pessoas_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: true
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_respostas": {
                  Row: {
                    "candidatura_id": string,"criado_em": string,"pergunta_id": string,"valor": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidatura_id": string,"criado_em"?: string,"pergunta_id": string,"valor": string
                  }
                  Update: {
                    "candidatura_id"?: string,"criado_em"?: string,"pergunta_id"?: string,"valor"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_respostas_candidatura_id_fkey"
      columns: ["candidatura_id"]
isOneToOne: false
      referencedRelation: "rs_candidaturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_respostas_pergunta_id_fkey"
      columns: ["pergunta_id"]
isOneToOne: false
      referencedRelation: "rs_perguntas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_tentativas_publicas": {
                  Row: {
                    "chave_hash": string,"criado_em": string,"id": number,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chave_hash": string,"criado_em"?: string,"id"?: never,"tipo": string
                  }
                  Update: {
                    "chave_hash"?: string,"criado_em"?: string,"id"?: never,"tipo"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rs_usuarios": {
                  Row: {
                    "criado_em": string,"email": string,"foto_url": string | null,"google_sub": string,"id": string,"nome": string,"suspenso_em": string | null,"termos_aceitos_em": string | null,"ultimo_acesso_em": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"email": string,"foto_url"?: string | null,"google_sub": string,"id"?: string,"nome": string,"suspenso_em"?: string | null,"termos_aceitos_em"?: string | null,"ultimo_acesso_em"?: string | null
                  }
                  Update: {
                    "criado_em"?: string,"email"?: string,"foto_url"?: string | null,"google_sub"?: string,"id"?: string,"nome"?: string,"suspenso_em"?: string | null,"termos_aceitos_em"?: string | null,"ultimo_acesso_em"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"rs_vaga_equipe": {
                  Row: {
                    "criado_em": string,"membro_id": string,"papel_na_vaga": Database["public"]['Enums']["rs_papel_na_vaga"],"vaga_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"membro_id": string,"papel_na_vaga": Database["public"]['Enums']["rs_papel_na_vaga"],"vaga_id": string
                  }
                  Update: {
                    "criado_em"?: string,"membro_id"?: string,"papel_na_vaga"?: Database["public"]['Enums']["rs_papel_na_vaga"],"vaga_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_vaga_equipe_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: false
      referencedRelation: "rs_membros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_vaga_equipe_vaga_id_fkey"
      columns: ["vaga_id"]
isOneToOne: false
      referencedRelation: "rs_vagas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_vagas": {
                  Row: {
                    "area_id": string | null,"atualizado_em": string,"chave_idempotencia": string | null,"cidade": string | null,"criado_em": string,"curriculo_obrigatorio": boolean,"descricao": string,"dono_pessoa_id": string | null,"empresa_id": string,"encerra_em": string | null,"encerrada_em": string | null,"id": string,"modelo_trabalho": Database["public"]['Enums']["rs_modelo_trabalho"],"mostrar_salario": boolean,"motivo_encerramento": Database["public"]['Enums']["rs_motivo_encerramento_vaga"] | null,"publicada_em": string | null,"regime": Database["public"]['Enums']["rs_regime"],"requisitos": string | null,"salario_max": number | null,"salario_min": number | null,"salario_periodo": string | null,"slug": string,"status": Database["public"]['Enums']["rs_status_vaga"],"titulo": string,"uf": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: string | null,"atualizado_em"?: string,"chave_idempotencia"?: string | null,"cidade"?: string | null,"criado_em"?: string,"curriculo_obrigatorio"?: boolean,"descricao"?: string,"dono_pessoa_id"?: string | null,"empresa_id": string,"encerra_em"?: string | null,"encerrada_em"?: string | null,"id"?: string,"modelo_trabalho"?: Database["public"]['Enums']["rs_modelo_trabalho"],"mostrar_salario"?: boolean,"motivo_encerramento"?: Database["public"]['Enums']["rs_motivo_encerramento_vaga"] | null,"publicada_em"?: string | null,"regime"?: Database["public"]['Enums']["rs_regime"],"requisitos"?: string | null,"salario_max"?: number | null,"salario_min"?: number | null,"salario_periodo"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["rs_status_vaga"],"titulo": string,"uf"?: string | null
                  }
                  Update: {
                    "area_id"?: string | null,"atualizado_em"?: string,"chave_idempotencia"?: string | null,"cidade"?: string | null,"criado_em"?: string,"curriculo_obrigatorio"?: boolean,"descricao"?: string,"dono_pessoa_id"?: string | null,"empresa_id"?: string,"encerra_em"?: string | null,"encerrada_em"?: string | null,"id"?: string,"modelo_trabalho"?: Database["public"]['Enums']["rs_modelo_trabalho"],"mostrar_salario"?: boolean,"motivo_encerramento"?: Database["public"]['Enums']["rs_motivo_encerramento_vaga"] | null,"publicada_em"?: string | null,"regime"?: Database["public"]['Enums']["rs_regime"],"requisitos"?: string | null,"salario_max"?: number | null,"salario_min"?: number | null,"salario_periodo"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["rs_status_vaga"],"titulo"?: string,"uf"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_vagas_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "rs_areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_vagas_dono_pessoa_id_fkey"
      columns: ["dono_pessoa_id"]
isOneToOne: false
      referencedRelation: "rs_pessoas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rs_vagas_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"rs_webhooks": {
                  Row: {
                    "ativo": boolean,"criado_em": string,"empresa_id": string,"eventos": (string)[],"id": string,"segredo_cifrado": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"criado_em"?: string,"empresa_id": string,"eventos": (string)[],"id"?: string,"segredo_cifrado": string,"url": string
                  }
                  Update: {
                    "ativo"?: boolean,"criado_em"?: string,"empresa_id"?: string,"eventos"?: (string)[],"id"?: string,"segredo_cifrado"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rs_webhooks_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "rs_empresas"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "rs_fn_aceita_convite":
{ Args: { "p_membro": string,"p_usuario": string }; Returns: boolean
                           },
"rs_fn_adiciona_nota":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_candidatura": string,"p_empresa": string,"p_texto": string }; Returns: string
                           },
"rs_fn_alvo_da_decisao":
{ Args: { "p_alcance": Json,"p_candidatura": string,"p_empresa": string,"p_tipo": Database["public"]['Enums']["rs_tipo_decisao"],"p_vaga": string }; Returns: string
                           },
"rs_fn_anonimiza_candidatura":
{ Args: { "p_candidatura": string,"p_empresa": string,"p_manter_curriculo"?: boolean,"p_origem"?: Database["public"]['Enums']["rs_origem_evento"] }; Returns: (string)[]
                           },
"rs_fn_area_no_alcance":
{ Args: { "p_alcance": Json,"p_area": string }; Returns: boolean
                           },
"rs_fn_arquiva_area":
{ Args: { "p_area": string,"p_ator": Json,"p_empresa": string }; Returns: undefined
                           },
"rs_fn_arquiva_pessoa":
{ Args: { "p_ator": Json,"p_empresa": string,"p_pessoa": string }; Returns: undefined
                           },
"rs_fn_atualiza_busca":
{ Args: { "p_candidatura": string }; Returns: undefined
                           },
"rs_fn_busca_talentos":
{ Args: { "p_alcance": Json,"p_empresa": string,"p_filtros": Json,"p_inicio": number,"p_limite": number }; Returns: {
              "candidato_id": string,"cidade": string,"linkedin_url": string,"nome": string,"relevancia": number,"talentos_expira_em": string
            }[]
                           },
"rs_fn_cancela_convite":
{ Args: { "p_ator": Json,"p_membro": string }; Returns: undefined
                           },
"rs_fn_conclui_candidatura":
{ Args: { "p_arquivo": Json,"p_ator": Json,"p_candidatura": string,"p_empresa": string,"p_mensagem": Json,"p_notificacao": Json,"p_token_hash": string }; Returns: Json
                           },
"rs_fn_confere_vaga":
{ Args: { "p_alcance": Json,"p_area": string,"p_dono": string,"p_empresa": string }; Returns: undefined
                           },
"rs_fn_confirma_decisao":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_decisao": string,"p_empresa": string,"p_mensagens": Json,"p_payload": Json }; Returns: Json
                           },
"rs_fn_conta_tentativa":
{ Args: { "p_chave": string,"p_janela_s": number,"p_limite": number,"p_tipo": string }; Returns: boolean
                           },
"rs_fn_convida_membro":
{ Args: { "p_areas": (string)[],"p_ator": Json,"p_email": string,"p_empresa": string,"p_expira_em": string,"p_max_pendentes": number,"p_papel": Database["public"]['Enums']["rs_papel_membro"],"p_todas_areas": boolean,"p_token_hash": string }; Returns: string
                           },
"rs_fn_convida_talento":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_candidato": string,"p_empresa": string,"p_vaga": string }; Returns: Json
                           },
"rs_fn_corpo_webhook":
{ Args: { "p_evento": Omit<Database["public"]['Tables']["rs_eventos"]['Row'], Database["public"]['Tables']["rs_eventos"]['ComputedFields']>,"p_tipo": string }; Returns: Json
                           },
"rs_fn_cria_candidatura":
{ Args: { "p_ator": Json,"p_candidato": Json,"p_consentimento": string,"p_convite"?: string,"p_empresa": string,"p_max_por_vaga": number,"p_origem": Database["public"]['Enums']["rs_origem_candidatura"],"p_respostas": Json,"p_talentos": boolean,"p_token_hash": string,"p_vaga": string }; Returns: Json
                           },
"rs_fn_cria_chave_api":
{ Args: { "p_ator": Json,"p_empresa": string,"p_escopos": (Database["public"]['Enums']["rs_escopo"])[],"p_max_ativas": number,"p_nome": string,"p_prefixo": string,"p_valor_hash": string }; Returns: string
                           },
"rs_fn_cria_codigo_oauth":
{ Args: { "p_cliente": string,"p_code_challenge": string,"p_codigo_hash": string,"p_empresa": string,"p_escopos": (Database["public"]['Enums']["rs_escopo"])[],"p_membro": string,"p_redirect_uri": string,"p_validade_s": number }; Returns: undefined
                           },
"rs_fn_cria_empresa":
{ Args: { "p_email_contato": string,"p_max_criadas"?: number,"p_nome": string,"p_slug": string,"p_usuario": string }; Returns: string
                           },
"rs_fn_cria_vaga":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_chave"?: string,"p_dados": Json,"p_empresa": string }; Returns: Json
                           },
"rs_fn_da_acesso":
{ Args: { "p_areas": (string)[],"p_ator": Json,"p_empresa": string,"p_expira_em": string,"p_max_pendentes": number,"p_papel": Database["public"]['Enums']["rs_papel_membro"],"p_pessoa": string,"p_todas_areas": boolean,"p_token_hash": string }; Returns: string
                           },
"rs_fn_decide":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_candidatura": string,"p_empresa": string,"p_mensagens": Json,"p_payload": Json,"p_tipo": Database["public"]['Enums']["rs_tipo_decisao"],"p_vaga": string }; Returns: number
                           },
"rs_fn_descarta_decisao":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_decisao": string,"p_empresa": string,"p_motivo": string }; Returns: undefined
                           },
"rs_fn_desfaz_exclusao":
{ Args: { "p_ator": Json,"p_empresa": string }; Returns: undefined
                           },
"rs_fn_desiste_entregas":
{ Args: { "p_desiste": string,"p_max": number }; Returns: number
                           },
"rs_fn_empresas_a_expurgar":
{ Args: { "p_lote": number }; Returns: string[]
                           },
"rs_fn_encerra_candidatura":
{ Args: { "p_ator": Json,"p_candidatura": string,"p_dados"?: Json,"p_empresa": string,"p_mensagem": Json,"p_motivo": Database["public"]['Enums']["rs_motivo_reprovacao"],"p_situacao": Database["public"]['Enums']["rs_situacao_candidatura"] }; Returns: Json
                           },
"rs_fn_entra_usuario":
{ Args: { "p_email": string,"p_foto": string,"p_google_sub": string,"p_nome": string }; Returns: Json
                           },
"rs_fn_entregas_vencidas":
{ Args: { "p_empresa": string,"p_lote": number,"p_max": number }; Returns: string[]
                           },
"rs_fn_envia_mensagem":
{ Args: { "p_ator": Json,"p_candidatura": string,"p_cota": number,"p_decisao": string,"p_empresa": string,"p_mensagem": Json,"p_tipo": Database["public"]['Enums']["rs_tipo_mensagem"] }; Returns: string
                           },
"rs_fn_exclui_dados_candidato":
{ Args: { "p_candidatura": string,"p_empresa": string }; Returns: (string)[]
                           },
"rs_fn_exclui_empresa":
{ Args: { "p_ator": Json,"p_empresa": string,"p_slug": string }; Returns: Json
                           },
"rs_fn_executa_decisao":
{ Args: { "p_ator": Json,"p_candidatura": string,"p_decisao": string,"p_empresa": string,"p_mensagens": Json,"p_payload": Json,"p_tipo": Database["public"]['Enums']["rs_tipo_decisao"],"p_vaga": string }; Returns: number
                           },
"rs_fn_exige_administrador":
{ Args: { "p_ator": Json,"p_empresa": string }; Returns: undefined
                           },
"rs_fn_expurga_empresa":
{ Args: { "p_empresa": string }; Returns: undefined
                           },
"rs_fn_faxina_candidaturas_abandonadas":
{ Args: { "p_lote": number }; Returns: (string)[]
                           },
"rs_fn_faxina_convites":
{ Args: { "p_lote": number }; Returns: number
                           },
"rs_fn_faxina_decisoes":
{ Args: { "p_lote": number }; Returns: number
                           },
"rs_fn_faxina_expurgos":
{ Args: { "p_lote": number }; Returns: Json
                           },
"rs_fn_faxina_talentos":
{ Args: { "p_lote": number }; Returns: Json
                           },
"rs_fn_faxina_vagas_vencidas":
{ Args: { "p_lote": number }; Returns: number
                           },
"rs_fn_garante_administrador":
{ Args: { "p_membro": string }; Returns: undefined
                           },
"rs_fn_grava_equipe":
{ Args: { "p_empresa": string,"p_equipe": Json,"p_vaga": string }; Returns: undefined
                           },
"rs_fn_grava_etapas":
{ Args: { "p_etapas": Json,"p_vaga": string }; Returns: undefined
                           },
"rs_fn_grava_extracao":
{ Args: { "p_arquivo": string,"p_status": Database["public"]['Enums']["rs_status_extracao"],"p_texto": string }; Returns: undefined
                           },
"rs_fn_grava_perguntas":
{ Args: { "p_perguntas": Json,"p_vaga": string }; Returns: undefined
                           },
"rs_fn_limpa_notificacoes":
{ Args: { "p_dias": number,"p_lote": number }; Returns: number
                           },
"rs_fn_lista_candidaturas":
{ Args: { "p_alcance": Json,"p_empresa": string,"p_filtros": Json,"p_inicio": number,"p_limite": number }; Returns: {
              "atualizado_em": string,"encerrada_em": string,"etapa_id": string,"id": string,"movida_em": string,"nome": string,"recebida_em": string,"relevancia": number,"sinalizada": boolean,"situacao": string,"vaga_id": string
            }[]
                           },
"rs_fn_lista_eventos":
{ Args: { "p_admin": boolean,"p_alcance": Json,"p_desde": number,"p_empresa": string,"p_limite": number }; Returns: {
              "ator_tipo": Database["public"]['Enums']["rs_tipo_ator"],
"autorizado_por_membro_id": string | null,
"candidatura_id": string | null,
"credencial_id": string | null,
"criado_em": string,
"dados": NonNullable<Json>,
"empresa_id": string,
"id": number,
"membro_id": string | null,
"origem": Database["public"]['Enums']["rs_origem_evento"],
"tipo": string,
"vaga_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "rs_eventos"
        isOneToOne: false
        isSetofReturn: true
      } },
"rs_fn_move_etapa":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_empresa": string,"p_etapa": string,"p_ids": (string)[] }; Returns: number
                           },
"rs_fn_muda_acesso":
{ Args: { "p_areas": (string)[],"p_ator": Json,"p_membro": string,"p_papel": Database["public"]['Enums']["rs_papel_membro"],"p_todas_areas": boolean }; Returns: undefined
                           },
"rs_fn_notificacoes_a_retentar":
{ Args: { "p_lote": number,"p_max": number }; Returns: string[]
                           },
"rs_fn_novo_codigo_exclusao":
{ Args: { "p_candidatura": string,"p_codigo_hash": string,"p_intervalo_s": number,"p_max_hora": number,"p_validade_s": number }; Returns: string
                           },
"rs_fn_pede_acesso":
{ Args: { "p_empresa": string,"p_pessoa": string }; Returns: Json
                           },
"rs_fn_pede_revisao":
{ Args: { "p_candidatura": string,"p_texto": string }; Returns: string
                           },
"rs_fn_propoe_decisao":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_candidatura": string,"p_empresa": string,"p_justificativa": string,"p_payload": Json,"p_tipo": Database["public"]['Enums']["rs_tipo_decisao"],"p_vaga": string }; Returns: string
                           },
"rs_fn_reabre_candidatura":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_candidatura": string,"p_empresa": string }; Returns: undefined
                           },
"rs_fn_reenvia_convite":
{ Args: { "p_ator": Json,"p_expira_em": string,"p_membro": string,"p_token_hash": string }; Returns: undefined
                           },
"rs_fn_registra_avaliacao":
{ Args: { "p_ator": Json,"p_candidatura": string,"p_comentario": string,"p_empresa": string,"p_etapa": string,"p_membro": string,"p_recomendacao": Database["public"]['Enums']["rs_recomendacao"] }; Returns: string
                           },
"rs_fn_registra_evento":
{ Args: { "p_ator": Json,"p_candidatura": string,"p_dados"?: Json,"p_empresa": string,"p_origem": Database["public"]['Enums']["rs_origem_evento"],"p_tipo": string,"p_vaga": string }; Returns: number
                           },
"rs_fn_remove_membro":
{ Args: { "p_ator": Json,"p_membro": string }; Returns: undefined
                           },
"rs_fn_remove_webhook":
{ Args: { "p_ator": Json,"p_empresa": string,"p_id": string }; Returns: undefined
                           },
"rs_fn_reserva_entrega":
{ Args: { "p_id": string,"p_max": number }; Returns: boolean
                           },
"rs_fn_responde_revisao":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_candidatura": string,"p_empresa": string,"p_mensagem": Json,"p_reabrir": boolean }; Returns: undefined
                           },
"rs_fn_resultado_entrega":
{ Args: { "p_desiste": string,"p_espera": string,"p_id": string,"p_max": number,"p_status_http": number }; Returns: Database["public"]['Enums']["rs_status_entrega"]
                           },
"rs_fn_resumo_diario":
{ Args: { "p_empresa": string,"p_parada_dias": number,"p_revisao_dias": number }; Returns: Json
                           },
"rs_fn_resumo_donos":
{ Args: { "p_inicio"?: number,"p_lote": number }; Returns: Json
                           },
"rs_fn_revoga_credencial":
{ Args: { "p_ator": Json,"p_credencial": string,"p_empresa": string }; Returns: undefined
                           },
"rs_fn_salva_area":
{ Args: { "p_ator": Json,"p_empresa": string,"p_id": string,"p_nome": string,"p_responsavel": string }; Returns: string
                           },
"rs_fn_salva_empresa":
{ Args: { "p_ator": Json,"p_dados": Json,"p_empresa": string,"p_versao_anterior"?: string,"p_versao_aviso": string }; Returns: (string)[]
                           },
"rs_fn_salva_pessoa":
{ Args: { "p_area": string,"p_ator": Json,"p_cargo": string,"p_email": string,"p_empresa": string,"p_id": string,"p_nome": string,"p_recebe_resumo": boolean }; Returns: string
                           },
"rs_fn_salva_vaga":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_dados": Json,"p_empresa": string,"p_vaga": string }; Returns: undefined
                           },
"rs_fn_salva_webhook":
{ Args: { "p_ativo": boolean,"p_ator": Json,"p_empresa": string,"p_eventos": (string)[],"p_id": string,"p_max": number,"p_segredo_cifrado": string,"p_url": string }; Returns: string
                           },
"rs_fn_slug_vaga":
{ Args: { "p_base": string,"p_empresa": string,"p_vaga": string }; Returns: string
                           },
"rs_fn_talento_no_alcance":
{ Args: { "p_alcance": Json,"p_candidato": string }; Returns: boolean
                           },
"rs_fn_talentos_candidato":
{ Args: { "p_acao": string,"p_candidatura": string }; Returns: string
                           },
"rs_fn_tamanho_banco":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"rs_fn_tipo_webhook":
{ Args: { "p_tipo": string }; Returns: string
                           },
"rs_fn_transicao_vaga":
{ Args: { "p_alcance": Json,"p_ator": Json,"p_empresa": string,"p_max_publicadas": number,"p_motivo": Database["public"]['Enums']["rs_motivo_encerramento_vaga"],"p_para": Database["public"]['Enums']["rs_status_vaga"],"p_vaga": string }; Returns: undefined
                           },
"rs_fn_troca_codigo_oauth":
{ Args: { "p_challenge_do_verifier": string,"p_cliente": string,"p_codigo_hash": string,"p_redirect_uri": string,"p_token_hash": string,"p_token_prefixo": string }; Returns: string
                           },
"rs_fn_troca_link":
{ Args: { "p_candidatura": string,"p_empresa": string,"p_hash": string,"p_versao": number }; Returns: boolean
                           },
"rs_fn_troca_logo":
{ Args: { "p_ator": Json,"p_bytes": number,"p_empresa": string,"p_mime": string,"p_path": string,"p_sha256": string }; Returns: string
                           },
"rs_fn_vaga_no_alcance":
{ Args: { "p_alcance": Json,"p_area": string,"p_vaga": string }; Returns: boolean
                           },
"rs_fn_valida_areas":
{ Args: { "p_areas": (string)[],"p_empresa": string,"p_papel": Database["public"]['Enums']["rs_papel_membro"],"p_todas": boolean }; Returns: undefined
                           },
"rs_fn_valida_codigo_exclusao":
{ Args: { "p_candidatura": string,"p_codigo_hash": string,"p_max_tentativas": number }; Returns: string
                           }
          }
          Enums: {
            "rs_escopo": "leitura"|"escrita"|"decisao","rs_mensagens_agente": "confirmar"|"direto","rs_modelo_trabalho": "presencial"|"hibrido"|"remoto","rs_motivo_encerramento_vaga": "preenchida"|"cancelada"|"outro","rs_motivo_reprovacao": "requisitos"|"experiencia"|"perfil"|"pretensao_salarial"|"localizacao"|"outro_candidato"|"sem_retorno"|"outro","rs_origem_candidatura": "pagina"|"api_publica"|"integracao"|"manual"|"banco_talentos","rs_origem_evento": "web"|"api"|"mcp"|"publico"|"cron"|"formulario","rs_papel_membro": "administrador"|"recrutador"|"avaliador","rs_papel_na_vaga": "responsavel"|"avaliador","rs_recomendacao": "forte_sim"|"sim"|"nao"|"forte_nao","rs_regime": "clt"|"pj"|"estagio"|"temporario"|"aprendiz"|"trainee"|"freelancer"|"outro","rs_situacao_candidatura": "ativa"|"reprovada"|"desistiu"|"contratada"|"encerrada_vaga","rs_status_decisao": "pendente"|"confirmada"|"descartada"|"expirada","rs_status_entrega": "pendente"|"entregue"|"falhou"|"desistiu","rs_status_extracao": "pendente"|"ok"|"sem_texto"|"falhou","rs_status_notificacao": "pendente"|"enviada"|"falhou"|"descartada","rs_status_vaga": "rascunho"|"publicada"|"pausada"|"encerrada","rs_tipo_arquivo": "curriculo"|"anexo"|"logo","rs_tipo_ator": "membro"|"candidato"|"sistema"|"api"|"agente","rs_tipo_credencial": "api"|"mcp","rs_tipo_decisao": "reprovar"|"contratar"|"encerrar_vaga"|"enviar_mensagem","rs_tipo_etapa": "triagem"|"entrevista"|"avaliacao"|"proposta","rs_tipo_mensagem": "confirmacao"|"devolutiva"|"contato"|"convite_vaga"|"desistencia"|"resposta_revisao","rs_tipo_notificacao": "convite_membro"|"candidatura_recebida"|"mensagem_candidato"|"links_reenviados"|"codigo_exclusao"|"resumo_diario"|"decisoes_pendentes"|"revisao_pedida"|"talentos_expirando"|"resumo_dono_vaga"|"empresa_excluida"|"acesso_pedido"|"alerta_instancia"|"armazenamento_cheio","rs_tipo_pergunta": "texto_curto"|"texto_longo"|"sim_nao"|"escolha_unica"|"numero"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "rs_escopo": ["leitura", "escrita", "decisao"],"rs_mensagens_agente": ["confirmar", "direto"],"rs_modelo_trabalho": ["presencial", "hibrido", "remoto"],"rs_motivo_encerramento_vaga": ["preenchida", "cancelada", "outro"],"rs_motivo_reprovacao": ["requisitos", "experiencia", "perfil", "pretensao_salarial", "localizacao", "outro_candidato", "sem_retorno", "outro"],"rs_origem_candidatura": ["pagina", "api_publica", "integracao", "manual", "banco_talentos"],"rs_origem_evento": ["web", "api", "mcp", "publico", "cron", "formulario"],"rs_papel_membro": ["administrador", "recrutador", "avaliador"],"rs_papel_na_vaga": ["responsavel", "avaliador"],"rs_recomendacao": ["forte_sim", "sim", "nao", "forte_nao"],"rs_regime": ["clt", "pj", "estagio", "temporario", "aprendiz", "trainee", "freelancer", "outro"],"rs_situacao_candidatura": ["ativa", "reprovada", "desistiu", "contratada", "encerrada_vaga"],"rs_status_decisao": ["pendente", "confirmada", "descartada", "expirada"],"rs_status_entrega": ["pendente", "entregue", "falhou", "desistiu"],"rs_status_extracao": ["pendente", "ok", "sem_texto", "falhou"],"rs_status_notificacao": ["pendente", "enviada", "falhou", "descartada"],"rs_status_vaga": ["rascunho", "publicada", "pausada", "encerrada"],"rs_tipo_arquivo": ["curriculo", "anexo", "logo"],"rs_tipo_ator": ["membro", "candidato", "sistema", "api", "agente"],"rs_tipo_credencial": ["api", "mcp"],"rs_tipo_decisao": ["reprovar", "contratar", "encerrar_vaga", "enviar_mensagem"],"rs_tipo_etapa": ["triagem", "entrevista", "avaliacao", "proposta"],"rs_tipo_mensagem": ["confirmacao", "devolutiva", "contato", "convite_vaga", "desistencia", "resposta_revisao"],"rs_tipo_notificacao": ["convite_membro", "candidatura_recebida", "mensagem_candidato", "links_reenviados", "codigo_exclusao", "resumo_diario", "decisoes_pendentes", "revisao_pedida", "talentos_expirando", "resumo_dono_vaga", "empresa_excluida", "acesso_pedido", "alerta_instancia", "armazenamento_cheio"],"rs_tipo_pergunta": ["texto_curto", "texto_longo", "sim_nao", "escolha_unica", "numero"]
          }
        }
} as const
