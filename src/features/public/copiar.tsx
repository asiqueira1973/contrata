"use client";
// Botão "Copiar" do site institucional (portado do Fechou Por Quanto): copia o texto para a área de
// transferência e mostra "Copiado" por COPIADO_MS. Recebe: o texto, os rótulos e a classe. Sem a
// API de clipboard, não faz nada (o texto está visível ao lado para copiar à mão).
import { useState } from "react";
import { COPIADO_MS } from "@/lib/limits";

export function Copiar({ texto, rotulo, copiado, className }: { texto: string; rotulo: string; copiado: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={className}
      aria-label={`${rotulo}: ${texto}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), COPIADO_MS);
        } catch {
          // sem permissão de clipboard: o texto continua visível
        }
      }}
    >
      {ok ? copiado : rotulo}
    </button>
  );
}
