// [Todos] Início — seção 10. Vagas publicadas, "Para confirmar", revisões e paradas chegam com os
// épicos 8.3 a 8.6; até lá, o aviso com o guardião do papel mínimo (seção 5).
import { copy } from "@/lib/copy";
import { UnderConstruction } from "@/components/ui/under-construction";

export const instant = false;

export default function InicioPage({ params }: PageProps<"/painel/[empresa]">) {
  return <UnderConstruction title={copy.nav.inicio} params={params} papel="avaliador" />;
}
