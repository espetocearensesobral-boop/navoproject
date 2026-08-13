import re

with open('/tmp/LandingPage.tsx', 'r') as f:
    content = f.read()

# 1. Remove snap scroll from main container
content = content.replace(
    'w-full h-full min-h-0 overflow-y-scroll snap-y snap-mandatory',
    'w-full h-full min-h-0 overflow-y-auto'
)

# Remove snap-start snap-always shrink-0 min-h-full max-h-full from all sections
content = re.sub(
    r'min-h-full max-h-full snap-start snap-always shrink-0 ',
    'min-h-fit py-12 shrink-0 ',
    content
)
# For the hero specifically, it might need min-h-full to occupy the first screen
content = content.replace(
    '<section className="relative w-full h-full min-h-fit py-12 shrink-0 bg-[#0a0a0a]',
    '<section className="relative w-full min-h-full shrink-0 bg-[#0a0a0a]'
)

with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
