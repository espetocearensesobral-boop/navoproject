import re

with open('src/components/client/BookingStep1Services.tsx', 'r') as f:
    content = f.read()

# Replace the useMemo for netflixRows
old_use_memo_regex = re.compile(r"const netflixRows = useMemo\(\(\) => \{.*?\n\s*\}, \[services, activeCategory, searchQuery, filteredServices\]\);", re.DOTALL)

new_use_memo = """const netflixRows = useMemo(() => {
    // 1. Busca ativa
    if (searchQuery.trim() !== '') {
      return [
        {
          id: 'filtered',
          categoryId: activeCategory,
          title: 'Resultados da busca',
          icon: <Filter className="w-4 h-4 text-gold-base" />,
          services: filteredServices,
        },
      ];
    }

    const rows: { id: string; categoryId?: string; title: string; icon: React.ReactNode; services: ServiceItem[] }[] = [];

    // Destaques (se em cat_all ou na página inicial)
    const popularServices = services.filter((s) => s.popular || s.is_combo).slice(0, 6);
    if (popularServices.length > 0 && activeCategory === 'cat_all') {
      rows.push({
        id: 'row_popular',
        categoryId: 'cat_all',
        title: 'Mais Vendidos & Destaques',
        icon: <Flame className="w-4 h-4 text-amber-500" />,
        services: popularServices,
      });
    }

    // Categoria ativa (ou Todos)
    if (activeCategory === 'cat_all') {
      // Avoid duplicate rendering by filtering out popular ones from 'Todos'
      const remainingServices = services.filter(s => !(s.popular || s.is_combo));
      if (remainingServices.length > 0) {
        rows.push({
          id: 'row_all',
          categoryId: 'cat_all',
          title: 'Todos os Serviços',
          icon: <Scissors className="w-4 h-4 text-gold-base" />,
          services: remainingServices,
        });
      }
    } else {
      const activeCatData = DEFAULT_CATEGORIES.find(c => c.id === activeCategory);
      const catName = activeCatData ? activeCatData.name : 'Categoria';
      rows.push({
        id: `row_${activeCategory}`,
        categoryId: activeCategory,
        title: catName,
        icon: <Filter className="w-4 h-4 text-gold-base" />,
        services: filteredServices,
      });
    }

    return rows;
  }, [services, activeCategory, searchQuery, filteredServices]);"""

content = old_use_memo_regex.sub(new_use_memo, content)

with open('src/components/client/BookingStep1Services.tsx', 'w') as f:
    f.write(content)

