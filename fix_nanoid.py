import os
import re

def replace_nanoid(content):
    # Replace static imports
    content = re.sub(r'import\s+{\s*nanoid\s*}\s*from\s*["\']nanoid["\'];?', 'import { randomBytes } from "crypto";', content)
    
    # Replace dynamic imports
    content = re.sub(r'const\s+{\s*nanoid(?::\s*nid)?\s*}\s*=\s*await\s*import\(["\']nanoid["\']\);?', 'import { randomBytes } from "crypto";', content)
    
    # Replace nanoid(N) or nid(N) with crypto equivalent
    content = re.sub(r'(?:nanoid|nid)\((\d+)\)', r'randomBytes(Math.ceil(\1/2)).toString("hex").slice(0, \1)', content)
    
    # Replace nanoid() with default length 10
    content = re.sub(r'(?:nanoid|nid)\(\)', r'randomBytes(5).toString("hex")', content)
    
    return content

backend_dir = 'backend'
for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(('.ts', '.js', '.json')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = replace_nanoid(content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Fixed: {path}")

