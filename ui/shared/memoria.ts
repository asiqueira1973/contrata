/**
 * Memória do formulário no navegador (copiada do Agenda Psi): o Claude remonta o formulário a partir do
 * resultado ORIGINAL da ferramenta quando a pessoa volta à conversa, e ele reaparecia
 * vazio depois de salvo. O ext-apps não guarda estado da tela, e o servidor é stateless
 * (4.3), então o formulário anota aqui, pelo `formulario_id` de cada abertura, que foi
 * salvo (com o resumo) ou cancelado. Guarda só o resumo já mostrado na tela.
 *
 * O host pode bloquear o armazenamento (iframe isolado): aí nada quebra, só não lembra.
 */
export type Lembranca =
  | { fase: 'sucesso'; resumo: string; idSalvo: string | null; titulo?: string }
  | { fase: 'cancelado' };

const chave = (id: string) => `contrata:formulario:${id}`;

/** Anota o fim do formulário. Engole qualquer erro do armazenamento. */
export function lembrar(storage: Storage | undefined, id: string, l: Lembranca): void {
  try {
    storage?.setItem(chave(id), JSON.stringify(l));
  } catch {
    // Armazenamento bloqueado pelo host: segue sem memória.
  }
}

/** Lê a anotação, ou `null` se não houver, se estiver corrompida ou se o host bloquear. */
export function lerLembranca(storage: Storage | undefined, id: string): Lembranca | null {
  try {
    const t = storage?.getItem(chave(id));
    if (!t) return null;
    const l = JSON.parse(t) as Lembranca;
    return l.fase === 'sucesso' || l.fase === 'cancelado' ? l : null;
  } catch {
    return null;
  }
}

/** O `localStorage` da página, se o host deixar sequer tocar nele. */
export function storageDaPagina(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
