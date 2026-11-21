// [Público] Convite — seção 6.1, 15.2 e regra 11.24: mostra empresa, papel e quem convidou.
// Sem sessão: "Entrar com Google para aceitar" (o login aceita os convites pendentes do e-mail).
// Logado com o e-mail convidado: "Aceitar convite". Com outra conta: "Este convite é para {email}"
// e "Entrar com outra conta". Vencido, cancelado ou já usado: "Convite vencido" (sem detalhe).
import { Suspense } from "react";
import { copy } from "@/lib/copy";
import ui from "@/components/ui/ui.module.css";
import { AcceptInvite } from "@/features/org/accept-invite";
import { getCurrentUser } from "@/server/auth/require-usuario";
import { getInviteByToken } from "@/server/org/members";

// Lê o cookie de sessão: fora da casca estática da navegação instantânea do Next 16.4, como as
// páginas com sessão (sem isto, o conteúdo chega por streaming e não substitui o fallback).
export const instant = false;

async function Body({ params }: { params: PageProps<"/convite/[token]">["params"] }) {
  const { token } = await params;
  const c = copy.convite;
  const [convite, usuario] = await Promise.all([getInviteByToken(token), getCurrentUser()]);
  if (!convite || convite.vencido) {
    return <p className={ui.rowMeta}>{c.vencido}</p>;
  }
  const login = `/api/auth/google?${new URLSearchParams({ volta: `/convite/${token}` })}`;
  return (
    <div className={ui.form}>
      <p className={ui.rowTitle} style={{ fontWeight: 400, lineHeight: 1.5 }}>
        {c.texto(convite.quemConvidou ?? convite.empresa, convite.empresa, convite.papel)}
      </p>
      {!usuario ? (
        // Rota de API que redireciona ao Google: <a> de propósito (Link faria pré-carregamento).
        <a className={ui.primary} href={login}>{c.entrarParaAceitar}</a>
      ) : usuario.email.toLowerCase() === convite.email.toLowerCase() ? (
        <AcceptInvite token={token} />
      ) : (
        <>
          <p className={ui.rowMeta}>{c.outraConta(convite.email, usuario.email)}</p>
          <a className={ui.secondary} href={login}>{c.entrarComOutra}</a>
        </>
      )}
    </div>
  );
}

export default function ConvitePage({ params }: PageProps<"/convite/[token]">) {
  return (
    <main className={ui.narrow}>
      <h1 className={ui.narrowTitle}>{copy.convite.titulo}</h1>
      <div className={ui.card}>
        <Suspense fallback={<p className={ui.rowMeta}>{copy.carregando}</p>}>
          <Body params={params} />
        </Suspense>
      </div>
    </main>
  );
}
