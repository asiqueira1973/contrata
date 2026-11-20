// [avaliador] vagas — seção 10. A tela chega no épico que a implementa (seção 8); até lá, o item
// do menu leva a este aviso, já com o guardião do papel mínimo (seção 5).
import { copy } from "@/lib/copy";
import { UnderConstruction } from "@/components/ui/under-construction";

export const instant = false;

export default function Page({ params }: PageProps<"/painel/[empresa]/vagas">) {
  return <UnderConstruction title={copy.nav.vagas} params={params} papel="avaliador" />;
}
