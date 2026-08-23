# ملاحظات التحقق التشغيلي

## Vercel — 23 أغسطس 2026

تم التحقق أن deployment الخاص بـcommit `110aa0c` يعيد `200` وHTML مبنياً من `dist` لمسار `/login`، مع حزم JavaScript/CSS ذات أسماء مُهشّمة. لكن معاينة المتصفح للمسار نفسه كانت شاشة فارغة بلا عناصر تفاعلية. استجابة HTML تضمنت مسارات assets نسبية (`./assets/...`)، ولذلك تُراجع إعدادات `base` في Vite: على deep link مثل `/login` قد يُحل المسار إلى `/login/assets/...` بدلاً من `/assets/...` ثم يلتقطه SPA rewrite كنص HTML. هذا استنتاج تحقق مطلوب إصلاحه واختباره، وليس دليلاً على مشكلة في الـAPI.

بعد commit `b486c63` أصبحت حزم build تستخدم `/assets/...` المطلقة، وdeployment المقابل أصبح `READY`. مع ذلك، ظلّت معاينة `/login` فارغة بلا عناصر ولا console output في sandbox. بما أن HTML وassets الناتجة صارت صحيحة للمسار العميق، فالفرضية التالية التي تتطلب تحققاً هي غياب `VITE_SUPABASE_URL` أو `VITE_SUPABASE_ANON_KEY` في بيئة **Production** في Vercel وقت البناء. التطبيق يرمي خطأ مبكراً إذا لم يوجدا، ولا يجب وضع أي قيمة في Git لمعالجة ذلك.

محاولة فحص قائمة متغيرات البيئة في لوحة Vercel توقفت عند شاشة login؛ لم تُعرض أو تُدخل أي قيمة سرية. يجب أن تُراجع المستخدمة داخل **Vercel → Project Settings → Environment Variables** وجود `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` لكل من Production وPreview، ثم تعيد Git deployment. لا يمكن تأكيد وجودهما أو تعديلهما من اتصال المتصفح الحالي.
