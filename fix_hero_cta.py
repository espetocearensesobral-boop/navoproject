import re

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

old_hero_cta = """              className="w-full bg-gold-base hover:bg-gold-deep text-[#0a0a0a] font-bold text-lg py-[1.15rem] px-8 rounded-2xl flex flex-col items-center justify-center gap-0.5 shadow-[0_6px_35px_color-mix(in_srgb,var(--color-gold-base)_40%,transparent)] hover:shadow-[0_8px_45px_color-mix(in_srgb,var(--color-gold-base)_50%,transparent)] transition-all shrink-0 cursor-pointer"
            >
              <span className="flex items-center gap-2 font-extrabold tracking-wide">
                Agendar meu horário
                <ArrowRight className="w-[1.35rem] h-[1.35rem] text-[#0a0a0a]" />
              </span>
              <span className="text-xs font-medium text-[#0a0a0a]/70">
                Escolha serviço, barbeiro e horário em segundos
              </span>
            </motion.button>"""

new_hero_cta = """              className="w-full bg-gold-base hover:bg-gold-deep text-[#0a0a0a] font-bold text-base py-3 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              <span className="flex items-center gap-2 font-extrabold tracking-wide">
                Agendar meu horário
                <ArrowRight className="w-5 h-5 text-[#0a0a0a]" />
              </span>
            </motion.button>
            <p className="text-xs font-medium text-white/60 -mt-2">
              Escolha serviço, barbeiro e horário em segundos.
            </p>"""

if old_hero_cta in content:
    content = content.replace(old_hero_cta, new_hero_cta)
    print("Hero CTA updated")
else:
    print("Hero CTA not found")

old_status_cta = """          <div className="w-full flex justify-center mt-2 pb-4">
             <button onClick={() => {
                hapticLight();
                onGoToBooking();
             }} className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors max-w-sm sm:max-w-none text-center">
               <span className={`w-2 h-2 shrink-0 rounded-full ${shopStatusInfo.status === 'open' ? 'bg-green-500 animate-pulse' : shopStatusInfo.status === 'closing_soon' ? 'bg-amber-400' : 'bg-neutral-500'}`} />
               <span className="text-xs sm:text-sm font-medium text-white/90">
                 {shopStatusInfo.status === 'closed' 
                   ? `Fechado no momento · Próximo horário `
                   : `Aberto agora · Próximo horário `}
                   {nextAvailableTimeSlot || '...'}
               </span>
               <span className="hidden sm:inline-block text-white/40 px-1">•</span>
               <span className="text-xs sm:text-sm font-bold text-gold-base underline underline-offset-4 decoration-gold-base/30 hover:decoration-gold-base w-full sm:w-auto">
                 {shopStatusInfo.status === 'closed' ? 'Reservar próximo' : 'Agendar meu horário'}
               </span>
             </button>
          </div>"""

new_status_cta = """          <div className="w-full flex justify-center mt-2 pb-4">
             <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 px-4 py-2 max-w-sm sm:max-w-none text-center">
               <span className={`w-2 h-2 shrink-0 rounded-full ${shopStatusInfo.status === 'open' ? 'bg-green-500 animate-pulse' : shopStatusInfo.status === 'closing_soon' ? 'bg-amber-400' : 'bg-neutral-500'}`} />
               <span className="text-xs font-medium text-white/90">
                 {shopStatusInfo.status === 'closed' 
                   ? `Fechado no momento · Próximo atendimento `
                   : `Aberto agora · Próximo atendimento `}
                   {nextAvailableTimeSlot || '...'}
               </span>
               <span className="hidden sm:inline-block text-white/40 px-1">•</span>
               <button onClick={() => {
                  hapticLight();
                  onGoToBooking();
               }} className="text-xs font-bold text-gold-base hover:text-gold-deep cursor-pointer">
                 {shopStatusInfo.status === 'closed' ? 'Reservar próximo horário' : 'Ver horários disponíveis'}
               </button>
             </div>
          </div>"""

if old_status_cta in content:
    content = content.replace(old_status_cta, new_status_cta)
    print("Status CTA updated")
else:
    print("Status CTA not found")


with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
