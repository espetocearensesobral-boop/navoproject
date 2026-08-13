with open('src/components/client/BookingStep3DateTime.tsx', 'r') as f:
    content = f.read()
if "import { CalendarOff } from 'lucide-react';" not in content:
    content = "import { CalendarOff } from 'lucide-react';\n" + content
with open('src/components/client/BookingStep3DateTime.tsx', 'w') as f:
    f.write(content)

with open('src/components/client/ClientApp.tsx', 'r') as f:
    content = f.read()
if "import { ConfirmDialog } from '../ui/ConfirmDialog';" not in content:
    content = "import { ConfirmDialog } from '../ui/ConfirmDialog';\n" + content
with open('src/components/client/ClientApp.tsx', 'w') as f:
    f.write(content)

