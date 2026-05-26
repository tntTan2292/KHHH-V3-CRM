import sqlite3
import sys

conn = sqlite3.connect('data/database/khhh_v3.db')
cursor = conn.cursor()
cursor.execute('SELECT id, parent_id, name, type, code FROM hierarchy_nodes')
nodes = cursor.fetchall()
conn.close()

tree = {}
for n in nodes:
    tree[n[0]] = {'name': n[2], 'type': n[3], 'code': n[4], 'children': []}

roots = []
for n in nodes:
    if n[1] is None:
        roots.append(n[0])
    else:
        if n[1] in tree:
            tree[n[1]]['children'].append(n[0])

def print_tree(node_id, level=0):
    node = tree[node_id]
    prefix = '  ' * level + '- '
    output = f"{prefix}[{node['type']}] {node['name']} ({node['code']})\n"
    for child_id in node['children']:
        output += print_tree(child_id, level + 1)
    return output

full_output = ''
for r in roots:
    full_output += print_tree(r)

with open('tree_output_utf8.txt', 'w', encoding='utf-8') as f:
    f.write(full_output)
