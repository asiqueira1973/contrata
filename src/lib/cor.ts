// Cor de destaque (11.20): o texto branco do botão "Candidatar-me" precisa de contraste ≥ 4,5:1
// (WCAG AA). Sem dependência de servidor: o formulário e o servidor usam a mesma conta.

// Diz se o valor é uma cor #rrggbb. Recebe: o texto.
export function corValida(cor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(cor);
}

// Luminância relativa (WCAG 2.1) de #rrggbb.
function luminancia(cor: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contraste da cor com o branco (1 a 21). Recebe: #rrggbb. Devolve a razão com duas casas.
export function contrasteComBranco(cor: string): number {
  return Math.round(((1.05 / (luminancia(cor) + 0.05)) * 100)) / 100;
}
