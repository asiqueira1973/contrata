"use client";
// Escolha de papel e áreas (15.2 "Equipe — convidar"; regra 11.32: áreas só para recrutador, que
// pode ter todas ou algumas). Usado em convidar, mudar acesso e dar acesso.
import { PAPEL, copy } from "@/lib/copy";
import { PAPEIS, type Papel } from "@/lib/limits";
import ui from "@/components/ui/ui.module.css";

export type Acesso = { papel: Papel; todas_areas: boolean; areas: string[] };
export type AreaOpcao = { id: string; nome: string };

export function AccessPicker({ value, onChange, areas, name }: { value: Acesso; onChange: (v: Acesso) => void; areas: AreaOpcao[]; name: string }) {
  const c = copy.equipe;
  return (
    <>
      <fieldset className={ui.choices}>
        <legend className={ui.label}>{c.papel}</legend>
        {[...PAPEIS].reverse().map((p) => (
          <label key={p} className={ui.choice}>
            <input type="radio" name={`${name}-papel`} checked={value.papel === p} onChange={() => onChange({ ...value, papel: p })} />
            <span>
              {PAPEL[p].rotulo} <span className={ui.choiceHint}>({PAPEL[p].explicacao})</span>
            </span>
          </label>
        ))}
      </fieldset>
      {value.papel === "recrutador" ? (
        <fieldset className={ui.choices}>
          <legend className={ui.label}>{c.areas}</legend>
          <label className={ui.choice}>
            <input type="radio" name={`${name}-areas`} checked={value.todas_areas} onChange={() => onChange({ ...value, todas_areas: true, areas: [] })} />
            <span>{c.todasAreas}</span>
          </label>
          <label className={ui.choice}>
            <input type="radio" name={`${name}-areas`} checked={!value.todas_areas} onChange={() => onChange({ ...value, todas_areas: false })} />
            <span>{c.escolherAreas}</span>
          </label>
          {!value.todas_areas
            ? areas.map((a) => (
                <label key={a.id} className={ui.choice} style={{ paddingLeft: 28 }}>
                  <input
                    type="checkbox"
                    checked={value.areas.includes(a.id)}
                    onChange={(e) =>
                      onChange({ ...value, areas: e.target.checked ? [...value.areas, a.id] : value.areas.filter((x) => x !== a.id) })
                    }
                  />
                  <span>{a.nome}</span>
                </label>
              ))
            : null}
        </fieldset>
      ) : null}
    </>
  );
}

// Corpo enviado à rota: áreas só seguem para recrutador limitado (11.32).
export function acessoBody(v: Acesso) {
  const limitado = v.papel === "recrutador" && !v.todas_areas;
  return { papel: v.papel, todas_areas: !limitado, areas: limitado ? v.areas : [] };
}
