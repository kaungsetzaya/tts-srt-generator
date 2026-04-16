import os
import re

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # 1. Filter out ALL lines that import from "crypto" or "nanoid"
    # This handles: import ..., { ... } from "crypto", require("crypto"), await import("crypto")
    new_lines = []
    for line in lines:
        if 'from "crypto"' in line or "from 'crypto'" in line: continue
        if 'from "nanoid"' in line or "from 'nanoid'" in line: continue
        if 'require("crypto")' in line or "require('crypto')" in line: continue
        if 'require("nanoid")' in line or "require('nanoid')" in line: continue
        if 'import("crypto")' in line or "import('crypto')" in line: continue
        if 'import("nanoid")' in line or "import('nanoid')" in line: continue
        new_lines.append(line)
    
    content = "".join(new_lines)

    # 2. Replace nanoid/nid calls with crypto equivalents
    content = re.sub(r'\b(?:nanoid|nid)\((\d+)\)', r'randomBytes(Math.ceil(\1/2)).toString("hex").slice(0, \1)', content)
    content = re.sub(r'\b(?:nanoid|nid)\(\)', r'randomBytes(5).toString("hex")', content)

    # 3. Add a single, clean crypto import at the very top if needed
    needed_imports = []
    if 'randomBytes' in content: needed_imports.append('randomBytes')
    if 'randomUUID' in content: needed_imports.append('randomUUID')
    
    if needed_imports:
        import_line = f'import {{ {", ".join(needed_imports)} }} from "crypto";\n'
        content = import_line + content

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Nuclear Fixed: {path}")

backend_dir = 'backend'
for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(('.ts', '.js')):
            fix_file(os.path.join(root, file))
