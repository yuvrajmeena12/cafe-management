import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react'
import type { CartLine, MenuItem } from '../types'

interface CartContextValue {
  lines: CartLine[]
  addItem: (item: MenuItem) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  subtotal: number
  itemCount: number
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

const CART_STORAGE_KEY = 'cafe_cart_items_v1'

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // Ignore storage write error
    }
  }, [lines])

  const addItem = useCallback((item: MenuItem) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.menu_item.id === item.id)
      if (existing) {
        return prev.map((l) =>
          l.menu_item.id === item.id ? { ...l, quantity: l.quantity + 1 } : l
        )
      }
      return [...prev, { menu_item: item, quantity: 1 }]
    })
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setLines((prev) => prev.filter((l) => l.menu_item.id !== itemId))
  }, [])

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setLines((prev) => prev.filter((l) => l.menu_item.id !== itemId))
      return
    }
    setLines((prev) =>
      prev.map((l) => (l.menu_item.id === itemId ? { ...l, quantity } : l))
    )
  }, [])

  const clearCart = useCallback(() => {
    setLines([])
    try {
      localStorage.removeItem(CART_STORAGE_KEY)
    } catch {}
  }, [])

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.menu_item.price * l.quantity, 0),
    [lines]
  )
  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines])

  const contextValue = useMemo(
    () => ({
      lines,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      subtotal,
      itemCount,
    }),
    [lines, addItem, removeItem, updateQuantity, clearCart, subtotal, itemCount]
  )

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
