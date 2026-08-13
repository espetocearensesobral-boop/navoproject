import re

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

old_grid = """                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-neutral-50 border border-neutral-200/80 p-2 rounded-lg flex items-center gap-2 shadow-2xs">
                    <Clock className={`w-3.5 h-3.5 shrink-0 ${shopStatusInfo.status === 'open' ? 'text-emerald-500' : 'text-gold-base'}`} />
                    <div>
                      <span className="text-[8.5px] text-neutral-500 uppercase tracking-wider block font-bold">Horário Hoje</span>
                      <span className="text-[10.5px] font-bold text-neutral-800">
                        {shopStatusInfo.status === 'closed' ? 'Fechado hoje' : shopStatusInfo.todayHours}
                      </span>
                    </div>
                  </div>

                  <a href={`tel:${(shopProfile.phone || '(88) 99834-0085').replace(/\D/g, '')}`} className="bg-neutral-50 border border-neutral-200/80 p-2 rounded-lg flex items-center gap-2 shadow-2xs hover:bg-neutral-100 transition-colors cursor-pointer group">
                    <Phone className="w-3.5 h-3.5 text-gold-base shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <span className="text-[8.5px] text-neutral-500 uppercase tracking-wider block font-bold">Contato Direto</span>
                      <span className="text-[10.5px] font-bold text-neutral-800">
                        {shopProfile.phone || '(88) 99834-0085'}
                      </span>
                    </div>
                  </a>
                </div>"""

new_grid = """                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-neutral-50 border border-neutral-200/80 p-2 rounded-lg flex items-center gap-2 shadow-2xs">
                    <Clock className={`w-3.5 h-3.5 shrink-0 ${shopStatusInfo.status === 'open' ? 'text-emerald-500' : 'text-gold-base'}`} />
                    <div>
                      <span className="text-[8.5px] text-neutral-500 uppercase tracking-wider block font-bold">Horário Hoje</span>
                      <span className="text-[10.5px] font-bold text-neutral-800 truncate block">
                        {shopStatusInfo.status === 'closed' ? 'Fechado hoje' : shopStatusInfo.todayHours}
                      </span>
                    </div>
                  </div>

                  <a href={`tel:${(shopProfile.phone || '(88) 99834-0085').replace(/\D/g, '')}`} className="bg-neutral-50 border border-neutral-200/80 p-2 rounded-lg flex items-center gap-2 shadow-2xs hover:bg-neutral-100 transition-colors cursor-pointer group">
                    <Phone className="w-3.5 h-3.5 text-gold-base shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <span className="text-[8.5px] text-neutral-500 uppercase tracking-wider block font-bold">Contato Direto</span>
                      <span className="text-[10.5px] font-bold text-neutral-800">
                        {shopProfile.phone || '(88) 99834-0085'}
                      </span>
                    </div>
                  </a>
                  
                  <div className="bg-neutral-50 border border-neutral-200/80 p-2 rounded-lg flex items-center gap-2 shadow-2xs">
                    <Car className="w-3.5 h-3.5 shrink-0 text-gold-base" />
                    <div>
                      <span className="text-[8.5px] text-neutral-500 uppercase tracking-wider block font-bold">Estacionamento</span>
                      <span className="text-[10.5px] font-bold text-neutral-800">
                        Vagas gratuitas
                      </span>
                    </div>
                  </div>
                </div>"""

content = content.replace(old_grid, new_grid)

with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
