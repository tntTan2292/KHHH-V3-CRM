import os
import shutil
from pathlib import Path

base_dir = Path("d:/Antigravity - Project/KHHH - Antigravity - V3.0")

# 1. Create directories
dirs_to_create = [
    "Rules/ASSIGNMENT",
    "Rules/SECURITY",
    "Rules/DECISIONS",
    "AI_CONTEXT/00_FOUNDATION",
    "ARCHIVE/FORENSIC",
    "ARCHIVE/DEPRECATED"
]
for d in dirs_to_create:
    (base_dir / d).mkdir(parents=True, exist_ok=True)

# 2. Merge LIFECYCLE_SSOT_REFERENCE_TABLE.md into TASK_LIFECYCLE_RULES.md
table_path = base_dir / "Rules/CRM_WORKFLOW/LIFECYCLE_SSOT_REFERENCE_TABLE.md"
rules_path = base_dir / "Rules/CRM_WORKFLOW/TASK_LIFECYCLE_RULES.md"
if table_path.exists() and rules_path.exists():
    with open(table_path, "r", encoding="utf-8") as f:
        table_content = f.read()
    with open(rules_path, "a", encoding="utf-8") as f:
        f.write("\n\n---\n\n# LIFECYCLE SSOT REFERENCE TABLE\n\n")
        f.write(table_content)
    # Move table to deprecated
    shutil.move(str(table_path), str(base_dir / "ARCHIVE/DEPRECATED/LIFECYCLE_SSOT_REFERENCE_TABLE.md"))

