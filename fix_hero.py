import sys

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

old_status_block = """          <div className="flex justify-around items-center w-full px-2">
            <button onClick={toggleHoursModal} className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform hover:opacity-80">
              <span className="text-[#a0a0a0] text-[0.65rem] font-bold tracking-widest uppercase">STATUS DA LOJA</span>
              <div className="flex items-center gap-1.5">
                <span className={`font-semibold text-sm whitespace-nowrap ${shopStatusInfo.status === 'open' ? 'text-green-500' : shopStatusInfo.status === 'closing_soon' ? 'text-amber-400' : 'text-white'}`}>
                  {shopStatusInfo.status === 'closed' ? (nextAvailableTimeSlot ? `Abre ${nextAvailableTimeSlot.startsWith('0') || nextAvailableTimeSlot.startsWith('1') || nextAvailableTimeSlot.startsWith('2') ? 'hoje às ' + nextAvailableTimeSlot : nextAvailableTimeSlot}` : 'Fechado hoje') : shopStatusInfo.label}
                </span>
              </div>
            </button>

            {shopStatusInfo.status !== 'closed' && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[#a0a0a0] text-[0.65rem] font-bold tracking-widest uppercase">PRÓXIMO HORÁRIO</span>
                <span className="text-white font-bold text-sm">
                  {nextAvailableTimeSlot ? nextAvailableTimeSlot : <span className="opacity-50">...</span>}
                </span>
              </div>
            )}
          </div>"""

new_status_block = """          <div className="w-full flex justify-center mt-2 pb-4">
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

content = content.replace(old_status_block, new_status_block)

# Remove the default floating handle since we are changing bottom layout
old_handle = """          <div className="w-full flex justify-center mt-1">
            <div className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>"""
content = content.replace(old_handle, "")

with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
