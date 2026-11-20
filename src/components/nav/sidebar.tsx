"use client";
// Menu lateral do painel — seção 16 (padrão App Store Connect, como no Assina).
// Topo: nome da empresa em negrito com seletor (chevron) para trocar de empresa. Grupos em negrito
// (Recrutamento, Pessoas, Configurar), itens indentados sem marcador, hairline entre grupos, um item
// ativo em azul com pílula clara. Rodapé: nome e e-mail, "Minha conta" e "Sair" (POST).
// Por papel (16): avaliador vê só Início e Vagas; recrutador vê Pessoas (sem Equipe e Áreas),
// Mensagens e Integrações; administrador vê tudo. Abaixo de 1024 px vira gaveta.
// usePathname exige <Suspense>: o SidebarView puro serve de fallback, sem item ativo.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { Check, ChevronDown, Menu, Plus, X } from "lucide-react";
import { copy } from "@/lib/copy";
import type { Papel } from "@/lib/limits";
import styles from "./sidebar.module.css";

export type SidebarProps = {
  empresa: { slug: string; nome: string };
  empresas: { slug: string; nome: string }[];
  papel: Papel;
  podeCriarEmpresa: boolean;
  nome: string;
  email: string;
};

type Item = { href: string; label: string };
type Group = { title: string; items: Item[] };

// Monta os grupos do menu para o papel (seção 16).
export function groupsFor(slug: string, papel: Papel): Group[] {
  const b = `/painel/${slug}`;
  const n = copy.nav;
  if (papel === "avaliador") {
    return [{ title: n.grupos.recrutamento, items: [{ href: b, label: n.inicio }, { href: `${b}/vagas`, label: n.vagas }] }];
  }
  const admin = papel === "administrador";
  return [
    {
      title: n.grupos.recrutamento,
      items: [
        { href: b, label: n.inicio },
        { href: `${b}/vagas`, label: n.vagas },
        { href: `${b}/confirmar`, label: n.confirmar },
        { href: `${b}/talentos`, label: n.talentos },
      ],
    },
    {
      title: n.grupos.pessoas,
      items: [
        ...(admin ? [{ href: `${b}/equipe`, label: n.equipe }, { href: `${b}/areas`, label: n.areas }] : []),
        { href: `${b}/pessoas`, label: n.pessoas },
      ],
    },
    {
      title: n.grupos.configurar,
      items: [
        ...(admin ? [{ href: `${b}/pagina`, label: n.pagina }] : []),
        { href: `${b}/mensagens`, label: n.mensagens },
        { href: `${b}/integracoes`, label: n.integracoes },
        ...(admin ? [{ href: `${b}/empresa`, label: n.empresa }] : []),
      ],
    },
  ];
}

// Item ativo: o de prefixo mais longo que casa com a rota; Início só nele mesmo.
export function activeHrefFor(pathname: string | null, groups: Group[], base: string): string | null {
  if (!pathname) return null;
  const all = groups.flatMap((g) => g.items.map((i) => i.href)).filter((h) => h !== base);
  const match = all.filter((h) => pathname === h || pathname.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
  return match ?? (pathname === base ? base : null);
}

// Seletor de empresa no topo (seção 16).
function CompanySwitcher({ empresa, empresas, podeCriarEmpresa }: Pick<SidebarProps, "empresa" | "empresas" | "podeCriarEmpresa">) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.switcher}>
      <button className={styles.switcherButton} type="button" aria-expanded={open} aria-label={copy.nav.trocarEmpresa} onClick={() => setOpen(!open)}>
        <span className={styles.brand}>{empresa.nome}</span>
        <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {open ? (
        <ul className={styles.switcherList}>
          {empresas.map((e) => (
            <li key={e.slug}>
              <Link className={styles.switcherItem} href={`/painel/${e.slug}`} onClick={() => setOpen(false)}>
                <span>{e.nome}</span>
                {e.slug === empresa.slug ? <Check size={16} aria-hidden="true" /> : null}
              </Link>
            </li>
          ))}
          {podeCriarEmpresa ? (
            <li>
              <Link className={styles.switcherItem} href="/painel/nova" onClick={() => setOpen(false)}>
                <span>{copy.empresas.criar}</span>
                <Plus size={16} aria-hidden="true" />
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

// Menu sem lógica de rota: recebe o item ativo pronto (ou null no fallback).
export function SidebarView(props: SidebarProps & { activeHref: string | null }) {
  const { empresa, papel, nome, email, activeHref } = props;
  const [open, setOpen] = useState(false);
  const groups = groupsFor(empresa.slug, papel);
  return (
    <>
      <header className={styles.topbar}>
        <button className={styles.menuButton} type="button" aria-label={copy.nav.abrirMenu} aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu size={22} strokeWidth={1.75} />
        </button>
        <span className={styles.topbarTitle}>{empresa.nome}</span>
      </header>
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />}
      <nav className={`${styles.sidebar} ${open ? styles.open : ""}`} aria-label={empresa.nome}>
        <div className={styles.brandRow}>
          <CompanySwitcher empresa={empresa} empresas={props.empresas} podeCriarEmpresa={props.podeCriarEmpresa} />
          <button className={styles.closeButton} type="button" aria-label={copy.nav.fecharMenu} onClick={() => setOpen(false)}>
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        {groups.map((group) => (
          <div key={group.title} className={styles.group}>
            <p className={styles.groupTitle}>{group.title}</p>
            <ul className={styles.items}>
              {group.items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={`${styles.item} ${active ? styles.active : ""}`} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className={styles.footer}>
          <p className={styles.footerName}>{nome}</p>
          <p className={styles.footerEmail}>{email}</p>
          <div className={styles.footerActions}>
            <Link className={styles.footerLink} href="/painel/conta">{copy.nav.conta}</Link>
            <form action="/sair" method="post">
              <button className={styles.footerLink} type="submit">{copy.nav.sair}</button>
            </form>
          </div>
        </div>
      </nav>
    </>
  );
}

// Lê a rota atual para marcar o item ativo.
function SidebarWithPath(props: SidebarProps) {
  const pathname = usePathname();
  const base = `/painel/${props.empresa.slug}`;
  return <SidebarView {...props} activeHref={activeHrefFor(pathname, groupsFor(props.empresa.slug, props.papel), base)} />;
}

// Menu do painel com o item ativo da rota atual (fallback sem item ativo).
export function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<SidebarView {...props} activeHref={null} />}>
      <SidebarWithPath {...props} />
    </Suspense>
  );
}