# 3. Create ASSIGNMENT_CONSTITUTION.md
artifact_path = Path("C:/Users/Admin/.gemini/antigravity-ide/brain/9657a110-8ffa-4dfa-b6c1-549d8b2de12a/MASTER_RULE_DOCUMENT_GIAO_VIEC.md")
constitution_dest = base_dir / "Rules/ASSIGNMENT/ASSIGNMENT_CONSTITUTION.md"
if artifact_path.exists():
    with open(artifact_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    header = "> [!IMPORTANT]\n> **FROZEN BUSINESS CONSTITUTION**\n>\n> - Không sửa trực tiếp\n> - Mọi thay đổi phải: audit impact, append decision log, version decision\n> - KHÔNG được AI tự rewrite constitution.\n> - If Decision Logs conflict with Constitution, Constitution always wins.\n\n"
    
    with open(constitution_dest, "w", encoding="utf-8") as f:
        f.write(header + content)

# 4. Update SAFE_REFACTOR_RULES.md and move
safe_rules_src = base_dir / "Rules/DEVELOPMENT/SAFE_REFACTOR_RULES.md"
safe_rules_dest = base_dir / "Rules/SECURITY/SAFE_REFACTOR_RULES.md"
if safe_rules_src.exists():
    with open(safe_rules_src, "r", encoding="utf-8") as f:
        content = f.read()
    
    header = "> [!IMPORTANT]\n> **System Protection Rules (Not Permission Security Rules)**\n\n"
    with open(safe_rules_dest, "w", encoding="utf-8") as f:
        f.write(header + content)
    os.remove(safe_rules_src)

# 5. Move remaining Rules/DEVELOPMENT files
dev_conv = base_dir / "Rules/DEVELOPMENT/DEVELOPMENT_CONVENTIONS.md"
git_work = base_dir / "Rules/DEVELOPMENT/GIT_WORKFLOW.md"
if dev_conv.exists(): shutil.move(str(dev_conv), str(base_dir / "AI_CONTEXT/00_FOUNDATION/DEVELOPMENT_CONVENTIONS.md"))
if git_work.exists(): shutil.move(str(git_work), str(base_dir / "AI_CONTEXT/00_FOUNDATION/GIT_WORKFLOW.md"))

dev_dir = base_dir / "Rules/DEVELOPMENT"
if dev_dir.exists() and not os.listdir(dev_dir):
    os.rmdir(dev_dir)

# 6. Move PERMISSION_SCOPING_RULES.md
perm_src = base_dir / "Rules/CRM_WORKFLOW/PERMISSION_SCOPING_RULES.md"
perm_dest = base_dir / "Rules/SECURITY/PERMISSION_SCOPING_RULES.md"
if perm_src.exists(): shutil.move(str(perm_src), str(perm_dest))

# 7. Add README.md to ARCHIVE/FORENSIC/
with open(base_dir / "ARCHIVE/FORENSIC/README.md", "w", encoding="utf-8") as f:
    f.write("# FOR REFERENCE ONLY — NOT ACTIVE RULES\n\nTài liệu trong thư mục này chỉ lưu trữ vết tích forensic lịch sử (sập semantic, rollback...). Tuyệt đối không được AI đọc như là business rules đang hoạt động.\n")

# 8. Move Historical Forensic files to ARCHIVE/FORENSIC/
forensic_files = [
    "CUSTOMER_ASSIGNMENT_HOTFIX.md",
    "DEEP_SYSTEM_AUDIT.md",
    "REAL_ORGANIZATION_HIERARCHY_AUDIT.md",
    "SEMANTIC_PATCH_REPORT.md",
    "HIERARCHY_HOTFIX_REPORT.md"
]
for file_name in forensic_files:
    src = base_dir / f"AI_CONTEXT/{file_name}"
    if src.exists(): shutil.move(str(src), str(base_dir / f"ARCHIVE/FORENSIC/{file_name}"))

# 9. Move HIERARCHY_UX_FIX_REPORT.md
ux_src = base_dir / "AI_CONTEXT/HIERARCHY_UX_FIX_REPORT.md"
ux_dest = base_dir / "AI_CONTEXT/04_AUDITS/HIERARCHY_UX_FIX_REPORT.md"
if ux_src.exists(): shutil.move(str(ux_src), str(ux_dest))

# 10. Move Deprecated & Obsolete to ARCHIVE/DEPRECATED/
rules_archive = base_dir / "Rules/ARCHIVE"
if rules_archive.exists():
    for f in os.listdir(rules_archive):
        src = rules_archive / f
        if src.is_file(): shutil.move(str(src), str(base_dir / f"ARCHIVE/DEPRECATED/{f}"))
    os.rmdir(rules_archive)

ai_context_archive = base_dir / "AI_CONTEXT/05_ARCHIVE"
if ai_context_archive.exists():
    for root, dirs, files in os.walk(ai_context_archive):
        for f in files:
            src = Path(root) / f
            shutil.move(str(src), str(base_dir / f"ARCHIVE/DEPRECATED/{f}"))
    shutil.rmtree(ai_context_archive)

dep_files = [
    "AI_CONTEXT/SEMANTIC_CONSTITUTION_AUDIT.md",
    "AI_CONTEXT/DEEP_SYSTEM_AUDIT_SCOPE_MISMATCH.md"
]
for f in dep_files:
    src = base_dir / f
    if src.exists(): shutil.move(str(src), str(base_dir / f"ARCHIVE/DEPRECATED/{src.name}"))

# 11. Update main README.md
readme_path = base_dir / "README.md"
if readme_path.exists():
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    doc_priority = "\n## DOCUMENT PRIORITY ORDER\n\n1. `Rules/`\n2. `AI_CONTEXT/`\n3. `ARCHIVE/`\n\n> [!IMPORTANT]\n> Nếu có xung đột (conflict), **Rules là nguồn chân lý duy nhất (Single Source of Truth).**\n\n"
    
    if "DOCUMENT PRIORITY ORDER" not in content:
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(content + doc_priority)
else:
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("# KHHH - Antigravity - V3.0\n\n## DOCUMENT PRIORITY ORDER\n\n1. `Rules/`\n2. `AI_CONTEXT/`\n3. `ARCHIVE/`\n\n> [!IMPORTANT]\n> Nếu có xung đột (conflict), **Rules là nguồn chân lý duy nhất (Single Source of Truth).**\n\n")

# 12. Write a Governance Rule README for AI_CONTEXT/04_AUDITS
with open(base_dir / "AI_CONTEXT/04_AUDITS/README.md", "w", encoding="utf-8") as f:
    f.write("# AUDIT GOVERNANCE RULE\n\nFolder này CHỈ được chứa:\n- Audit active\n- Audit unresolved\n- Audit dưới 14 ngày\n\nSau khi resolved, các audit report phải được Move vào `ARCHIVE/FORENSIC`. KHÔNG được biến folder này thành bãi report tồn đọng.\n")

print("File organization completed.")
