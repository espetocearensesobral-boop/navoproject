import re

with open('src/components/client/LandingPage.tsx', 'r') as f:
    content = f.read()

# Update differentials
old_differentials = """  const differentials = [
    { icon: User, secondaryIcon: Scissors, label: 'Barbeiros Master', desc: '10+ anos de experiência', strokeColor: 'var(--color-gold-deep)', bgColor: 'color-mix(in srgb, var(--color-gold-base) 14%, transparent)' },
    { icon: Snowflake, label: 'Ambiente Premium', desc: 'Som e ar-condicionado', strokeColor: '#80b6c6', bgColor: '#e3f4f8' },
    { icon: Coffee, label: 'Bebida Cortesia', desc: 'Café e cerveja artesanal', strokeColor: '#9e795a', bgColor: '#f5efe9' },
    { icon: Wifi, label: 'Conectividade', desc: 'Wi-Fi de alta velocidade livre', strokeColor: '#71a67a', bgColor: '#e6f5ea' },
    { icon: Car, label: 'Estacionamento', desc: 'Vagas próprias gratuitas', strokeColor: '#9a9bc4', bgColor: '#edeefc' },
    { icon: Clock, secondaryIcon: Check, secondaryColor: '#4ade80', label: 'Agendamento Ágil', desc: 'Confirmação por WhatsApp', strokeColor: '#c1877f', bgColor: '#faece9' }
  ];"""

new_differentials = """  const differentials = [
    { icon: User, secondaryIcon: Scissors, label: 'Barbeiros Master', desc: '10+ anos de experiência', strokeColor: 'var(--color-gold-deep)', bgColor: 'color-mix(in srgb, var(--color-gold-base) 14%, transparent)' },
    { icon: Snowflake, label: 'Ambiente Premium', desc: 'Som e ar-condicionado', strokeColor: '#80b6c6', bgColor: '#e3f4f8' },
    { icon: Coffee, label: 'Bebida Cortesia', desc: 'Café e cerveja artesanal', strokeColor: '#9e795a', bgColor: '#f5efe9' },
  ];"""

content = content.replace(old_differentials, new_differentials)

# Make "Feito para você relaxar" section use a grid-cols-1 md:grid-cols-3 instead of 2/3 rows
old_diff_grid = 'className="grid grid-cols-2 md:grid-cols-3 grid-rows-3 md:grid-rows-2 gap-[clamp(0.375rem,1vh,1rem)] flex-1 min-h-0 my-auto py-[clamp(0.25rem,0.5vh,0.5rem)] items-stretch"'
new_diff_grid = 'className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 my-auto py-[clamp(0.25rem,0.5vh,0.5rem)] items-stretch"'
content = content.replace(old_diff_grid, new_diff_grid)

# Change gallery slice to 3 instead of 6
old_slice = 'return services.slice(0, 6).map((service, idx) => ({'
new_slice = 'return services.slice(0, 3).map((service, idx) => ({'
content = content.replace(old_slice, new_slice)

with open('src/components/client/LandingPage.tsx', 'w') as f:
    f.write(content)
