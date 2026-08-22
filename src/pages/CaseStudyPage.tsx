import { Activity, ArrowLeft, CalendarClock, CheckCircle2, CircleAlert, Clock3, Gamepad2, ReceiptText, ShieldCheck, Users } from 'lucide-react'
import { useState } from 'react'

const evidence = [
  { icon: CalendarClock, title: 'حجوزات بلا تعارض', text: 'يفحص النظام الجهاز والفرع والنافذة الزمنية قبل تثبيت الحجز.' },
  { icon: Activity, title: 'تشغيل لحظي', text: 'تتحول الجلسة من حجز إلى تشغيل ثم فاتورة وسجل وردية واضح.' },
  { icon: ShieldCheck, title: 'حدود صلاحيات', text: 'موظف الاستقبال يشغل الجلسة، بينما المدير فقط يغلق الوردية ويراجع التحليل.' },
  { icon: ReceiptText, title: 'تحصيل قابل للتدقيق', text: 'وقت اللعب والطلبات الإضافية والخصومات تسير إلى فاتورة واحدة قابلة للمراجعة.' },
]

export default function CaseStudyPage() {
  const [conflict, setConflict] = useState(false)

  return <main dir="rtl" className="min-h-screen bg-[#08101f] text-white selection:bg-cyan-300 selection:text-slate-950">
    <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_82%_18%,rgba(45,212,191,.26),transparent_30%),radial-gradient(circle_at_18%_75%,rgba(59,130,246,.22),transparent_32%)]">
      <div className="absolute inset-0 opacity-30 [background-size:42px_42px] [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-100"><Gamepad2 size={15} /> PS Lounge — Portfolio Case Study</div>
        <h1 className="max-w-4xl text-4xl font-black leading-[1.22] tracking-tight md:text-6xl">من حجز جهاز إلى <span className="text-cyan-300">تشغيل فرع كامل</span> بلا فوضى في الوقت أو التحصيل.</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">نظام إدارة صالات الألعاب يتعامل مع المشكلة الحقيقية: جهاز محجوز، جلسة بدأت، طلبات جانبية، عميل ينتظر، ووردية يجب أن تُغلق بأرقام يمكن مراجعتها.</p>
        <div className="mt-9 flex flex-wrap items-center gap-3"><a href="/login" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-200">افتح المنتج <ArrowLeft size={17} /></a><span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-slate-300"><CheckCircle2 size={16} className="text-emerald-300" /> Multi-branch ready</span><span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-slate-300"><CheckCircle2 size={16} className="text-emerald-300" /> Audit-aware</span></div>
      </div>
    </section>

    <section className="mx-auto grid max-w-6xl gap-4 px-6 py-12 md:grid-cols-2 lg:grid-cols-4">
      {evidence.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-white/10 bg-white/[.045] p-5 transition hover:-translate-y-1 hover:border-cyan-200/35"><span className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300"><Icon size={21} /></span><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></article>)}
    </section>

    <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-16 lg:grid-cols-[1.2fr_.8fr]">
      <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-7 shadow-2xl shadow-black/20"><span className="text-xs font-bold text-cyan-300">سيناريو قابل للتجربة</span><h2 className="mt-2 text-2xl font-black">حاول حجز PS5-04 في الوقت الخطأ</h2><p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">هذا ليس تنبيه واجهة فقط؛ القرار المفترض أن يُؤخذ قبل إنشاء جلسة متداخلة أو تعطيل تحصيل وردية الموظف.</p><div className="mt-7 space-y-3"><Step active number="1" title="موظف الاستقبال يختار الجهاز والوقت" text="PS5-04 · فرع العليا · 8:00 — 10:00 مساءً" /><Step problem={conflict} number="2" title={conflict ? 'تم رفض الحجز المتعارض' : 'محرك الحجز يفحص الجلسات والحجوزات'} text={conflict ? 'الجهاز مشغول بالفعل بجلسة ممتدة حتى 9:30 مساءً.' : 'يتحقق من الجهاز والفرع والحالة والنافذة الزمنية.'} /><Step solved={conflict} number="3" title="حل تشغيلي واضح بدل رسالة خطأ" text={conflict ? 'اقترح PS5-06 أو موعد 9:30 مساءً، وسجل المحاولة في Audit Log.' : 'يعرض جهازًا متاحًا أو موعدًا بديلًا للموظف.'} /></div><button onClick={() => setConflict(value => !value)} className={conflict ? 'mt-7 rounded-xl border border-cyan-300/30 px-4 py-3 text-sm font-bold text-cyan-200' : 'mt-7 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950'}>{conflict ? 'إعادة السيناريو' : 'جرّب الحجز المتعارض'}</button></article>
      <aside className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#14213b] to-[#0d172a] p-7"><span className="text-xs font-bold text-violet-300">رحلة القيمة</span><h2 className="mt-2 text-2xl font-black">جلسة واحدة، أربع طبقات تشغيل</h2><div className="mt-7 space-y-5"><Journey icon={Clock3} title="وقت" text="بدء وإيقاف وحساب مدة الجلسة." /><Journey icon={Users} title="عميل" text="ملف، باقة، رصيد، وديون إن وجدت." /><Journey icon={ReceiptText} title="تحصيل" text="لعب، منتجات، خصم، وفاتورة موحدة." /><Journey icon={CircleAlert} title="مسؤولية" text="وردية، إغلاق صندوق، وسجل تدقيق." /></div></aside>
    </section>
  </main>
}

function Step({ number, title, text, active, problem, solved }: { number: string; title: string; text: string; active?: boolean; problem?: boolean; solved?: boolean }) {
  const color = problem ? 'border-rose-300/35 bg-rose-400/10 text-rose-200' : solved ? 'border-emerald-300/35 bg-emerald-400/10 text-emerald-100' : active ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[.03] text-slate-300'
  return <div className={`flex gap-4 rounded-2xl border p-4 ${color}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/20 text-xs font-black">{number}</span><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-5 opacity-75">{text}</p></div></div>
}

function Journey({ icon: Icon, title, text }: { icon: typeof Clock3; title: string; text: string }) {
  return <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/8 text-violet-200"><Icon size={17} /></span><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{text}</p></div></div>
}
