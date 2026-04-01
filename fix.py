content = open('tracto-backend/main.py', encoding='utf-8').read()
content = content.replace("else 'Sem dados'}].\"", "else 'Sem dados'}.\"")
open('tracto-backend/main.py', 'w', encoding='utf-8').write(content)
