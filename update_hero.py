import re

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

# Update Hero subtitle
content = content.replace(
    'Agende online, evite filas e saia renovado. Rápido, fácil e sem complicação.',
    'Agende seu corte em menos de 30 segundos, escolha o barbeiro e receba a confirmação pelo WhatsApp.'
)

# Update Hero CTA text and add subtitle
old_cta_content = '''              <span className="flex items-center gap-2 font-extrabold tracking-wide">
                Ver horários disponíveis
                <ArrowRight className="w-[1.35rem] h-[1.35rem] text-[#0a0a0a]" />
              </span>'''

new_cta_content = '''              <span className="flex items-center gap-2 font-extrabold tracking-wide">
                Agendar meu horário
                <ArrowRight className="w-[1.35rem] h-[1.35rem] text-[#0a0a0a]" />
              </span>
              <span className="text-xs font-medium text-[#0a0a0a]/70">
                Escolha serviço, barbeiro e horário em segundos
              </span>'''
content = content.replace(old_cta_content, new_cta_content)

# Subtitle CTA "Já marcou seu corte? Clique aqui"
old_secondary_cta = '''            <button 
              onClick={() => {
                hapticLight();
                if (isGuest) {
                  onOpenLogin();
                } else {
                  onGoToAppointments();
                }
              }}
              className="text-[#a1a1aa] hover:text-white text-[0.9rem] font-medium transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/60 cursor-pointer pt-2 shrink-0 pb-1"
            >
              Já marcou seu corte? Clique aqui
            </button>'''

new_secondary_cta = '''            <button 
              onClick={() => {
                hapticLight();
                if (isGuest) {
                  onOpenLogin();
                } else {
                  onGoToAppointments();
                }
              }}
              className="text-white/60 hover:text-white text-sm transition-colors cursor-pointer shrink-0 mt-1"
            >
              Já tem horário? <span className="underline underline-offset-4 decoration-white/30 hover:decoration-white/80">Acompanhar agendamento</span>
            </button>'''
content = content.replace(old_secondary_cta, new_secondary_cta)

with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
