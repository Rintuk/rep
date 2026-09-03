import sys

with open('C:\\temp\\MaklerSite\\frontend\\app\\dashboard\\page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('Ваш бонус (Крипто+Форекс)', 'Бонус')

with open('C:\\temp\\MaklerSite\\frontend\\app\\dashboard\\page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Replaced')
