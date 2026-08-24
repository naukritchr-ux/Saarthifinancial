import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db import get_db_connection

query = """
CREATE OR REPLACE ALGORITHM=UNDEFINED DEFINER=CURRENT_USER VIEW `incentive_summary` AS 
select `il`.`employee_id` AS `employee_id`,`e`.`name` AS `employee_name`,`il`.`role` AS `role`,
year(`il`.`period_start`) AS `year`,month(`il`.`period_start`) AS `month`,
count(`il`.`id`) AS `invoice_count`,sum(`il`.`amount`) AS `total_incentive`,
sum((case when (`il`.`status` = 'accrued') then `il`.`amount` else 0 end)) AS `accrued_amount`,
sum((case when (`il`.`status` = 'paid') then `il`.`amount` else 0 end)) AS `paid_amount`,
sum((case when (`il`.`status` = 'reversed') then `il`.`amount` else 0 end)) AS `reversed_amount` 
from (`incentive_ledger` `il` join `employees` `e` on((`il`.`employee_id` = `e`.`id`))) 
group by `il`.`employee_id`,`e`.`name`,`il`.`role`,year(`il`.`period_start`),month(`il`.`period_start`)
"""

try:
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute(query)
    conn.commit()
    print("✅ View definer updated successfully!")
except Exception as e:
    print("❌ Error updating view:", str(e))
finally:
    if 'conn' in locals():
        conn.close()
