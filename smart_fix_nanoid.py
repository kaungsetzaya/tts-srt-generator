import os
import re

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    has_crypto_import = False
    
    for line in lines:
        # Remove any existing nanoid imports or duplicate crypto imports we added
        if 'from "nanoid"' in line or 'from "crypto"' in line:
            if not has_crypto_import:
                new_lines.append('import { randomBytes, randomUUID } from "crypto";\n')
                has_crypto_import = True
            continue
        
        # Replace nanoid(N) or nid(N) with crypto equivalent
        line = re.sub(r'\b(?:nanoid|nid)\((\d+)\)', r'randomBytes(Math.ceil(\1/2)).toString("hex").slice(0, \1)', line)
        line = re.sub(r'\b(?:nanoid|nid)\(\)', r'randomBytes(5).toString("hex")', line)
        
        new_lines.append(line)
    
    # If the file uses randomBytes but doesn't have the import, add it at the top
    content = "".join(new_lines)
    if 'randomBytes' in content and not has_crypto_import:
        content = 'import { randomBytes, randomUUID } from "crypto";\n' + content
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed: {path}")

backend_dir = 'backend'
for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(('.ts', '.js')):
            fix_file(os.path.join(root, file))
