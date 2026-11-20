// Código de um erro para log e para a coluna "erro" das notificações (seção 17: nada de dado
// pessoal em log). Recebe: qualquer erro. Devolve: o código do Postgres/PostgREST, a mensagem
// quando ela é um código nosso conhecido (ex.: "resend_422"), ou só o nome da classe — nunca a
// mensagem livre, que pode trazer e-mail, IP ou valor digitado.
import "server-only";

// Mensagens que são códigos nossos: "resend_422", "RESEND_API_KEY ausente" e os códigos em
// snake_case que o servidor lança (ex.: "slug_em_uso", "selo_sem_certificado").
const OUR_CODES = /^(resend_\d{3}|RESEND_API_KEY ausente|[a-z][a-z0-9]*(_[a-z0-9]+)+)$/;

export function errorCode(e: unknown): string {
  if (e && typeof e === "object" && "code" in e && typeof (e as { code: unknown }).code === "string") {
    const { code, message } = e as { code: string; message?: unknown };
    // raise exception do plpgsql (P0001): a mensagem é o nosso código ("sem_reserva", "status_mudou").
    if (code === "P0001" && typeof message === "string" && OUR_CODES.test(message)) return message;
    return code;
  }
  if (e instanceof Error) return OUR_CODES.test(e.message) ? e.message : e.name;
  return "erro";
}
