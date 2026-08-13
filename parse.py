import re

with open('/tmp/LandingPage.tsx', 'r') as f:
    content = f.read()

# Let's find sections by finding <section
sections = [m.start() for m in re.finditer(r'<section', content)]
print(f"Found {len(sections)} sections at indices: {sections}")

# Look at main container class
main_div = re.search(r'<div ref=\{containerRef\} className="([^"]+)"', content)
if main_div:
    print(f"Main div class: {main_div.group(1)}")

