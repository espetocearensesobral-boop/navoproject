with open('src/components/client/ClientApp.tsx', 'r') as f:
    content = f.read()
lines = content.split('\n')
for i, line in enumerate(lines):
    if 'handleTabChange' in line:
        print(f"Line {i+1}:")
        print('\n'.join(lines[i:i+30]))
        break
