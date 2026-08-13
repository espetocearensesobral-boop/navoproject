import re

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

services_section = """
      {/* SECTION: SERVIÇOS MAIS PROCURADOS */}
      <section className="relative w-full py-16 px-[clamp(1rem,3vh,2rem)] bg-neutral-50 flex flex-col items-center shrink-0">
        <div className="max-w-5xl w-full mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="font-serif text-[clamp(1.75rem,3vh,2.25rem)] font-bold text-neutral-900 tracking-tight">
              Serviços mais agendados
            </h2>
            <p className="text-neutral-500 font-medium text-sm">
              Escolha seu estilo e deixe o resto com nossos especialistas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Corte Navo Premium',
                duration: '45 min',
                price: 'R$ 60,00',
                tag: 'Mais agendado',
                image: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=80&w=600'
              },
              {
                title: 'Combo Corte + Barba',
                duration: '1h 20 min',
                price: 'R$ 100,00',
                tag: 'Ideal para primeira visita',
                image: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=80&w=600'
              },
              {
                title: 'Barba Clássica',
                duration: '30 min',
                price: 'R$ 45,00',
                tag: 'Ritual com toalha quente',
                image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=600'
              }
            ].map((srv, idx) => (
              <div key={idx} onClick={onGoToBooking} className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                <div className="h-48 relative overflow-hidden bg-neutral-100">
                  <div className="absolute top-3 left-3 z-10 bg-gold-base text-neutral-900 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {srv.tag}
                  </div>
                  <img src={srv.image} alt={srv.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <div className="p-5 flex flex-col flex-1 justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-neutral-900">{srv.title}</h3>
                    <div className="flex items-center gap-2 mt-2 text-neutral-500 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{srv.duration}</span>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="font-extrabold text-neutral-900">{srv.price}</span>
                    <button className="bg-neutral-900 text-white text-xs font-bold px-4 py-2 rounded-xl group-hover:bg-gold-base group-hover:text-neutral-900 transition-colors">
                      Agendar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-4">
            <button onClick={onGoToBooking} className="text-neutral-900 border border-neutral-300 hover:border-neutral-900 bg-white hover:bg-neutral-50 px-6 py-3 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-2xs cursor-pointer">
              Ver todos os serviços
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
"""

how_it_works_section = """
      {/* SECTION: COMO FUNCIONA */}
      <section className="relative w-full py-16 px-[clamp(1rem,3vh,2rem)] bg-white flex flex-col items-center shrink-0 border-t border-neutral-100">
        <div className="max-w-5xl w-full mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="font-serif text-[clamp(1.75rem,3vh,2.25rem)] font-bold text-neutral-900 tracking-tight">
              Como funciona
            </h2>
            <p className="text-neutral-500 font-medium text-sm">
              Sem ligar, sem esperar. Resolva seu agendamento em três passos simples.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting Line (Desktop only) */}
            <div className="hidden md:block absolute top-8 left-[16.66%] right-[16.66%] h-px bg-neutral-200" />
            
            <div className="flex flex-col items-center text-center relative z-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gold-base/10 border border-gold-base flex items-center justify-center text-gold-deep shadow-sm">
                <Scissors className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 mb-1">1. Escolha o serviço</h3>
                <p className="text-sm text-neutral-500 leading-relaxed max-w-[250px]">Corte, barba ou química. Veja os detalhes e tempo de duração.</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center text-center relative z-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gold-base/10 border border-gold-base flex items-center justify-center text-gold-deep shadow-sm">
                <CalendarCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 mb-1">2. Selecione o horário</h3>
                <p className="text-sm text-neutral-500 leading-relaxed max-w-[250px]">Escolha seu barbeiro favorito e a data perfeita na agenda dele.</p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center relative z-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gold-base/10 border border-gold-base flex items-center justify-center text-gold-deep shadow-sm">
                <MessageCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 mb-1">3. Receba confirmação</h3>
                <p className="text-sm text-neutral-500 leading-relaxed max-w-[250px]">Tudo pronto! Seu comprovante chega na hora no WhatsApp.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
"""

content = content.replace(
    '      {/* SECTION 1: POR QUE A NAVO */}',
    services_section + '\n' + how_it_works_section + '\n      {/* SECTION 1: POR QUE A NAVO */}'
)

with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
