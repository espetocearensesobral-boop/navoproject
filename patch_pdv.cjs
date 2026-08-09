const fs = require('fs');
let code = fs.readFileSync('src/components/admin/PdvInteligente.tsx', 'utf8');

const regex = /\{\/\* Quick Metrics Bar \*\/\}[\s\S]*?\{\/\* MAIN WORKSPACE GRID \*\/\}/m;

const replacement = `{/* Quick Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Hoje</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">R$ {totalRevenueToday.toFixed(2)}</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Checkouts</span>
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">{todaysSales.length} vendas</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Pendentes</span>
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">{pendingAppointments.length} horários</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Produtos</span>
            <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">{products.length} itens</p>
        </div>
      </div>

      {/* MAIN WORKSPACE GRID */}`;

code = code.replace(regex, replacement);

fs.writeFileSync('src/components/admin/PdvInteligente.tsx', code);
console.log("Patched PdvInteligente");
