export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export const DEFAULT_CATEGORIES: ServiceCategory[] = [
  { id: 'cat_cabelo', name: 'Cabelo', description: 'Cortes clássicos, modernos e estilizados' },
  { id: 'cat_barba', name: 'Barba', description: 'Modelagem, toalha quente e barboterapia' },
  { id: 'cat_combos', name: 'Combos & Pacotes', description: 'Pacotes com desconto especial' },
  { id: 'cat_quimica', name: 'Tintura & Química', description: 'Platinados, camuflagem e tratamentos' },
  { id: 'cat_estetica', name: 'Estética & Sobrancelha', description: 'Alinhamento e limpeza facial' },
];

export function getCategoryName(categoryId: string): string {
  if (!categoryId) return 'Geral';
  const found = DEFAULT_CATEGORIES.find(
    (c) => c.id === categoryId || c.id === `cat_${categoryId.replace('cat_', '')}`
  );
  if (found) return found.name;
  const raw = categoryId.replace('cat_', '');
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
