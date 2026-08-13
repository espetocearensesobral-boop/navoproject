with open('src/components/client/BookingStep3DateTime.tsx', 'r') as f:
    content = f.read()
if "CalendarOff" not in content[:300]:
    content = content.replace("import { AlertTriangle, ", "import { AlertTriangle, CalendarOff, ")
    content = content.replace("import { ChevronLeft", "import { CalendarOff, ChevronLeft")
with open('src/components/client/BookingStep3DateTime.tsx', 'w') as f:
    f.write(content)
