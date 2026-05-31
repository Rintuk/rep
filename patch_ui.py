import os

file_path = 'frontend/app/dashboard/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace menu button
content = content.replace('label: "Сменить пароль"', 'label: "Профиль"')

# Replace modal title
content = content.replace('Смена пароля</h3>', 'Профиль</h3>')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied successfully.")
