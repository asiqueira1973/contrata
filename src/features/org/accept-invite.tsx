"use client";
// Botão "Aceitar convite" para quem já está logado com o e-mail convidado (6.1, 11.24). Aceita pela
// rota e mostra como conectar o conector (/convite/aceito); erro aparece no lugar.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { copy } from "@/lib/copy";
import ui from "@/components/ui/ui.module.css";
import { request } from "./request";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const r = await request<{ empresa: string }>("POST", `/api/convite/${encodeURIComponent(token)}/aceitar`);
    if (!r.ok) {
      setBusy(false);
      return setError(r.mensagem);
    }
    router.push("/convite/aceito");
  }

  return (
    <>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      <button className={ui.primary} type="button" onClick={accept} disabled={busy} aria-busy={busy}>{copy.convite.aceitar}</button>
    </>
  );
}
