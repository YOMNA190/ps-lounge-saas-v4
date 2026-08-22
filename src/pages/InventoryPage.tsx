import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Product, Customer } from '@/types'
import { Plus, Minus, ShoppingCart, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'

export default function InventoryPage() {
  const { profile } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([])
  const [showCart, setShowCart] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('customers').select('*').ilike('name', `%${customerSearch}%`).limit(5)
      setCustomers(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  const loadProducts = async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select(`*,category:inventory_categories(*)`).eq('is_active', true).order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id)
      if (existing) return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { product, qty: 1 }]
    })
  }

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(c => c.product.id !== productId))
  }

  const updateQty = (productId: number, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c
      const newQty = Math.max(1, c.qty + delta)
      return { ...c, qty: newQty }
    }))
  }

  const cartTotal = cart.reduce((s, c) => s + c.product.sell_price * c.qty, 0)

  const handleCheckout = async () => {
    if (cart.length === 0) return
    try {
      const { data: sale, error: saleError } = await supabase.from('sales').insert({
        customer_id: selectedCustomer?.id || null,
        staff_id: profile?.id,
        total: cartTotal,
        branch_id: (await supabase.rpc('get_my_branch_id')).data
      }).select().single()

      if (saleError) throw saleError

      const items = cart.map(c => ({
        sale_id: sale.id,
        product_id: c.product.id,
        qty: c.qty,
        unit_price: c.product.sell_price,
        unit_cost: c.product.cost_price,
      }))

      await supabase.from('sale_items').insert(items)
      toast.success(`تم البيع بنجاح! الإجمالي: ${cartTotal.toLocaleString()} ج`)
      setCart([]); setShowCart(false); setSelectedCustomer(null)
      loadProducts()
    } catch {
      toast.error('فشل إتمام البيع')
    }
  }

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-ps-text">البضاعة</h1><p className="text-ps-muted text-sm">المنتجات والمخزون</p></div>
        <button onClick={() => setShowCart(true)} className="relative btn-primary">
          <ShoppingCart size={16} />
          {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{cart.length}</span>}
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ps-muted)' }} />
        <input className="input pr-10" placeholder="بحث في المنتجات..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--ps-blue-light)]" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <div key={p.id} className="rounded-xl p-4 card-hover" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-ps-muted">{p.category?.name} · {p.unit}</p>
                </div>
                <button onClick={() => addToCart(p)} className="btn-primary p-2"><Plus size={14} /></button>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="font-mono font-bold text-sm" style={{ color: 'var(--ps-green)' }}>{p.sell_price} ج</span>
                <span className={`text-xs font-mono ${p.stock_qty <= p.min_stock_qty ? 'text-[var(--ps-red)]' : 'text-ps-muted'}`}>{p.stock_qty} متوفر</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowCart(false)} />
          <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 animate-slide-up" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', maxHeight: '90dvh', overflow: 'auto' }}>
            <h2 className="font-bold text-lg">سلة المشتريات</h2>
            {cart.map(c => (
              <div key={c.product.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--ps-surface)' }}>
                <div className="flex-1"><p className="text-sm font-medium">{c.product.name}</p><p className="text-xs text-ps-muted">{c.product.sell_price} ج × {c.qty}</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(c.product.id, -1)} className="btn-ghost p-1"><Minus size={14} /></button>
                  <span className="font-mono text-sm w-6 text-center">{c.qty}</span>
                  <button onClick={() => updateQty(c.product.id, 1)} className="btn-ghost p-1"><Plus size={14} /></button>
                </div>
                <button onClick={() => removeFromCart(c.product.id)} className="btn-danger p-1 text-xs">حذف</button>
              </div>
            ))}
            <div className="border-t pt-3" style={{ borderColor: 'var(--ps-border)' }}>
              <div className="relative mb-3">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ps-muted)' }} />
                <input className="input pr-9 text-sm" placeholder="العميل (اختياري)..." value={selectedCustomer ? selectedCustomer.name : customerSearch} onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null) }} />
                {customers.length > 0 && !selectedCustomer && (
                  <div className="absolute top-full mt-1 w-full rounded-xl overflow-hidden z-10 shadow-2xl" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
                    {customers.map(c => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomers([]) }} className="w-full text-right px-4 py-2.5 text-sm hover:bg-[var(--ps-surface)] transition-colors">{c.name}</button>
                    ))}
                  </div>
                )}
              </div>
              <p className="font-mono font-bold text-lg mb-3">الإجمالي: {cartTotal.toLocaleString()} ج</p>
              <button onClick={handleCheckout} disabled={cart.length === 0} className="btn-primary w-full">إتمام البيع</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
