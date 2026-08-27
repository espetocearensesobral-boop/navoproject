import os
import re

toast_import = 'import { useToast } from "../ui/Toast";\n'

files_to_fix = [
    'src/components/admin/ProfessionalsManagement.tsx',
    'src/components/admin/BarbershopProfileManagement.tsx',
    'src/components/admin/ProductsManagement.tsx',
    'src/components/admin/GoogleAdsManagement.tsx',
    'src/components/admin/GoogleAdsSettings.tsx',
    'src/components/admin/MetaAdsManagement.tsx',
    'src/components/admin/MetaAdsSettings.tsx',
    'src/components/admin/SettingsManagement.tsx',
    'src/components/admin/AgendaAvailabilitySettings.tsx',
    'src/components/admin/WhatsAppManagement.tsx',
    'src/components/admin/WhatsAppInboxManagement.tsx',
    'src/components/admin/FollowUpActionModal.tsx'
]

for filepath in files_to_fix:
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add import
    if 'useToast' not in content:
        content = re.sub(r'(import React.*?\n)', r'\1' + toast_import, content, count=1)
    
    # Inject showToast into component
    component_name = os.path.basename(filepath).replace('.tsx', '')
    if component_name == 'FollowUpActionModal':
        content = re.sub(r'(export function FollowUpActionModal.*?{)', r'\1\n  const { showToast } = useToast();', content)
    else:
        content = re.sub(fr'(export function {component_name}.*?{{)', r'\1\n  const { showToast } = useToast();', content)

    # General replacements for various message/toast states
    content = re.sub(r'setToastMsg\((.*?)\);', r'showToast("success", "Sucesso", \1);', content)
    content = re.sub(r'setTimeout\(\(\) => setToastMsg\(null\), \d+\);', '', content)
    content = re.sub(r'setToast\((.*?)\);', r'showToast("success", "Sucesso", \1);', content)
    content = re.sub(r'setTimeout\(\(\) => setToast\(null\), \d+\);', '', content)
    
    # Message objects (type and text)
    content = re.sub(r'setMessage\(\{\s*type:\s*"success",\s*text:\s*(.*?)\s*\}\);', r'showToast("success", "Sucesso", \1);', content)
    content = re.sub(r'setMessage\(\{\s*type:\s*"error",\s*text:\s*(.*?)\s*\}\);', r'showToast("error", "Erro", \1);', content)
    content = re.sub(r'setMessage\(null\);', '', content)
    
    content = re.sub(r'setStatusMsg\(\{\s*type:\s*"success",\s*text:\s*(.*?)\s*\}\);', r'showToast("success", "Sucesso", \1);', content)
    content = re.sub(r'setStatusMsg\(\{\s*type:\s*"error",\s*text:\s*(.*?)\s*\}\);', r'showToast("error", "Erro", \1);', content)
    content = re.sub(r'setStatusMsg\(null\);', '', content)
    
    content = re.sub(r'setStatus\(\{\s*type:\s*"success",\s*text:\s*(.*?)\s*\}\);', r'showToast("success", "Sucesso", \1);', content)
    content = re.sub(r'setStatus\(\{\s*type:\s*"error",\s*text:\s*(.*?)\s*\}\);', r'showToast("error", "Erro", \1);', content)

    # Remove the UI renders for these local states
    content = re.sub(r'\{toastMsg && \([\s\S]*?\{toastMsg\}\n\s*</(?:span|div|p)>\n\s*\)\}', '', content)
    content = re.sub(r'\{toast && \([\s\S]*?\{toast\}\n\s*</(?:span|div|p)>\n\s*\)\}', '', content)
    content = re.sub(r'\{message && \([\s\S]*?\{message\.text\}\n\s*</div>\n\s*\)\}', '', content)
    content = re.sub(r'\{statusMsg && \([\s\S]*?\{statusMsg\.text\}\n\s*</div>\n\s*\)\}', '', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Applied toast replacements")
