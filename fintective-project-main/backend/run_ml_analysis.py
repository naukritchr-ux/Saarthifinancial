import os
import pymysql
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
from dotenv import load_dotenv

# Load env variables
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "siddhikanade162007")
DB_NAME = os.getenv("DB_NAME", "crm_db")

def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

def analyze_expenditure_anomalies():
    print("\n" + "="*60)
    print("TASK 1: ANOMALY DETECTION ON EXPENSES & INVOICES")
    print("="*60)
    
    conn = get_db_connection()
    try:
        # Load expenditures (filtering out header rows if any)
        query = "SELECT id, billDate, particulars, expenses, amount FROM expenditure WHERE particulars != 'particulars' AND expenses != 'expenses'"
        df_exp = pd.read_sql(query, conn)
        
        if df_exp.empty:
            print("No expenditure records found to analyze.")
            return
            
        print(f"Loaded {len(df_exp)} expenditure items.")
        df_exp['amount'] = df_exp['amount'].astype(float).fillna(0.0)
        
        # 1. Isolation Forest for Outliers
        anomalies_list = []
        categories = df_exp['expenses'].dropna().unique()
        
        for cat in categories:
            df_cat = df_exp[df_exp['expenses'] == cat].copy()
            if len(df_cat) < 5:
                continue
                
            X = df_cat[['amount']].values
            clf = IsolationForest(contamination=0.03, random_state=42)
            preds = clf.fit_predict(X)
            
            df_cat['is_anomaly'] = preds
            df_anom = df_cat[df_cat['is_anomaly'] == -1]
            anomalies_list.append(df_anom)
            
        # Plotting anomalies
        plt.figure(figsize=(10, 5))
        plt.scatter(df_exp.index, df_exp['amount'], color='#2563eb', alpha=0.6, label='Normal Expense')
        
        if anomalies_list:
            df_anom_all = pd.concat(anomalies_list)
            df_anom_all = df_anom_all.sort_values(by='amount', ascending=False)
            
            # Plot anomalies in red
            plt.scatter(df_anom_all.index, df_anom_all['amount'], color='#ef4444', s=80, edgecolors='black', zorder=5, label='Anomaly Outlier')
            
            print(f"\n[Machine Learning Outliers] Isolation Forest flagged {len(df_anom_all)} category expense anomalies:")
            for idx, row in df_anom_all.head(10).iterrows():
                print(f"  - Category: {row['expenses']} | Date: {row['billDate']} | Amount: Rs. {row['amount']:,.2f} | Particulars: {row['particulars']}")
        
        plt.title('Expenditure Amount Anomalies (Isolation Forest)')
        plt.ylabel('Amount (Rs.)')
        plt.xlabel('Record Index')
        plt.legend()
        plt.grid(True, linestyle='--', alpha=0.3)
        plt.tight_layout()
        plt.savefig('expense_anomalies.png')
        print("\n[Chart Saved] Saved expense anomalies plot as 'expense_anomalies.png'")
        
        # 2. Duplicate billing search
        duplicates = df_exp[df_exp.duplicated(subset=['billDate', 'expenses', 'amount'], keep=False)]
        duplicates = duplicates.sort_values(by=['billDate', 'expenses', 'amount'])
        if not duplicates.empty:
            print(f"\n[Potential Duplicate Billings] Found {len(duplicates)} matching transactions on same day/amount/category:")
            for idx, row in duplicates.head(10).iterrows():
                print(f"  - Date: {row['billDate']} | Rs. {row['amount']:,.2f} | Cat: {row['expenses']} | Vendor: {row['particulars']}")
                    
    finally:
        conn.close()

