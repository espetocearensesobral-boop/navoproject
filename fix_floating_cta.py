import re

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

# Remove all existing floating CTAs
old_cta_regex = re.compile(r'\s*\{\/\* FLOATING CTA MOBILE \*\/\}[\s\S]*?<\/div>', re.MULTILINE)
content = re.sub(old_cta_regex, '', content)

# We need a ref for the final CTA to observe it
# Find where refs are declared:
refs_declaration = """  const containerRef = useRef<HTMLDivElement>(null);"""
if refs_declaration in content:
    content = content.replace(refs_declaration, """  const containerRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const [isFinalCtaVisible, setIsFinalCtaVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsFinalCtaVisible(entry.isIntersecting);
      },
      { root: containerRef.current, threshold: 0.1 }
    );
    if (finalCtaRef.current) {
      observer.observe(finalCtaRef.current);
    }
    return () => observer.disconnect();
  }, []);""")

# The final CTA section is near the end, looking for:
# id="localizacao"
final_cta_section = """<section id="localizacao" className="relative w-full h-full min-h-fit py-12 shrink-0 flex flex-col justify-between bg-[#0a0b0e] text-white overflow-hidden box-border">"""
if final_cta_section in content:
    content = content.replace(final_cta_section, """<section id="localizacao" ref={finalCtaRef} className="relative w-full h-full min-h-fit py-12 shrink-0 flex flex-col justify-between bg-[#0a0b0e] text-white overflow-hidden box-border">""")
elif '<section className="relative w-full h-full min-h-fit py-12 shrink-0 flex flex-col justify-between bg-[#0a0b0e]' in content:
    content = content.replace(
        '<section className="relative w-full h-full min-h-fit py-12 shrink-0 flex flex-col justify-between bg-[#0a0b0e] text-white overflow-hidden box-border">',
        '<section ref={finalCtaRef} className="relative w-full h-full min-h-fit py-12 shrink-0 flex flex-col justify-between bg-[#0a0b0e] text-white overflow-hidden box-border">'
    )

new_floating_cta = """
      <AnimatePresence>
        {!isFinalCtaVisible && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 right-0 z-40 md:hidden pointer-events-none pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center px-4"
          >
            <button 
              onClick={(e) => {
                 e.preventDefault();
                 hapticMedium();
                 onGoToBooking();
              }} 
              className="pointer-events-auto w-full max-w-xs bg-gold-base text-[#0a0a0a] font-extrabold text-base py-3 px-6 rounded-xl shadow-[0_8px_30px_color-mix(in_srgb,var(--color-gold-base)_35%,transparent)] border border-gold-base flex items-center justify-center gap-2 hover:bg-gold-deep active:scale-95 transition-all"
            >
              <CalendarCheck className="w-5 h-5" />
              Agendar agora
            </button>
          </motion.div>
        )}
      </AnimatePresence>
"""

content = content.replace('  return (\n    <div ref={containerRef} className="w-full h-full min-h-0 overflow-y-auto bg-white text-neutral-900 font-sans antialiased relative selection:bg-gold-base/20 selection:text-neutral-900 no-scrollbar">',
'  return (\n    <div ref={containerRef} className="w-full h-full min-h-0 overflow-y-auto bg-white text-neutral-900 font-sans antialiased relative selection:bg-gold-base/20 selection:text-neutral-900 no-scrollbar">' + new_floating_cta)

with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
