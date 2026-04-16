import os
import re

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Remove ALL nanoid and crypto imports first to start clean
    content = re.sub(r'import\s+.*?\s+from\s+["\']nanoid["\'];?\n?', '', content)
    content = re.sub(r'import\s+.*?\s+from\s+["\']crypto["\'];?\n?', '', content)
    content = re.sub(r'const\s+.*?\s+=\s+require\(["\']nanoid["\']\);?\n?', '', content)
    content = re.sub(r'const\s+.*?\s+=\s+require\(["\']crypto["\']\);?\n?', '', content)
    content = re.sub(r'const\s+.*?\s+=\s+await\s+import\(["\']nanoid["\']\);?\n?', '', content)

    # 2. Replace nanoid/nid calls with crypto equivalents
    content = re.sub(r'\b(?:nanoid|nid)\((\d+)\)', r'randomBytes(Math.ceil(\1/2)).toString("hex").slice(0, \1)', content)
    content = re.sub(r'\b(?:nanoid|nid)\(\)', r'randomBytes(5).toString("hex")', content)

    # 3. Add a single, clean crypto import at the very top
    # We include randomBytes and randomUUID as they are the most commonly used
    import_line = 'import { randomBytes, randomUUID } from "crypto";\n'
    
    # Only add the import if the file actually uses these functions
    if 'randomBytes' in content or 'randomUUID' in content:
        content = import_line + content

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Cleaned and Fixed: {path}")

backend_dir = 'backend'
for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(('.ts', '.js')):
            fix_file(os.path.join(root, file))
