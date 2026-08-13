with open('src/components/client/BookingStep3DateTime.tsx', 'r') as f:
    content = f.read()
if 'CalendarOff' not in content:
    content = content.replace("import { ChevronLeft, ChevronRight, Sun, Sunset, AlertTriangle, Trash2, Clock } from 'lucide-react';", "import { ChevronLeft, ChevronRight, Sun, Sunset, AlertTriangle, Trash2, Clock, CalendarOff } from 'lucide-react';")
with open('src/components/client/BookingStep3DateTime.tsx', 'w') as f:
    f.write(content)

with open('src/components/client/ClientApp.tsx', 'r') as f:
    content = f.read()

if 'ConfirmDialog' not in content[:1500]:
    content = content.replace("import { LoadingSpinner } from '../ui/LoadingSpinner';", "import { LoadingSpinner } from '../ui/LoadingSpinner';\nimport { ConfirmDialog } from '../ui/ConfirmDialog';")

with open('src/components/client/ClientApp.tsx', 'w') as f:
    f.write(content)
