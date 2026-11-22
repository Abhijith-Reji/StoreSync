/**
 * Formats a number to Indian Rupee (₹) currency style: ₹1,20,425.00
 */
export function formatINR(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '₹0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';

  const parts = num.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  const isNegative = integerPart.startsWith('-');
  if (isNegative) integerPart = integerPart.substring(1);

  // Indian number grouping: last 3 digits, then every 2 digits
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }

  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const result = `₹${isNegative ? '-' : ''}${formattedInteger}.${decimalPart}`;
  return result;
}

/**
 * Formats quantities with Indian comma separation
 */
export function formatQuantity(qty: number | undefined | null): string {
  if (qty === undefined || qty === null) return '0';
  return qty.toLocaleString('en-IN');
}