def perform_clustering_segmentation():
    print("\n" + "="*60)
    print("TASK 2: CLIENT & FRANCHISE SEGMENTATION (CLUSTERING)")
    print("="*60)
    
    conn = get_db_connection()
    try:
        # 1. Franchisee Clustering
        query_fran = """
            SELECT 
                e.franchiseeName AS franchise,
                COUNT(e.id) AS total_enquiries,
                SUM(CASE WHEN e.enquiryStatus = 'closed' THEN 1 ELSE 0 END) AS successful_placements,
                SUM(COALESCE(i.serviceCharges, e.bill_amount, 0)) AS total_billing_revenue,
                SUM(COALESCE(i.franchiseeShare, 0)) AS franchisee_royalty_payout
            FROM enquiries e
            LEFT JOIN invoice i ON e.id = i.enquiry_id
            WHERE e.franchiseeName IS NOT NULL AND e.franchiseeName != '' AND e.franchiseeName != 'Franchise Name'
            GROUP BY e.franchiseeName
        """
        df_fran = pd.read_sql(query_fran, conn)
        
        for col in ['total_enquiries', 'successful_placements', 'total_billing_revenue', 'franchisee_royalty_payout']:
            df_fran[col] = df_fran[col].astype(float).fillna(0.0)
        
        if not df_fran.empty and len(df_fran) >= 3:
            features = ['total_enquiries', 'successful_placements', 'total_billing_revenue', 'franchisee_royalty_payout']
            X = df_fran[features]
            
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
            df_fran['cluster'] = kmeans.fit_predict(X_scaled)
            
            cluster_revenue = df_fran.groupby('cluster')['total_billing_revenue'].mean().sort_values(ascending=False)
            labels = [
                "High-Value Leaders (Top Performers)",
                "Steady Partners (Consistent Output)",
                "At-Risk / Low-Activity Hubs"
            ]
            cluster_mapping = {}
            for i, cluster_id in enumerate(cluster_revenue.index):
                cluster_mapping[cluster_id] = labels[min(i, len(labels)-1)]
                
            df_fran['segment'] = df_fran['cluster'].map(cluster_mapping)
            
            print("\n[Franchise Clusters Summary]")
            for seg in sorted(df_fran['segment'].unique()):
                sub = df_fran[df_fran['segment'] == seg]
                print(f"\n- {seg} ({len(sub)} locations):")
                for idx, row in sub.head(10).iterrows():
                    print(f"  - {row['franchise']} | Placements: {row['successful_placements']:.0f} / {row['total_enquiries']:.0f} | Total Rev: Rs. {row['total_billing_revenue']:,.2f}")
            
            # Plot Franchise Clusters
            plt.figure(figsize=(8, 6))
            colors = {
                "High-Value Leaders (Top Performers)": "#10b981",
                "Steady Partners (Consistent Output)": "#2563eb",
                "At-Risk / Low-Activity Hubs": "#ef4444"
            }
            
            for seg, group in df_fran.groupby('segment'):
                plt.scatter(
                    group['successful_placements'], 
                    group['total_billing_revenue'] / 100000, 
                    label=seg, 
                    color=colors.get(seg, '#94a3b8'),
                    s=100, 
                    alpha=0.8, 
                    edgecolors='black'
                )
            plt.title('Franchise Hub Segments (K-Means)')
            plt.xlabel('Successful Placements Count')
            plt.ylabel('Total Billing Revenue (in Lakhs)')
            plt.legend()
            plt.grid(True, linestyle='--', alpha=0.3)
            plt.tight_layout()
            plt.savefig('franchise_segments.png')
            print("\n[Chart Saved] Saved franchise segments plot as 'franchise_segments.png'")
            
        # 2. Corporate Client/Company Clustering
        query_client = """
            SELECT 
                companyName AS client,
                COUNT(id) AS total_jobs,
                SUM(CASE WHEN enquiryStatus = 'closed' THEN 1 ELSE 0 END) AS successful_placements,
                AVG(COALESCE(`to`, 0)) AS avg_salary_offered,
                SUM(COALESCE(bill_amount, 0)) AS total_billing
            FROM enquiries
            WHERE companyName IS NOT NULL AND companyName != '' AND companyName != 'Company Name'
            GROUP BY companyName
        """
        df_client = pd.read_sql(query_client, conn)
        
        for col in ['total_jobs', 'successful_placements', 'avg_salary_offered', 'total_billing']:
            df_client[col] = df_client[col].astype(float).fillna(0.0)
        
        if not df_client.empty and len(df_client) >= 4:
            features_c = ['total_jobs', 'successful_placements', 'avg_salary_offered', 'total_billing']
            X_c = df_client[features_c]
            
            scaler_c = StandardScaler()
            X_scaled_c = scaler_c.fit_transform(X_c)
            
            kmeans_c = KMeans(n_clusters=4, random_state=42, n_init=10)
            df_client['cluster'] = kmeans_c.fit_predict(X_scaled_c)
            
            cluster_billing = df_client.groupby('cluster')['total_billing'].mean().sort_values(ascending=False)
            labels_c = [
                "Elite Clients (High-Volume Placements & Billings)",
                "Mid-Tier Consistent Buyers",
                "Niche Premium (High Average Salaries, Moderate Volume)",
                "Low-Frequency / Inactive Accounts"
            ]
            cluster_mapping_c = {}
            for i, cluster_id in enumerate(cluster_billing.index):
                cluster_mapping_c[cluster_id] = labels_c[min(i, len(labels_c)-1)]
                
            df_client['segment'] = df_client['cluster'].map(cluster_mapping_c)
            
            print("\n\n[Client Segmentation Summary (Top Categories)]")
            for seg in sorted(df_client['segment'].unique()):
                sub = df_client[df_client['segment'] == seg]
                print(f"\n- {seg} ({len(sub)} clients):")
                for idx, row in sub.head(5).iterrows():
                    print(f"  - {row['client']} | Placements: {row['successful_placements']:.0f} | Avg Salary: Rs. {row['avg_salary_offered']:,.2f} | Billing: Rs. {row['total_billing']:,.2f}")
            
            # Plot Client Clusters
            plt.figure(figsize=(8, 6))
            colors_c = {
                "Elite Clients (High-Volume Placements & Billings)": "#10b981",
                "Mid-Tier Consistent Buyers": "#2563eb",
                "Niche Premium (High Average Salaries, Moderate Volume)": "#c084fc",
                "Low-Frequency / Inactive Accounts": "#ef4444"
            }
            
            for seg, group in df_client.groupby('segment'):
                plt.scatter(
                    group['total_jobs'], 
                    group['total_billing'] / 100000, 
                    label=seg, 
                    color=colors_c.get(seg, '#94a3b8'),
                    s=80, 
                    alpha=0.7, 
                    edgecolors='black'
                )
            plt.title('Corporate Client Segments (K-Means)')
            plt.xlabel('Total Allocated Jobs Count')
            plt.ylabel('Total Billing Contribution (in Lakhs)')
            plt.legend()
            plt.grid(True, linestyle='--', alpha=0.3)
            plt.tight_layout()
            plt.savefig('client_segments.png')
            print("\n[Chart Saved] Saved client segments plot as 'client_segments.png'")
            
    finally:
        conn.close()

if __name__ == "__main__":
    analyze_expenditure_anomalies()
    perform_clustering_segmentation()
