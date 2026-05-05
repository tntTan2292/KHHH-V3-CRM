from sqlalchemy.orm import Session
from ..models import HierarchyNode

class HierarchyService:
    @staticmethod
    def get_descendant_ids_by_id(db: Session, node_id: int, include_children: bool = True):
        """Lay ID cua node hien tai, va tuy chon cac node con chau."""
        if not node_id:
            return []

        root_node = db.query(HierarchyNode).filter(HierarchyNode.id == node_id).first()
        if not root_node:
            return []

        all_ids = [root_node.id]
        if not include_children:
            return all_ids

        def find_children(parent_id):
            children = db.query(HierarchyNode).filter(HierarchyNode.parent_id == parent_id).all()
            for child in children:
                all_ids.append(child.id)
                find_children(child.id)

        find_children(root_node.id)
        return all_ids

    @staticmethod
    def get_descendant_ids(db: Session, node_code: str):
        """Lay tat ca ID của node hien tai và cac node con chau của no."""
        if not node_code:
            return []
            
        root_node = db.query(HierarchyNode).filter(
            (HierarchyNode.code == node_code) | (HierarchyNode.name == node_code)
        ).first()
        
        if not root_node:
            return []
            
        # Su dung BFS hoac DFS để tìm tat ca con chau
        all_ids = [root_node.id]
        
        def find_children(parent_id):
            children = db.query(HierarchyNode).filter(HierarchyNode.parent_id == parent_id).all()
            for child in children:
                all_ids.append(child.id)
                find_children(child.id)
                
        find_children(root_node.id)
        return all_ids

    @staticmethod
    def get_children(db: Session, node_code: str = None):
        """Lay danh sach con truc tiep cua một node."""
        if not node_code:
            return db.query(HierarchyNode).filter(HierarchyNode.parent_id == None).all()
        parent = db.query(HierarchyNode).filter(HierarchyNode.code == node_code).first()
        if not parent: return []
        return db.query(HierarchyNode).filter(HierarchyNode.parent_id == parent.id).all()

    @staticmethod
    def get_node_tree(db: Session, root_node_id: int = None):
        """
        Trả về cây thư mục. 
        - Nếu có root_node_id: Chỉ trả về cây bắt đầu từ node đó.
        - Nếu không: Trả về toàn bộ cây.
        """
        if root_node_id:
            # Chỉ lấy các node là con cháu của root_node_id (bao gồm cả nó)
            descendant_ids = HierarchyService.get_descendant_ids_by_id(db, root_node_id, include_children=True)
            all_nodes = db.query(HierarchyNode).filter(HierarchyNode.id.in_(descendant_ids)).all()
        else:
            all_nodes = db.query(HierarchyNode).all()
        
        # Build a nested structure
        nodes_dict = {n.id: {
            "id": n.id, 
            "key": n.code, 
            "title": n.name, 
            "type": n.type, 
            "parent_id": n.parent_id,
            "children": []
        } for n in all_nodes}
        
        root_nodes = []
        for n in all_nodes:
            # Nếu đang lọc theo root_node_id, thì node đó chính là root của kết quả trả về
            if root_node_id and n.id == root_node_id:
                root_nodes.append(nodes_dict[n.id])
                continue
                
            if n.parent_id and n.parent_id in nodes_dict:
                nodes_dict[n.parent_id]["children"].append(nodes_dict[n.id])
            elif not root_node_id:
                # Nếu không lọc theo root, các node không có parent hoặc parent không tồn tại trong list là root
                root_nodes.append(nodes_dict[n.id])
                
        return root_nodes
