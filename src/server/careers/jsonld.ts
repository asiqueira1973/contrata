// JSON-LD JobPosting da vaga publicada (regra 11.20, com os ajustes de formato registrados no
// plans/8.1-fundacao.md): identifier como PropertyValue; Country "BR"; baseSalary em BRL com
// unitText MONTH ou HOUR; validThrough no fim do dia em BRT; remoto como TELECOMMUTE. Vaga não
// publicada (rascunho, pausada, encerrada): sem JSON-LD (null).
import "server-only";
import { copy } from "@/lib/copy";
import type { EmpresaPublica, VagaPublica } from "./public";

const TIPO_EMPREGO: Record<VagaPublica["regime"], string> = {
  clt: "FULL_TIME",
  temporario: "TEMPORARY",
  estagio: "INTERN",
  pj: "CONTRACTOR",
  freelancer: "CONTRACTOR",
  aprendiz: "OTHER",
  trainee: "OTHER",
  outro: "OTHER",
};

// Monta o JobPosting. Recebe: empresa, vaga e o endereço da página da vaga. Devolve: o objeto
// para <script type="application/ld+json">, ou null se a vaga não está publicada.
export function jobPosting(empresa: EmpresaPublica, vaga: VagaPublica, url: string): Record<string, unknown> | null {
  if (vaga.status !== "publicada" || !vaga.publicada_em) return null;
  const descricao = vaga.requisitos_html
    ? `${vaga.descricao_html}<h3>${copy.carreiras.requisitos}</h3>${vaga.requisitos_html}`
    : vaga.descricao_html;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: vaga.titulo,
    description: descricao,
    datePosted: vaga.publicada_em,
    employmentType: TIPO_EMPREGO[vaga.regime],
    hiringOrganization: { "@type": "Organization", name: empresa.nome, ...(empresa.site_url ? { sameAs: empresa.site_url } : {}) },
    identifier: { "@type": "PropertyValue", name: empresa.nome, value: vaga.id },
    directApply: true,
    url,
  };
  // Fim do dia da data-limite no horário de Brasília (11.19; o Brasil não tem horário de verão).
  if (vaga.encerra_em) ld.validThrough = `${vaga.encerra_em}T23:59:59-03:00`;
  if (vaga.modelo_trabalho === "remoto") {
    ld.jobLocationType = "TELECOMMUTE";
    ld.applicantLocationRequirements = { "@type": "Country", name: "BR" };
  } else {
    ld.jobLocation = {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: vaga.cidade, addressRegion: vaga.uf, addressCountry: "BR" },
    };
  }
  if (vaga.salario) {
    const { min, max, periodo } = vaga.salario;
    const valor = min !== null && max !== null && min !== max ? { minValue: min, maxValue: max } : { value: min ?? max };
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "BRL",
      value: { "@type": "QuantitativeValue", ...valor, unitText: periodo === "hora" ? "HOUR" : "MONTH" },
    };
  }
  return ld;
}

// Serializa para dentro de <script>: "<" vira < para o HTML da descrição não fechar a tag.
export function jsonLdSeguro(ld: Record<string, unknown>): string {
  return JSON.stringify(ld).replace(/</g, "\\u003c");
}
