# PS Lounge — سجل تحذيرات الجودة

## الحالة

ينتهي `npm run lint` حالياً بنجاح مع **40 تحذيراً** وبدون أخطاء مانعة. أُبقيت التحذيرات مرئية في إعداد ESLint؛ فهي تشير إلى أنماط موروثة في تحميل البيانات داخل `useEffect` أو حدود React Compiler، وليست تصريحاً بأن التدفقات أدناه مكتملة اختبارياً من المتصفح إلى Supabase.

| المجموعة | الملفات الحالية | الإجراء التالي |
|---|---|---|
| بحث العملاء المؤجل | `StartSessionModal`، `CreateSubscriptionModal`، `RegisterPlayerModal`، `AddToWaitlistModal` | استخراج hook بحث موحّد مع إلغاء الطلبات وempty state مشتق من عبارة البحث. |
| تحميل بيانات الصفحات | `AnalyticsPage`، `CustomersPage`، `SessionsPage`، `SubscriptionsPage`، `SettingsPage`، `PublicDisplayPage`، `PackagesPage`، `ExpensesPage`، `CustomerDetailPage`، `CustomerPortalPage` | نقل التحميل إلى hooks مستقلة أو React Query، وإلغاء الاستدعاءات عند unmount. |
| hooks التشغيلية | `useAuditLog`، `useDebts`، `useDevices`، `useHappyHour`، `useSubscriptions`، `useTournaments`، `useWaitlist`، `auth-context`، `branch-context` | توحيد نمط الاشتراك والتنظيف، ثم إعادة تفعيل شدة أخطاء React Hooks تدريجياً. |
| مكونات الواجهة | `AlertsBell`، `DeviceCard`، ومكوّنات `src/components/ui/*` | فصل الثوابت والمساعدات عن ملفات المكونات عند الحاجة، ومراجعة الاشتراكات والمؤقتات. |

> لا يزيل هذا السجل التحذيرات ولا يغيّر شدتها إلى إيقاف. الغرض منه حصر الدين التقني ليُعالج على دفعات قابلة للمراجعة قبل تسويق المشروع كمنتج إنتاجي مكتمل.
