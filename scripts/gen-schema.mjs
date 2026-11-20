// Gera supabase/schema.sql a partir do Supabase local (seção 7.6: schema vivo, filtrado a rs_).
// O banco local do Contrata só tem objetos rs_*, então o dump do schema public já é esse recorte.
// Recebe: nada (Supabase local rodando). Devolve: o arquivo, com cabeçalho de "não editar".
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const dump = execSync("supabase db dump --local --schema public", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const header = "-- Gerado por `npm run db:schema` (supabase db dump --local --schema public). Não editar à mão.\n\n";
writeFileSync("supabase/schema.sql", header + dump);
console.log("supabase/schema.sql atualizado");
