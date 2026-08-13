import re

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

# Replace from <section id="galeria" ... to the end of Depoimentos section.
# We will just find where `<section id="galeria"` starts and where the Depoimentos section ends.

start_galeria = content.find('<section id="galeria"')
end_depoimentos = content.find('</section>', content.find('{/* SECTION 4: DEPOIMENTOS - VERTICAL LAYOUT */}')) + 10

if start_galeria != -1 and end_depoimentos != -1:
    new_experiencia_section = """      {/* SECTION: EXPERIÊNCIA NAVO */}
      <section id="experiencia" className="relative w-full py-16 px-[clamp(1rem,3vh,2rem)] bg-neutral-900 flex flex-col items-center shrink-0">
        <div className="max-w-5xl w-full mx-auto space-y-12">
          <div className="text-center space-y-3">
             <div className="flex justify-center items-center gap-1.5 mb-2 text-gold-base">
               <Star className="w-5 h-5 fill-current" />
               <Star className="w-5 h-5 fill-current" />
               <Star className="w-5 h-5 fill-current" />
               <Star className="w-5 h-5 fill-current" />
               <Star className="w-5 h-5 fill-current" />
             </div>
            <h2 className="font-serif text-[clamp(1.75rem,3vh,2.25rem)] font-bold text-white tracking-tight">
              Experiência <span className="text-gold-base">Navo</span>
            </h2>
            <p className="text-white/60 font-medium text-sm">
              Mais que um corte, um ritual de cuidado. Veja o que nossos clientes dizem.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-8 items-stretch">
            {/* Galeria de 3 fotos */}
            <div className="w-full md:w-1/2 flex flex-col gap-3">
               <div className="flex items-center justify-between px-1">
                 <span className="text-white/80 font-bold text-sm uppercase tracking-wider">Cortes Reais</span>
                 <button onClick={() => { hapticLight(); onGoToBooking(); }} className="text-gold-base hover:text-gold-deep text-xs font-bold transition-colors">Ver portfólio completo →</button>
               </div>
               <div className="grid grid-cols-2 gap-3 h-full min-h-[300px]">
                 {galleryFeaturedItems.slice(0, 3).map((item, idx) => (
                   <div key={idx} className={`relative rounded-xl overflow-hidden group bg-neutral-800 ${idx === 0 ? 'col-span-2 row-span-2 min-h-[200px]' : 'col-span-1 min-h-[120px]'}`}>
                     <img src={optimizeImageUrl(item.src, idx === 0 ? 800 : 400, 75)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                        <span className="text-white font-bold text-sm line-clamp-1">{item.title}</span>
                     </div>
                   </div>
                 ))}
                 {galleryFeaturedItems.length === 0 && (
                   <div className="col-span-2 row-span-2 flex items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-center p-6">
                     <p className="text-sm font-medium text-white/50">Fotos não disponíveis</p>
                   </div>
                 )}
               </div>
            </div>

            {/* Depoimento Único de Impacto */}
            <div className="w-full md:w-1/2 flex flex-col justify-center bg-white/5 border border-white/10 rounded-2xl p-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                 <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                   <path d="M14.017 21L16.411 14.976C15.047 14.694 14.017 13.504 14.017 12.015C14.017 10.354 15.358 9 17.017 9C18.675 9 20.017 10.354 20.017 12.015C20.017 15.688 17.202 19.387 14.017 21ZM5.01697 21L7.411 14.976C6.04697 14.694 5.01697 13.504 5.01697 12.015C5.01697 10.354 6.35797 9 8.01697 9C9.67597 9 11.017 10.354 11.017 12.015C11.017 15.688 8.20197 19.387 5.01697 21Z" />
                 </svg>
               </div>
               
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-12 h-12 rounded-full overflow-hidden bg-gold-base flex items-center justify-center text-neutral-900 font-bold text-lg">
                   MC
                 </div>
                 <div>
                   <h4 className="font-bold text-white text-base">Marcos C.</h4>
                   <p className="text-white/50 text-xs">Cliente desde 2024</p>
                 </div>
               </div>
               
               <p className="text-white/90 text-[clamp(1rem,2vh,1.15rem)] font-medium leading-relaxed italic mb-6">
                 "O cuidado com os detalhes é impressionante. O ambiente é incrível, o atendimento é de primeira e o corte superou todas as expectativas. Vale cada centavo."
               </p>
               
               <div className="flex items-center gap-2">
                 <div className="bg-white/10 px-3 py-1 rounded-full text-xs text-white/80 font-medium">Platinado & Barba</div>
                 <div className="flex items-center gap-1 text-gold-base text-sm font-bold">
                   <Star className="w-4 h-4 fill-current" />
                   5.0
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>"""
    
    content = content[:start_galeria] + new_experiencia_section + content[end_depoimentos:]
    
    # We might have modals or hooks related to gallery that we don't need now. But let's leave them if they don't break.
    
    with open('src/components/client/LandingPage.tsx', 'w') as f:
        f.write(content)
    print("Replaced Galeria and Depoimentos")
else:
    print("Could not find start/end")

