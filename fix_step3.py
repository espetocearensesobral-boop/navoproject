import re

with open('src/components/client/BookingStep3DateTime.tsx', 'r') as f:
    content = f.read()

# Fix toFixed(2)
content = re.sub(
    r"toFixed\(2\)",
    r"toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })",
    content
)

# Remove autoJump
content = re.sub(r"const autoJumpCount = useRef\(0\);\n", "", content)
content = re.sub(r"autoJumpCount\.current = 14;\n", "", content)

# Remove the jump logic block inside useEffect
auto_jump_pattern = re.compile(r"if \(isMounted && autoJumpCount\.current < 7\) \{.*?(?=setIsLoadingSlots\(false\);)", re.DOTALL)
content = auto_jump_pattern.sub("", content)

# Add state for unavailability reason
content = re.sub(
    r"const \[isAdvancing, setIsAdvancing\] = useState\(false\);",
    r"const [isAdvancing, setIsAdvancing] = useState(false);\n  const [unavailabilityReason, setUnavailabilityReason] = useState<string | null>(null);",
    content
)

# Parse response to get reason if present
fetch_logic = """if (response.ok) {
          const resData = await response.json();
          let newBusySlots: string[] = [];
          
          if (resData.statusCode === 'PROFESSIONAL_UNAVAILABLE') {
            if (isMounted) setUnavailabilityReason('Nenhum profissional disponível para o serviço e duração selecionados.');
          } else {
            if (isMounted) setUnavailabilityReason(null);
          }
          
          if (Array.isArray(resData)) {"""
          
old_fetch_logic = """if (response.ok) {
          const resData = await response.json();
          let newBusySlots: string[] = [];
          
          if (Array.isArray(resData)) {"""
          
content = content.replace(old_fetch_logic, fetch_logic)


with open('src/components/client/BookingStep3DateTime.tsx', 'w') as f:
    f.write(content)

