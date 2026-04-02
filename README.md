# 🎮 PlayStation Lounge Manager — SaaS v2.0

نظام إدارة متكامل لقاعة البلايستيشن — Cloud-Native, Mobile-First, Real-Time

---

## 🚀 الميزات

- **10 أجهزة** PS4/PS5 مع تتبع الجلسات في الوقت الفعلي (Supabase Realtime)
- **توقيت Server-Side** — لا ثقة في ساعة العميل مطلقاً (anti-fraud)
- **RBAC** — Admin vs Staff مع Row Level Security
- **CRM** — قاعدة عملاء مع نقاط الولاء
- **Analytics** — رسوم بيانية للإيرادات لكل جهاز
- **إدارة المصاريف** — 54,000 جنيه ثابتة مع حساب صافي الربح تلقائياً
- **Mobile-First** — Tailwind CSS متجاوب بالكامل

---

## ⚙️ الإعداد

### 1. متطلبات النظام
- Node.js 18+
- حساب Supabase (مجاني)

### 2. إنشاء مشروع Supabase

1. اذهب إلى [supabase.com](https://supabase.com) وأنشئ مشروع جديد
2. من **SQL Editor**، شغّل ملف:
   ```
   supabase/migrations/001_initial_schema.sql
   ```
3. من **Authentication > Users**، أنشئ أول مستخدم admin

4. لجعل المستخدم admin، شغّل في SQL Editor:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = 'USER_UUID_HERE';
   ```

### 3. تثبيت المشروع

```bash
# Clone
git clone <your-repo>
cd playstation-lounge-saas

# Install dependencies
npm install

# Setup env
cp .env.example .env.local
# افتح .env.local وضع Supabase URL و Anon Key
```

### 4. تشغيل المشروع

```bash
npm run dev
```

افتح `http://localhost:5173`

---

## 🔑 متغيرات البيئة

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

⚠️ **لا تضع هذه القيم في الكود مباشرة — استخدم `.env.local` دائماً**

---

## 🏗️ هيكل المشروع

```
src/
├── components/
│   └── devices/
│       ├── DeviceCard.tsx        # كارت الجهاز مع التايمر
│       └── StartSessionModal.tsx # مودال بدء الجلسة
├── hooks/
│   ├── useDevices.ts             # Realtime device state
│   └── useDashboard.ts           # Admin summary stats
├── lib/
│   ├── supabase.ts               # Secure Supabase client
│   ├── auth-context.tsx          # RBAC Auth provider
│   ├── sessions.ts               # Server-side session logic
│   └── analytics.ts              # Analytics queries
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardLayout.tsx       # Sidebar + routing
│   ├── DevicesPage.tsx           # Grid الأجهزة
│   ├── SessionsPage.tsx          # جلسات اليوم
│   ├── CustomersPage.tsx         # CRM
│   ├── AnalyticsPage.tsx         # Charts (Admin)
│   └── ExpensesPage.tsx          # P&L (Admin)
├── types/
│   └── index.ts                  # TypeScript types + constants
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## 🔒 الأمان

| الثغرة | الحل |
|--------|-------|
| Client-side timing | كل التوقيت بـ PostgreSQL `NOW()` |
| SQL Injection | Supabase parameterized queries |
| Unauthorized access | Row Level Security (RLS) |
| API key exposure | Environment variables only |
| Staff seeing profits | RBAC — Staff لا يرى الأرقام المالية |

---

## 💰 المصاريف الثابتة (54,000 جنيه/شهر)

| البند | المبلغ |
|-------|--------|
| إيجار المحل | 21,800 جنيه |
| بضاعة / مستلزمات | 17,000 جنيه |
| صيانة | 2,200 جنيه |
| إنترنت | 1,500 جنيه |
| جمعية | 4,000 جنيه |
| مرتبات | 3,500 جنيه |
| كهرباء | 4,000 جنيه |

---

## 📱 Realtime

الأجهزة تتحدث تلقائياً عبر Supabase Realtime — أي تغيير على أي جهاز يظهر فوراً على كل الشاشات المتصلة بدون reload.

---

## 🚢 النشر

```bash
npm run build
# dist/ folder → Vercel / Netlify / Cloudflare Pages
```

في لوحة Vercel/Netlify، أضف environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
