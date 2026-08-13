import re

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

floating_cta = """
      {/* FLOATING CTA MOBILE */}
      <div className="fixed bottom-6 left-0 right-0 z-40 md:hidden pointer-events-none flex justify-center px-4">
        <button 
          onClick={(e) => {
             e.preventDefault();
             hapticMedium();
             onGoToBooking();
          }} 
          className="pointer-events-auto w-full max-w-sm bg-gold-base text-[#0a0a0a] font-extrabold text-base py-3.5 px-6 rounded-2xl shadow-[0_8px_30px_color-mix(in_srgb,var(--color-gold-base)_35%,transparent)] border border-gold-base flex items-center justify-center gap-2 hover:bg-gold-deep active:scale-95 transition-all"
        >
          <CalendarCheck className="w-5 h-5" />
          Agendar agora
        </button>
      </div>
"""

content = content.replace('      <AnimatePresence>', floating_cta + '\n      <AnimatePresence>')

with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
