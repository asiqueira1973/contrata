// Cabeçalho de página do painel (seção 16): título grande à esquerda.
import styles from "@/app/painel/painel.module.css";

export function PageHeader({ title }: { title: string }) {
  return (
    <div className={styles.pageHeader}>
      <h1 className={styles.pageTitle}>{title}</h1>
    </div>
  );
}
