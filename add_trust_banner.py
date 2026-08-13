import re

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

trust_section = """
      {/* SECTION: CONFIANÇA IMEDIATA */}
      <section className="w-full bg-neutral-900 border-b border-white/5 py-4 px-4 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-12 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center text-gold-base">
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
          </div>
          <span className="text-white/90 text-sm font-medium">4.9/5 <span className="text-white/50">(500+ avaliações)</span></span>
        </div>
        <div className="hidden sm:block w-px h-6 bg-white/10" />
        <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
          <CalendarCheck className="w-4 h-4 text-gold-base" />
          <span>Confirmação imediata via WhatsApp</span>
        </div>
      </section>
"""

content = content.replace(
    '      {/* SECTION 1: POR QUE A NAVO */}',
    trust_section + '\n      {/* SECTION 1: POR QUE A NAVO */}'
)

with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
