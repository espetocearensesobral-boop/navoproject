import re

with open('src/components/client/BookingStep3DateTime.tsx', 'r') as f:
    content = f.read()

if 'CalendarOff' not in content:
    content = content.replace("import { ChevronLeft, ChevronRight, Sun, Sunset, AlertTriangle, Trash2, Clock } from 'lucide-react';", "import { ChevronLeft, ChevronRight, Sun, Sunset, AlertTriangle, Trash2, Clock, CalendarOff } from 'lucide-react';")
    if 'CalendarOff' not in content:
        content = content.replace("import { ChevronLeft, ChevronRight, Sun, Sunset, AlertTriangle, Trash2, Clock, CalendarOff }", "import { ChevronLeft, ChevronRight, Sun, Sunset, AlertTriangle, Trash2, Clock, CalendarOff }")
        
with open('src/components/client/BookingStep3DateTime.tsx', 'w') as f:
    f.write(content)

with open('src/components/client/ClientApp.tsx', 'r') as f:
    content = f.read()

# Remove duplicate pendingTabChange states
content = re.sub(r"const \[pendingTabChange, setPendingTabChange\] = useState<string \| null>\(null\);\n\s*const \[pendingTabChange, setPendingTabChange\] = useState<string \| null>\(null\);", "const [pendingTabChange, setPendingTabChange] = useState<string | null>(null);", content)

# Remove duplicate ConfirmDialog component
content = re.sub(r"(<ConfirmDialog[\s\S]*?/>)[\s\S]*?(<ConfirmDialog[\s\S]*?/>)", r"\1", content)

# Import ConfirmDialog
if "import { ConfirmDialog" not in content:
    content = content.replace("import { Button } from '../ui/Button';", "import { Button } from '../ui/Button';\nimport { ConfirmDialog } from '../ui/ConfirmDialog';")

with open('src/components/client/ClientApp.tsx', 'w') as f:
    f.write(content)
