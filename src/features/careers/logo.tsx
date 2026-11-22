// Logo da empresa no topo das páginas públicas e do candidato (8.9; seção 16). Decorativo: o nome
// da empresa vem logo ao lado ou abaixo, então o alt fica vazio. Sem logo, nada.
import s from "./careers.module.css";

export function LogoDaEmpresa({ url }: { url: string | null }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- logo servido pela própria rota pública, com cache e tamanho já limitados
  return <img className={s.logo} src={url} alt="" height={48} />;
}
