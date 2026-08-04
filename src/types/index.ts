export type UserRole = 'customer' | 'staff' | 'admin' | 'delivery'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  role: UserRole
  whatsapp_opt_in: boolean
  vehicle_type: string | null
  vehicle_number: string | null
  vehicle_insurance_expiry: string | null
}

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  cost_price: number
  image_url: string
  category: string
  calories: number | null
  tags: string[]
  is_popular: boolean
  is_available: boolean
  prep_time_minutes: number
}

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'
export type OrderType = 'dine_in' | 'pickup' | 'delivery'

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  menu_item?: MenuItem
  quantity: number
  unit_price: number
  notes: string | null
}

export interface Order {
  id: string
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  status: OrderStatus
  order_type: OrderType
  delivery_lat: number | null
  delivery_lng: number | null
  delivery_address: string | null
  subtotal: number
  discount_amount: number
  tax: number
  delivery_charge: number
  total: number
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  payment_method: 'online' | 'cod'
  payment_id: string | null
  razorpay_order_id: string | null
  assigned_delivery_id: string | null
  delivery_rating: number | null
  delivered_at: string | null
  delivery_stage: 'assigned' | 'picked_up' | 'on_the_way' | 'reached' | 'delivered' | null
  is_cash_deposited: boolean
  placed_at: string
  items?: OrderItem[]
}

export interface DeliveryChargeTier {
  id: string
  max_km: number
  charge: number
}

export interface GalleryPhoto {
  id: string
  image_url: string
  caption: string | null
  sort_order: number
}

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  unit: string
  min_level: number
  cost_per_unit: number
}

export interface StaffMember {
  id: string
  name: string
  role: string
  phone: string
  email: string
  shift: string
  monthly_salary: number
  active: boolean
}

export interface Expense {
  id: string
  category: string
  amount: number
  note: string
  date: string
}

export interface Discount {
  id: string
  code: string
  type: 'percent' | 'flat'
  value: number
  min_order_value: number
  valid_from: string
  valid_to: string
  applicable_items: string[] | null
  active: boolean
}

export interface Review {
  id: string
  customer_id: string
  order_id: string
  menu_item_id: string | null
  rating: number
  comment: string
  category: 'Late Delivery' | 'Cold Food' | 'Packaging Issue' | 'Taste' | 'Other' | null
  created_at: string
}

export interface CafeSettings {
  id: number
  cafe_name: string
  tagline: string
  logo_url: string
  hero_image_url: string
  about_text: string
  phone: string
  email: string
  address: string
  address_lat: number | null
  address_lng: number | null
  facebook_url: string
  instagram_url: string
  twitter_url: string
}

export interface CartLine {
  menu_item: MenuItem
  quantity: number
}
