# اختبار Runtime لـCommand API

هذا الاختبار يعيد استخدام حساب اختبار مصرح به عبر JWT حقيقي، ولا يحتوي البريد أو كلمة المرور أو access token داخل المستودع. قبل التشغيل، يضبط المشغل متغيري `PS_LOUNGE_TEST_EMAIL` و`PS_LOUNGE_TEST_PASSWORD` في shell فقط، ثم يشغّل:

```bash
./scripts/command-api-runtime-smoke.sh
```

ينفذ السكريبت `queueDeviceCommand` من نوع `health_probe` مرتين بالـ`requestId` نفسه. يجب أن يرجع الطلبان `200` ومعرّف command واحداً، كما يجب أن يفشل إدخال expense مباشر واستدعاء `stop_session` القديم بحالة غير 2xx. لا ينفذ الأمر relay أو TV لأن dispatcher غير مهيأ.

> **خطوة قبول إلزامية:** بعد تشغيل السكريبت، يقرأ مسؤول قاعدة البيانات `command_idempotency` و`device_commands` و`outbox_events` بالـrequestId وcommandId الناتجين. القبول يتطلب صفاً واحداً في كل جدول. بعد حفظ الدليل، تُحذف الصفوف الثلاثة بالـrequestId/commandId نفسه. لا تستخدم أي بيانات اختبار في الإنتاج دون هذا التنظيف.

| الدليل | شرط القبول |
|---|---|
| استجابة Edge | `firstStatus=200` و`secondStatus=200` و`commandId` واحد. |
| حدود العميل | `directDmlStatus` و`legacyRpcStatus` غير 2xx. |
| قاعدة البيانات قبل التنظيف | صف idempotency واحد، command واحد، وoutbox event واحد فقط. |
| قاعدة البيانات بعد التنظيف | صفر صفوف مرتبطة بمعرّف الاختبار. |
