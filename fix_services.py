import re

with open('src/components/admin/ServicesManagement.tsx', 'r') as f:
    content = f.read()

# We want to find the first occurrence of:
#       {/* Main Content Area: Responsive Table */}
# and the LAST occurrence of:
#           )}
#         </div>
#       </div>
# before the Modal starts:
#       {/* Advanced Compact & Modular Create / Edit Service Modal */}

start_marker = "      {/* Main Content Area: Responsive Table */}"
end_marker = "      {/* Advanced Compact & Modular Create / Edit Service Modal */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Markers not found")
    exit(1)

replacement = """      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8B8B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--admin-text-main)] placeholder-[#8B8B8B] outline-none focus:border-[var(--admin-accent)] transition-colors"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Category Dropdown */}
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-main)] rounded-xl px-3 py-2 outline-none focus:border-[var(--admin-accent)]"
            >
              <option value="all">Todas</option>
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center bg-[var(--admin-surface)] p-1 rounded-xl border border-[var(--admin-border)]">
            <button
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterType === "all"
                  ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType("combos")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterType === "combos"
                  ? "bg-status-success text-white shadow"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
            >
              Combos VIP
            </button>
            <button
              onClick={() => setFilterType("popular")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterType === "popular"
                  ? "bg-[var(--admin-accent)]/30 text-[var(--admin-accent)] shadow"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
            >
              Mais Pedidos
            </button>
            <button
              onClick={() => setFilterType("gallery")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterType === "gallery"
                  ? "bg-blue-500/30 text-blue-300 shadow"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
            >
              Com Galeria
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[var(--admin-surface)] p-1 rounded-xl border border-[var(--admin-border)]">
            <button
              onClick={() => setViewMode("table")}
              className={`min-h-10 px-2 rounded-lg text-xs transition-all ${
                viewMode === "table"
                  ? "bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
              title="Visualização em Tabela"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`min-h-10 px-2 rounded-lg text-xs transition-all ${
                viewMode === "list"
                  ? "bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

"""

# Extract the table 2 which starts from `      <div className="admin-table-container">` inside the duplicate part.
# The table 2 starts at `778:      <div className="admin-table-container">`

table_start_marker = '      <div className="admin-table-container">'
# Find the LAST table container before end_idx
last_table_idx = content.rfind(table_start_marker, 0, end_idx)

if last_table_idx == -1:
    print("Table 2 not found")
    exit(1)

table_content = content[last_table_idx:end_idx]

new_content = content[:start_idx] + replacement + table_content + content[end_idx:]

with open('src/components/admin/ServicesManagement.tsx', 'w') as f:
    f.write(new_content)

print("File updated successfully.")
