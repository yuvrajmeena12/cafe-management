export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isValidPhone(phone: string): boolean {
  // Accepts numbers with optional +, spaces, dashes — at least 7 digits
  const digits = phone.replace(/[^\d]/g, '')
  return digits.length >= 7
}
