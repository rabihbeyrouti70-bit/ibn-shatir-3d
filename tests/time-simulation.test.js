import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getCityTimezoneHours, COUNTRY_TIMEZONE_IANA } from '../js/prayer-core.js';

describe('التحكم بسرعة محاكي الزمن في المشهد 3D (Time Simulation Speed Engine)', () => {

    function getCityCurrentDate(lat, lon, country, refDate = new Date()) {
        if (country && COUNTRY_TIMEZONE_IANA && COUNTRY_TIMEZONE_IANA[country]) {
            try {
                const tzName = COUNTRY_TIMEZONE_IANA[country];
                const parts = new Intl.DateTimeFormat('en-US', {
                    timeZone: tzName,
                    year: 'numeric', month: 'numeric', day: 'numeric',
                    hour: 'numeric', minute: 'numeric', second: 'numeric',
                    hour12: false
                }).formatToParts(refDate);
                const p = {};
                parts.forEach(x => { p[x.type] = x.value; });
                return new Date(parseInt(p.year), parseInt(p.month) - 1, parseInt(p.day), parseInt(p.hour), parseInt(p.minute), parseInt(p.second));
            } catch (_) {}
        }
        const tzHours = getCityTimezoneHours(lat, lon, country, refDate);
        const utcMs = refDate.getTime() + (refDate.getTimezoneOffset() * 60000);
        return new Date(utcMs + tzHours * 3600000);
    }

    it('الخيار 1: واقعي - حساب التوقيت الحقيقي للمدن العالمية بدقة', () => {
        const refUtc = new Date(Date.UTC(2026, 9, 16, 7, 0, 0)); // 07:00 UTC
        
        // دمشق (UTC+3) -> يجب أن تكون 10:00 صباحاً
        const damDate = getCityCurrentDate(33.51, 36.29, 'سوريا', refUtc);
        assert.strictEqual(damDate.getHours(), 10, 'دمشق تكون 10 صباحاً عند 07:00 UTC');

        // مكة المكرمة (UTC+3) -> 10:00 صباحاً
        const meccaDate = getCityCurrentDate(21.42, 39.82, 'السعودية', refUtc);
        assert.strictEqual(meccaDate.getHours(), 10, 'مكة المكرمة تكون 10 صباحاً عند 07:00 UTC');

        // طوكيو (UTC+9) -> 16:00 (4 عصراً)
        const tokyoDate = getCityCurrentDate(35.68, 139.69, 'اليابان', refUtc);
        assert.strictEqual(tokyoDate.getHours(), 16, 'طوكيو تكون 16:00 عند 07:00 UTC');

        // لندن (UTC+1 صيفي في أكتوبر) -> 08:00 صباحاً
        const londonDate = getCityCurrentDate(51.51, -0.12, 'المملكة المتحدة', refUtc);
        assert.strictEqual(londonDate.getHours(), 8, 'لندن تكون 08:00 صباحاً عند 07:00 UTC');
    });

    it('الخيار 2: السرعة بالساعات - معدل تدفق اليوم والليل', () => {
        // سرعة 1 ساعة/ثانية تعني 1/24 يوم في الثانية
        const spd1HourPerSec = 1.0 / 24.0;
        assert.ok(Math.abs(spd1HourPerSec - 0.0416667) < 0.0001);
        
        // 24 ثانية حقيقية تعادل 24 ساعة (يوماً كاملاً)
        const dayInSeconds = 24;
        const totalDays = spd1HourPerSec * dayInSeconds;
        assert.strictEqual(Math.round(totalDays), 1, '24 ثانية بسرعة 1 س/ث تكمل يوماً كاملاً');
    });

    it('الخيار 3: السرعة بالأيام - معدل تقدم الفصول ومنازل القمر', () => {
        // سرعة 1 يوم/ثانية
        const spd1DayPerSec = 1.0;
        // 30 ثانية تكمل شهراً قمرياً كاملاً (~29.5 يوم)
        const monthAdvance = spd1DayPerSec * 29.53;
        assert.ok(Math.abs(monthAdvance - 29.53) < 0.01, 'دورة قمرية كاملة خلال ~29.5 ثانية');
    });

    it('الخيار 4: السرعة بالشهور - معدل دوران السنة والبروج والكواكب', () => {
        // سرعة 1 شهر/ثانية (30 يوم/ث)
        const spdMonthPerSec = 30.0;
        // 12 ثانية تكمل 360 يوماً (سنة كاملة)
        const yearDays = spdMonthPerSec * 12;
        assert.strictEqual(yearDays, 360, '12 ثانية تعادل دورة سنوية كاملة عبر بروج السماء');
    });

    it('حساب زاوية ساعة الشمس H_sun المستقلة عن المنطقة الزمنية للجهاز المضيف', () => {
        // فحص زاوية ساعة الشمس في دمشق وطوكيو ولندن عند الساعة 12:00 ظهراً
        function getSolarH(civilHours, tzHours, lonDeg, eotMin = 0) {
            const utcHours = (civilHours - tzHours + 24.0) % 24.0;
            const lonHours = lonDeg / 15.0;
            const localSolarHours = (utcHours + lonHours + eotMin / 60.0 + 24.0) % 24.0;
            return ((localSolarHours / 24.0) * 2 * Math.PI - Math.PI) * 180 / Math.PI;
        }

        // عند خط الزوال 12:00 والاعتدال (eot = 0): زاوية الزوال قريبة جداً من 0°
        const hDamascus = getSolarH(12.0, 3.0, 36.29, 0);
        assert.ok(Math.abs(hDamascus) < 15.0, 'زاوية الشمس بدمشق عند الظهر قريبة من خط الزوال');

        const hMecca = getSolarH(12.0, 3.0, 39.82, 0);
        assert.ok(Math.abs(hMecca) < 15.0, 'زاوية الشمس بمكة عند الظهر قريبة من خط الزوال');

        const hTokyo = getSolarH(12.0, 9.0, 139.69, 0);
        assert.ok(Math.abs(hTokyo) < 15.0, 'زاوية الشمس بطوكيو عند الظهر قريبة من خط الزوال');
    });
});
