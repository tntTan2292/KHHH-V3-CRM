import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.kpi_service import KPIService

def init_kpis():
    db = SessionLocal()
    try:
        print("Initializing Governed KPI Definitions (Hardened Formula Contract)...")
        
        # 1. SLA Compliance
        KPIService.create_definition(
            db,
            code='SLA_COMPLIANCE_RATE',
            name='Ty le Tuan thu SLA',
            description='Phan tram cac su kien va cong viec duoc xu ly trong thoi han SLA quy dinh.',
            formula_desc='(So luong SLA Dat) / (Tong so SLA Dat + Vi pham)',
            formula_config={
                "formula_type": "ratio",
                "inputs": ["SLA_MET_COUNT", "SLA_BREACHED_COUNT"],
                "calculation": "SLA_MET_COUNT / (SLA_MET_COUNT + SLA_BREACHED_COUNT)",
                "rules": {"default_value": 1.0, "precision": 4}
            },
            target=0.95
        )
        
        # 2. Task Completion
        KPIService.create_definition(
            db,
            code='TASK_COMPLETION_RATE',
            name='Ty le Hoan thanh Cong viec',
            description='Phan tram cac cong viec duoc giao da duoc hoan thanh.',
            formula_desc='(So luong Cong viec Hoan thanh) / (Tong so Cong viec duoc giao)',
            formula_config={
                "formula_type": "ratio",
                "inputs": ["TASK_COMPLETED_COUNT", "TASK_TOTAL_ASSIGNED"],
                "calculation": "TASK_COMPLETED_COUNT / TASK_TOTAL_ASSIGNED",
                "rules": {"default_value": 0.0, "precision": 4}
            },
            target=0.90
        )
        
        # 3. Customer Conversion
        KPIService.create_definition(
            db,
            code='CUSTOMER_CONVERSION_RATE',
            name='Ty le Chuyen doi Khach hang',
            description='Phan tram khach hang tiem nang chuyen sang khach hang hien huu.',
            formula_desc='(So luong KH Tiem nang thanh Hien huu) / (Tong so KH Tiem nang tiep can)',
            formula_config={
                "formula_type": "ratio",
                "inputs": ["POTENTIAL_CONVERTED_COUNT", "POTENTIAL_TOTAL_TOUCHED"],
                "calculation": "POTENTIAL_CONVERTED_COUNT / POTENTIAL_TOTAL_TOUCHED",
                "rules": {"default_value": 0.0, "precision": 4}
            },
            target=0.10
        )
        
        print("KPI Definitions initialized successfully.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_kpis()
