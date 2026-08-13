import re

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

old_differentials = """  const differentials = [
    { icon: User, secondaryIcon: Scissors, label: 'Barbeiros Master', desc: '10+ anos de experiência', strokeColor: 'var(--color-gold-deep)', bgColor: 'color-mix(in srgb, var(--color-gold-base) 14%, transparent)' },
    { icon: Snowflake, label: 'Ambiente Premium', desc: 'Som e ar-condicionado', strokeColor: '#80b6c6', bgColor: '#e3f4f8' },
    { icon: Coffee, label: 'Bebida Cortesia', desc: 'Café e cerveja artesanal', strokeColor: '#9e795a', bgColor: '#f5efe9' },
  ];"""

new_differentials = """  const differentials = [
    { icon: User, secondaryIcon: Scissors, label: 'Barbeiros Master', desc: '10+ anos de experiência', strokeColor: 'var(--color-gold-deep)', bgColor: 'color-mix(in srgb, var(--color-gold-base) 14%, transparent)' },
    { icon: Snowflake, label: 'Ambiente Premium', desc: 'Som e ar-condicionado', strokeColor: '#80b6c6', bgColor: '#e3f4f8' },
    { icon: Coffee, label: 'Bebida Cortesia', desc: 'Café e cerveja artesanal', strokeColor: '#9e795a', bgColor: '#f5efe9' },
    { icon: Clock, secondaryIcon: Check, secondaryColor: '#4ade80', label: 'Agendamento Ágil', desc: 'Confirmação por WhatsApp', strokeColor: '#c1877f', bgColor: '#faece9' }
  ];"""

content = content.replace(old_differentials, new_differentials)

old_diff_grid = 'className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 my-auto py-[clamp(0.25rem,0.5vh,0.5rem)] items-stretch"'
new_diff_grid = 'className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1 min-h-0 my-auto py-2 items-stretch"'
content = content.replace(old_diff_grid, new_diff_grid)

with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
