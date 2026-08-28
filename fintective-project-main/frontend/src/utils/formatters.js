/**
 * Formats a number into Indian Rupees (INR) with standard formatting
 */
export const formatCurrency = (value, isOutflow = false) => {
  let num = parseFloat(value) || 0;
  if (Math.abs(num) < 0.01) {
    num = 0;
  }
  if (num === 0) {
    return '₹0';
  }
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Math.abs(num));

  if (num < 0 || isOutflow) {
    return `-${formatted.trim()}`;
  }
  return formatted;
};

export const formatLakhs = (value) => {
  let num = parseFloat(value) || 0;
  if (Math.abs(num) < 1000) {
    return formatCurrency(num);
  }
  const lakhs = num / 100000;
  if (Math.abs(lakhs) >= 0.01) {
    return `${lakhs < 0 ? '-' : ''}₹${Math.abs(lakhs).toFixed(1)}L`;
  }
  return formatCurrency(num);
};

/**
 * Formats a date string into "MMM DD" (e.g., "2026-06-18" -> "Jun 18")
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};
