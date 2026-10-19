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
  if (Math.abs(num) < 10000) {
    return formatCurrency(num);
  }
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  // Format as Crores if >= 1 Crore (10,000,000)
  if (absNum >= 10000000) {
    const crores = absNum / 10000000;
    return `${sign}₹${crores.toFixed(2)} Cr`;
  }

  // Format as Lakhs if >= 1 Lakh (100,000)
  if (absNum >= 100000) {
    const lakhs = absNum / 100000;
    return `${sign}₹${lakhs.toFixed(2)}L`;
  }

  // Format as Thousands (e.g. ₹45K)
  const thousands = absNum / 1000;
  return `${sign}₹${thousands.toFixed(1)}K`;
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
