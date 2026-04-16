import os
import re

def replace_nanoid(content):
    # 1. Replace static imports: import { nanoid } from "nanoid";
    content = re.sub(r'import\s*{\s*nanoid\s*}\s*from\s*["\']nanoid["\'];?', 'import { randomBytes } from "crypto";', content)
    
    # 2. Replace dynamic imports: const { nanoid } = await import("nanoid");
    content = re.sub(r'const\s*{\s*nanoid(?:\s*:\s*\w+)?\s*}\s*=\s*await\s*import\(["\']nanoid["\']\);?', 'import { randomBytes } from "crypto";', content)
    
    # 3. Replace any remaining nid/nanoid calls with crypto equivalent
    # Handles nanoid(36), nanoid(24), nanoid(12), nid(36), etc.
    def crypto_repl(match):
        length = match.group(1) if match.group(1) else "10"
        return f'randomBytes(Math.ceil({length}/2)).toString("hex").slice(0, {length})'
    
    content = re.sub(r'\b(?:nanoid|nid)\((\d+)?\)', crypto_repl, content)
    
    return content

backend_dir = 'backend'
for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(('.ts', '.js')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = replace_nanoid(content)
            
            if new_content != content:
                # Ensure randomBytes is imported if used
                if 'randomBytes' in new_content and 'import { randomBytes } from "crypto"' not in new_content:
                    new_content = 'import { randomBytes } from "crypto";\n' + new_content
                
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Fixed: {path}")

