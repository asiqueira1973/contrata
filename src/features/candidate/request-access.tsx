"use client";
// Botão "Pedir acesso" (8.10; 11.31): lê o token do link (?t=) e só pede com o clique (POST), para
// um leitor de e-mail que abre links não disparar o pedido sozinho.
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ERROS, copy } from "@/lib/copy";
import s from "./candidate.module.css";

export function RequestAccess({ empresaSlug }: { empresaSlug: string }) {
  const t = useSearchParams().get("t") ?? "";
  const c = copy.pedirAcesso;
  const [estado, setEstado] = useState<"pronto" | "ocupado" | "feito">("pronto");
  const [erro, setErro] = useState<string | null>(null);
  if (estado === "feito") return <div className={s.sucesso} role="status">{c.pronto}</div>;
  return (
    <div className={s.form}>
      {erro && <p className={s.erro} role="alert">{erro}</p>}
      <button className={s.botao} type="button" disabled={estado === "ocupado" || !t} onClick={async () => {
        setEstado("ocupado");
        setErro(null);
        try {
          const r = await fetch(`/api/publico/${empresaSlug}/pedir-acesso`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t }) });
          if (r.ok) return setEstado("feito");
          setErro(((await r.json().catch(() => ({}))) as { mensagem?: string }).mensagem ?? ERROS.generico);
        } catch {
          setErro(ERROS.generico);
        }
        setEstado("pronto");
      }}>{estado === "ocupado" ? c.enviando : c.botao}</button>
      {!t && <p className={s.erro} role="alert">{c.invalido}</p>}
    </div>
  );
}
