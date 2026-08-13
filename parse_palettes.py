import re

palettes_data = """
heritage	#C8A96A
sapphire	#5B8DEF
emerald	#35B779
amethyst	#A78BFA
ruby	#EF6B73
ocean	#22B8CF
copper	#D88952
rose	#E779A9
olive	#A3B18A
slate	#94A3B8
amber	#F59E0B
teal	#14B8A6
indigo	#6366F1
crimson	#E11D48
bronze	#C07A46
violet	#8B5CF6
champagne	#D4B996
mint	#10B981
coral	#F97316
titanium	#64748B
cobalt	#2563EB
jade	#059669
sand	#D97706
plum	#A855F7
electric	#06B6D4
sage	#84A98C
terracotta	#E07A5F
midnight	#3B82F6
lavender	#C084FC
bordeaux	#F43F5E
"""

def hex_to_rgb(hex_code):
    hex_code = hex_code.lstrip('#')
    return tuple(int(hex_code[i:i+2], 16) for i in (0, 2, 4))

def luminance(rgb):
    a = [v / 255.0 for v in rgb]
    a = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in a]
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722

def contrast_ratio(rgb1, rgb2):
    l1 = luminance(rgb1)
    l2 = luminance(rgb2)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)

dark_color = hex_to_rgb('#12131A')
light_color = hex_to_rgb('#FFFFFF')
dark_surface = hex_to_rgb('#12131A')
light_surface = hex_to_rgb('#F5F5F2')

with open('src/index.css', 'r') as f:
    css_content = f.read()

# Generate new semantic tokens CSS
theme_tokens = """
  --color-accent-solid: var(--color-accent-solid);
  --color-on-accent: var(--color-on-accent);
  --color-accent-text: var(--color-accent-text);
  --color-accent-soft: var(--color-accent-soft);
  --color-accent-strong: var(--color-accent-strong);
  --color-surface-inverse: var(--color-surface-inverse);
  --color-content-inverse: var(--color-content-inverse);
  --color-border-strong: var(--color-border-strong);
"""

css_content = css_content.replace('--color-content-on-accent: var(--color-content-on-accent);', '--color-content-on-accent: var(--color-content-on-accent);' + theme_tokens)

css_content = css_content.replace('--color-content-on-accent: #12131A;', '--color-content-on-accent: #12131A;\n  --color-surface-inverse: #FFFFFF;\n  --color-content-inverse: #12131A;\n  --color-border-strong: #FFFFFF;\n')

css_content = css_content.replace('--color-content-on-accent: #FFFFFF;', '--color-content-on-accent: #FFFFFF;\n  --color-surface-inverse: #12131A;\n  --color-content-inverse: #FFFFFF;\n  --color-border-strong: #12131A;\n')

css_content = re.sub(r'(/\* Hover semântico por paleta \*/[\s\S]*?)(\nhtml, body)', r'\nhtml, body', css_content)

new_palette_css = "/* Semantic Palette Tokens */\n"

for line in palettes_data.strip().split('\n'):
    parts = line.split('\t')
    if len(parts) != 2: continue
    pid = parts[0]
    pcolor = parts[1]
    
    rgb = hex_to_rgb(pcolor)
    
    # Text on Accent Solid
    c_dark = contrast_ratio(rgb, dark_color)
    c_light = contrast_ratio(rgb, light_color)
    
    on_accent = '#12131A' if c_dark >= c_light else '#FFFFFF'
    # Fallback to white for border cases where neither is strictly > 4.5 but light is close. Or whichever is higher.
    
    # Accent Text on Dark Surface (needs to be bright enough, contrast >= 4.5)
    # If the base color is too dark, we need a lighter version for text
    c_text_dark = contrast_ratio(rgb, dark_surface)
    accent_text_dark = pcolor
    if c_text_dark < 4.5:
        # Very naive lightening for dark surface
        # Let's just use a highly luminous version of the color, or mix with white
        # For this script, we'll output the logic in CSS or we can calculate here.
        # Actually it's better to just use the `accentSoft` or just CSS color-mix
        accent_text_dark = f"color-mix(in srgb, {pcolor} 40%, white)" if c_text_dark < 3.0 else f"color-mix(in srgb, {pcolor} 20%, white)"

    # Accent Text on Light Surface
    c_text_light = contrast_ratio(rgb, light_surface)
    accent_text_light = pcolor
    if c_text_light < 4.5:
        accent_text_light = f"color-mix(in srgb, {pcolor} 40%, black)" if c_text_light < 3.0 else f"color-mix(in srgb, {pcolor} 20%, black)"

    # Generate the rules
    new_palette_css += f'''
[data-palette="{pid}"] {{
  --color-accent-solid: var(--color-gold-base);
  --color-on-accent: {on_accent};
  --color-accent-strong: var(--color-gold-deep);
  --color-accent-soft: color-mix(in srgb, var(--color-gold-base) 15%, transparent);
}}
[data-theme="dark"][data-palette="{pid}"], [data-palette="{pid}"] {{
  --color-accent-text: {accent_text_dark};
}}
[data-theme="light"][data-palette="{pid}"] {{
  --color-accent-text: {accent_text_light};
}}
'''

# Find the block setting --color-gold-base
css_content = re.sub(r'(\[data-palette="heritage"\] \{ --color-gold-base:[\s\S]*?)(\nhtml, body)', new_palette_css + r'\nhtml, body', css_content)

with open('src/index.css', 'w') as f:
    f.write(css_content)

