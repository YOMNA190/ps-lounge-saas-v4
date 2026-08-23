# عقد بوابة الأجهزة — PS Lounge Cloud-first

**الحالة الحالية:** يُنشئ `command-api` أوامر أجهزة في `device_commands` ورسائل تسليم في `outbox_events` داخل المعاملة نفسها. لا توجد في هذا المستودع حالياً بوابة MQTT، أو worker دائم، أو شهادة mTLS، أو تحكم فعلي في relay/TV. نتيجة الأمر الحالية تعلن صراحةً `dispatch: "not_configured"`؛ لذلك لا يجوز اعتبار إنشاء صف في قاعدة البيانات تنفيذاً عتادياً.

| طبقة العقد | ما هو منفذ الآن | ما يجب إضافته قبل التحكم الفعلي |
|---|---|---|
| قبول الأمر | Edge Command API مصادق عليه وidempotency لكل actor/request UUID | حدّ معدل مخصص للجهاز وقواعد تفويض أدق حسب الدور |
| السجل الدائم | `device_commands` و`outbox_events` في نفس معاملة الأمر | worker يطالب بـoutbox atomically ويعيد المحاولة وفق backoff |
| إرسال الرسالة | غير مهيأ | MQTT over TLS مع gateway موثوق وشهادات عميل mTLS |
| تأكيد التنفيذ | غير مهيأ | ACK/NACK موثق ورسالة health telemetry من الجهاز |
| الأثر المالي | ledger/outbox لا يفترضان نجاح العتاد | لا تتغير الفاتورة أو الجلسة إلا من أمر تجاري مستقل ومراجع |

## حدود الثقة

> **قاعدة النظام:** المتصفح لا يرسل إلى broker ولا يكتب في `device_commands` مباشرة. يرسل command DTO إلى Edge Function، والتي تتحقق من JWT ثم تفوض SQL command server-side. بوابة الأجهزة، حين تُنفذ، لا تتلقى أوامر إلا من broker باسم خدمة مقيد بفرع وجهاز محددين.

يجب أن يبقى `device_commands` سجل النية التجارية، بينما يكون الـACK الصادر من البوابة دليلاً منفصلاً على محاولة التنفيذ العتادي. لا ينبغي لحالة `queued` أن تظهر للموظف على أنها «تم تشغيل الجهاز»، ولا ينبغي للـACK وحده أن يعدّل قيود مالية أو يغلق جلسة.

| الحالة | المالك المقترح | المعنى |
|---|---|---|
| `queued` | Command API | تم التحقق من الأمر وتثبيته مع outbox event، ولم يُرسل بعد إلى gateway. |
| `dispatched` | Outbox worker | نُشرت رسالة واحدة للبروكر؛ لا تعني أن الجهاز نفذها. |
| `acknowledged` | Gateway/ACK consumer | ردت البوابة بـACK موقع أو موثوق لمعرف الأمر نفسه. |
| `failed` | Worker أو ACK consumer | فشل نشر/رفض gateway/انتهت المهلة، مع سبب قابل للتدقيق. |
| `expired` | Worker | تجاوز الأمر نافذة التنفيذ المسموحة دون ACK. |

## مسارات MQTT المقترحة — غير مفعلة بعد

يُستخدم `commandId` كمعرف الرسالة النهائي، ولا يُعاد توليد UUID عند retry. هذه الصيغة مقترحة لتفادي تداخل فروع متعددة على gateway واحدة:

```text
pslounge/v1/organizations/{organizationId}/branches/{branchId}/devices/{deviceId}/commands/{commandId}
pslounge/v1/organizations/{organizationId}/branches/{branchId}/devices/{deviceId}/acks/{commandId}
pslounge/v1/organizations/{organizationId}/branches/{branchId}/devices/{deviceId}/telemetry
```

```json
{
  "commandId": "uuid",
  "type": "power_on",
  "issuedAt": "2026-08-23T12:00:00.000Z",
  "expiresAt": "2026-08-23T12:00:30.000Z",
  "attempt": 1,
  "payload": {},
  "traceId": "uuid"
}
```

```json
{
  "commandId": "uuid",
  "status": "acknowledged",
  "gatewayId": "gateway-branch-01",
  "receivedAt": "2026-08-23T12:00:01.000Z",
  "executedAt": "2026-08-23T12:00:02.000Z",
  "errorCode": null
}
```

## متطلبات Worker والبوابة قبل التفعيل

الـworker الدائم يقرأ فقط أحداث `outbox_events` غير المنشورة باستخدام claim ذري، ثم يرسل الرسالة ويعلّم الحدث منشوراً بعد نجاح broker publish. عند الشبكة المتقطعة يعيد المحاولة بخطة exponential backoff وحد أقصى محدد، ويحوّل الحالات المستنفدة إلى `failed` أو `expired`. يجب أن يكون consumer الخاص بالـACK idempotent حسب `commandId`، وأن يحتفظ بسبب الفشل دون حذف السجل.

| ضابط مطلوب | قرار تنفيذ مطلوب |
|---|---|
| هوية القناة | شهادة mTLS فريدة لكل gateway مع ACL يمنعها من نشر/الاشتراك خارج organization/branch الخاص بها. |
| سلامة الرسائل | TLS، حد حجم payload، allow-list لأنواع الأمر، وانتهاء صلاحية قصير للأمر. |
| منع التكرار | `commandId` فريد، والـgateway تحفظ آخر أوامر منفذة ضمن نافذة زمنية. |
| قابلية المراجعة | ربط `traceId` بين command/outbox/publish/ACK واحتفاظ immutable بسجل المحاولات. |
| سلامة التشغيل | relay controller fail-safe، interlock محلي، ورفض أوامر power المتعارضة قبل التنفيذ. |

## معيار الجاهزية

لا ينتقل النظام إلى «IoT متصل» إلا بعد وجود broker قابل للإدارة، gateway hardware محددة، worker مراقب، وسياسة ACK/timeout مطبقة، واختبار end-to-end على جهاز غير إنتاجي. حتى ذلك الوقت يبقى هذا العقد **Cloud-first data contract فقط** ولا يُعلن تحكماً فعلياً في PlayStation أو TV أو relay.
