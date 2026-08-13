with open('src/components/client/ClientApp.tsx', 'r') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if "const confirmAndExecuteTabChange" in line:
        print(f"Defined at line {i}")
    if "confirmAndExecuteTabChange(" in line:
        print(f"Called at line {i}")
