import { describe, it, expect } from 'vitest'
import {
  isValidEmail,
  isValidPhone,
  isValidName,
  isValidPassword,
  getPasswordStrength,
  isValidUrl,
  isValidImageUrl,
  sanitizeErrorMessage,
} from '../validation'

describe('validation.ts utilities', () => {
  describe('isValidEmail', () => {
    it('accepts valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name+tag@sub.domain.co.in')).toBe(true)
      expect(isValidEmail('customer_123@cafe.org')).toBe(true)
    })

    it('rejects empty or whitespace-only emails', () => {
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('   ')).toBe(false)
    })

    it('rejects malformed email formats', () => {
      expect(isValidEmail('plainaddress')).toBe(false)
      expect(isValidEmail('@missinguser.com')).toBe(false)
      expect(isValidEmail('missingdomain@.com')).toBe(false)
      expect(isValidEmail('missingdot@domain')).toBe(false)
      expect(isValidEmail('double@@domain.com')).toBe(false)
    })

    it('rejects emails exceeding 254 characters', () => {
      const longEmail = 'a'.repeat(250) + '@test.com'
      expect(isValidEmail(longEmail)).toBe(false)
    })
  })

  describe('isValidPhone', () => {
    it('accepts 10 to 15 digits phone numbers with various formatting', () => {
      expect(isValidPhone('9876543210')).toBe(true)
      expect(isValidPhone('+91 98765 43210')).toBe(true)
      expect(isValidPhone('+1-800-555-0199')).toBe(true)
      expect(isValidPhone('(123) 456-7890')).toBe(true)
    })

    it('rejects numbers with fewer than 10 digits', () => {
      expect(isValidPhone('123456789')).toBe(false)
      expect(isValidPhone('')).toBe(false)
    })

    it('rejects numbers with more than 15 digits', () => {
      expect(isValidPhone('1234567890123456')).toBe(false)
    })
  })

  describe('isValidName', () => {
    it('accepts names between 2 and 100 characters', () => {
      expect(isValidName('Jo')).toBe(true)
      expect(isValidName('Saffron & Sage Cafe')).toBe(true)
      expect(isValidName('   Alex Smith   ')).toBe(true) // trimmed length >= 2
    })

    it('rejects names shorter than 2 characters after trimming', () => {
      expect(isValidName('')).toBe(false)
      expect(isValidName('A')).toBe(false)
      expect(isValidName('   A   ')).toBe(false)
    })

    it('rejects names longer than 100 characters', () => {
      expect(isValidName('A'.repeat(101))).toBe(false)
    })
  })

  describe('isValidPassword', () => {
    it('validates compliant passwords with all requirements', () => {
      const result = isValidPassword('Secret123')
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('detects missing rules and reports individual errors', () => {
      const shortPw = isValidPassword('Ab1')
      expect(shortPw.valid).toBe(false)
      expect(shortPw.errors).toContain('At least 6 characters')

      const noUpper = isValidPassword('secret123')
      expect(noUpper.valid).toBe(false)
      expect(noUpper.errors).toContain('One uppercase letter')

      const noLower = isValidPassword('SECRET123')
      expect(noLower.valid).toBe(false)
      expect(noLower.errors).toContain('One lowercase letter')

      const noNumber = isValidPassword('SecretPassword')
      expect(noNumber.valid).toBe(false)
      expect(noNumber.errors).toContain('One number')
    })

    it('flags passwords exceeding bcrypt limit of 72 characters', () => {
      const longPw = 'A1b' + 'x'.repeat(75)
      const res = isValidPassword(longPw)
      expect(res.valid).toBe(false)
      expect(res.errors).toContain('Maximum 72 characters (bcrypt limit)')
    })
  })

  describe('getPasswordStrength', () => {
    it('returns score 0 for empty password', () => {
      const strength = getPasswordStrength('')
      expect(strength.score).toBe(0)
      expect(strength.label).toBe('')
      expect(strength.color).toBe('bg-sage-200')
    })

    it('returns Weak for minimal passwords', () => {
      const strength = getPasswordStrength('abc')
      expect(strength.score).toBeLessThanOrEqual(1)
      expect(strength.label).toBe('Weak')
      expect(strength.color).toBe('bg-red-400')
    })

    it('calculates higher scores as criteria are met', () => {
      const strong = getPasswordStrength('Password123')
      expect(strong.score).toBeGreaterThanOrEqual(4)

      const excellent = getPasswordStrength('P@ssw0rd!Long2024')
      expect(excellent.score).toBe(5)
      expect(excellent.label).toBe('Excellent')
      expect(excellent.color).toBe('bg-emerald-500')
    })
  })

  describe('isValidUrl', () => {
    it('accepts valid http and https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://localhost:5173/menu')).toBe(true)
      expect(isValidUrl('https://sub.domain.org/image.png?v=1')).toBe(true)
    })

    it('rejects invalid URL protocols and non-URLs', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false)
      expect(isValidUrl('javascript:alert(1)')).toBe(false)
      expect(isValidUrl('not-a-url')).toBe(false)
      expect(isValidUrl('')).toBe(false)
    })
  })

  describe('isValidImageUrl', () => {
    it('accepts valid https URLs for images and CDNs', () => {
      expect(isValidImageUrl('https://example.com/photo.jpg')).toBe(true)
      expect(isValidImageUrl('https://example.com/image.png')).toBe(true)
      expect(isValidImageUrl('https://example.com/pic.webp')).toBe(true)
      expect(isValidImageUrl('https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress')).toBe(true)
      expect(isValidImageUrl('https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-1.2.1')).toBe(true)
      expect(isValidImageUrl('https://xyz.supabase.co/storage/v1/object/public/cafe-images/menu-items/abc.jpg')).toBe(true)
    })

    it('accepts legitimate relative paths starting with /', () => {
      expect(isValidImageUrl('/assets/coffee.png')).toBe(true)
      expect(isValidImageUrl('/images/logo.webp')).toBe(true)
    })

    it('rejects insecure http URLs to prevent Mixed Content errors and MITM', () => {
      expect(isValidImageUrl('http://example.com/photo.jpg')).toBe(false)
      expect(isValidImageUrl('http://images.pexels.com/photos/302899.jpg')).toBe(false)
    })

    it('rejects dangerous pseudo-protocols (javascript:, data:, vbscript:)', () => {
      expect(isValidImageUrl('javascript:alert(1)')).toBe(false)
      expect(isValidImageUrl('javascript:/*--></title></style>*/<script>alert(1)</script>')).toBe(false)
      expect(isValidImageUrl('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+')).toBe(false)
      expect(isValidImageUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false)
      expect(isValidImageUrl('vbscript:msgbox("test")')).toBe(false)
      expect(isValidImageUrl('file:///etc/passwd')).toBe(false)
    })

    it('rejects SVG URLs to eliminate SVG-based XSS vectors', () => {
      expect(isValidImageUrl('https://example.com/logo.svg')).toBe(false)
      expect(isValidImageUrl('https://example.com/icon.SVG')).toBe(false)
      expect(isValidImageUrl('https://example.com/image.svg?token=secret')).toBe(false)
      expect(isValidImageUrl('https://example.com/vector.svg#fragment')).toBe(false)
      expect(isValidImageUrl('/assets/icon.svg')).toBe(false)
    })

    it('rejects malformed, empty, or non-string inputs', () => {
      expect(isValidImageUrl('')).toBe(false)
      expect(isValidImageUrl('   ')).toBe(false)
      expect(isValidImageUrl(null as any)).toBe(false)
      expect(isValidImageUrl(undefined as any)).toBe(false)
      expect(isValidImageUrl('not a url at all')).toBe(false)
    })
  })

  describe('sanitizeErrorMessage', () => {
    it('returns default fallback when message is null or undefined', () => {
      expect(sanitizeErrorMessage(undefined)).toBe('Something went wrong. Please try again.')
      expect(sanitizeErrorMessage(null, 'Custom fallback')).toBe('Custom fallback')
    })

    it('masks internal database or server error patterns', () => {
      const fallback = 'Something went wrong. Please try again.'
      expect(sanitizeErrorMessage('duplicate key value violates unique constraint "users_email_key"')).toBe(fallback)
      expect(sanitizeErrorMessage('PGRST116: JSON object requested, multiple rows returned')).toBe(fallback)
      expect(sanitizeErrorMessage('Postgres error: relation "orders" does not exist')).toBe(fallback)
      expect(sanitizeErrorMessage('Error at /home/node/node_modules/something')).toBe(fallback)
      expect(sanitizeErrorMessage('Internal Server Error')).toBe(fallback)
      expect(sanitizeErrorMessage('supabase edge function failed')).toBe(fallback)
    })

    it('passes safe user-facing error messages untouched', () => {
      const safeMsg = 'Invalid email or password.'
      expect(sanitizeErrorMessage(safeMsg)).toBe(safeMsg)

      const safeMsg2 = 'Please select a delivery address.'
      expect(sanitizeErrorMessage(safeMsg2)).toBe(safeMsg2)
    })
  })
})
