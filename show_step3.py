with open('src/components/client/BookingStep3DateTime.tsx', 'r') as f:
    lines = f.readlines()
for i in range(115, 140):
    if i < len(lines):
        print(f"{i+1}: {lines[i]}", end="")
