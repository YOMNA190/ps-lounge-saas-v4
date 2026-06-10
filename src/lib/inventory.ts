import { supabase } from '@/lib/supabase'
import { Product, InventoryCategory, Sale, SaleItem } from '@/types'

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select(`*,category:inventory_categories(*)`).eq('is_active', true).order('name')
  if (error) throw error
  return data || []
}

export async function getCategories(): Promise<InventoryCategory[]> {
  const { data, error } = await supabase.from('inventory_categories').select('*').order('name')
  if (error) throw error
  return data || []
}

export async function createSale(sale: Omit<Sale, 'id' | 'created_at'>, items: Omit<SaleItem, 'id' | 'subtotal'>[]): Promise<Sale> {
  const { data: saleData, error: saleError } = await supabase.from('sales').insert(sale).select().single()
  if (saleError) throw saleError
  const saleItems = items.map(i => ({ ...i, sale_id: saleData.id }))
  const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
  if (itemsError) throw itemsError
  return saleData
}
