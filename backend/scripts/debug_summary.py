import sys
import os
import pandas as pd

# Add project root to path
sys.path.append(r"d:\Antigravity - Project\KHHH - Antigravity - V3.0")

from backend.app.services.lifecycle_engine import LifecycleEngine
from backend.app.services.vip_tier_engine import VIPTierEngine
from backend.app.services.priority_engine import PriorityEngine

def debug_summary_flow(month_str):
    print(f"DEBUG: Processing {month_str}")
    ident_results = LifecycleEngine.process_month_summary(month_str)
    print(f"DEBUG: Ident results count: {len(ident_results)}")
    
    df_ident = pd.DataFrame(ident_results)
    print("DEBUG: States in df_ident before any merge:")
    print(df_ident['state'].value_counts())
    
    vip_results = VIPTierEngine.process_vip_month(month_str)
    vip_df = pd.DataFrame(vip_results) if vip_results else pd.DataFrame()
    
    if not vip_df.empty:
        df_ident = pd.merge(df_ident, vip_df[['ma_kh', 'vip_tier', 'risk_status']], on='ma_kh', how='left')
        df_ident['vip_tier'] = df_ident['vip_tier'].fillna('NORMAL')
    else:
        df_ident['vip_tier'] = 'NORMAL'
        df_ident['risk_status'] = None
        
    print("DEBUG: States in df_ident after VIP merge:")
    print(df_ident['state'].value_counts())
    
    priority_results = PriorityEngine.process_priority_month(month_str, ident_results, vip_results)
    priority_df = pd.DataFrame(priority_results) if priority_results else pd.DataFrame()

    if not priority_df.empty:
        df_ident = pd.merge(df_ident, priority_df[['ma_kh', 'priority_level']], on='ma_kh', how='left')
        df_ident['priority_level'] = df_ident['priority_level'].fillna('LOW')
    else:
        df_ident['priority_level'] = 'LOW'

    print("DEBUG: States in df_ident after Priority merge:")
    print(df_ident['state'].value_counts())
    
    stage_counts = df_ident.groupby(['point_id', 'state', 'growth', 'vip_tier', 'priority_level']).size().reset_index(name='count')
    print("DEBUG: Grouped stage counts (sample 10):")
    print(stage_counts.head(10))
    print("DEBUG: Total count by state in stage_counts:")
    print(stage_counts.groupby('state')['count'].sum())

if __name__ == "__main__":
    debug_summary_flow('2026-05')
