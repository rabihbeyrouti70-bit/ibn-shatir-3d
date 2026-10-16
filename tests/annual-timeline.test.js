import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    isLeapYear,
    getDaysInYear,
    getDayOfYear,
    getDateFromDayOfYear,
    getZodiacAndMilestone
} from '../js/astronomy-core.js';

describe('شريط التنقل بين أيام السنة والفصول (Annual Timeline & Seasons Tests)', () => {
    it('التحقق من حساب السنوات الكبيسة والعادية بدقة', () => {
        assert.strictEqual(isLeapYear(2024), true); // كبيسة
        assert.strictEqual(isLeapYear(2026), false); // عادية
        assert.strictEqual(isLeapYear(2000), true); // كبيسة المئة
        assert.strictEqual(isLeapYear(1900), false); // ليست كبيسة

        assert.strictEqual(getDaysInYear(2024), 366);
        assert.strictEqual(getDaysInYear(2026), 365);
    });

    it('حساب رقم اليوم في السنة (Day of Year) للاعتدالات والانقلابات بدقة', () => {
        const jan1 = new Date(Date.UTC(2026, 0, 1));
        assert.strictEqual(getDayOfYear(jan1), 1);

        // 21 آذار (مارس) - الاعتدال الربيعي: 31 (يناير) + 28 (فبراير) + 21 = 80
        const springEquinox = new Date(Date.UTC(2026, 2, 21));
        assert.strictEqual(getDayOfYear(springEquinox), 80);

        // 21 حزيران (يونيو) - الانقلاب الصيفي
        const summerSolstice = new Date(Date.UTC(2026, 5, 21));
        assert.strictEqual(getDayOfYear(summerSolstice), 172);

        // 23 أيلول (سبتمبر) - الاعتدال الخريفي
        const autumnEquinox = new Date(Date.UTC(2026, 8, 23));
        assert.strictEqual(getDayOfYear(autumnEquinox), 266);

        // 21 كانون الأول (ديسمبر) - الانقلاب الشتوي
        const winterSolstice = new Date(Date.UTC(2026, 11, 21));
        assert.strictEqual(getDayOfYear(winterSolstice), 355);

        // 31 كانون الأول (ديسمبر) - نهاية السنة
        const dec31 = new Date(Date.UTC(2026, 11, 31));
        assert.strictEqual(getDayOfYear(dec31), 365);
    });

    it('التحقق من صحة اليوم الكبيس 29 شباط لعام 2024', () => {
        const leapDay = new Date(Date.UTC(2024, 1, 29));
        assert.strictEqual(getDayOfYear(leapDay), 60);

        const reconstructed = getDateFromDayOfYear(60, 2024);
        assert.strictEqual(reconstructed.getUTCMonth(), 1); // February (0-indexed)
        assert.strictEqual(reconstructed.getUTCDate(), 29);
    });

    it('التحويل العكسي الدقيق من رقم اليوم إلى كائن التاريخ (Roundtrip Integrity)', () => {
        const year = 2026;
        for (let doy = 1; doy <= 365; doy += 15) {
            const dt = getDateFromDayOfYear(doy, year);
            const computedDoy = getDayOfYear(dt);
            assert.strictEqual(computedDoy, doy, `Failed roundtrip for day ${doy}`);
        }
    });

    it('تحديد المحطات الموسمية الأربع الكبرى (الاعتدالين والانقلابين)', () => {
        const spring = getZodiacAndMilestone(3, 21);
        assert.strictEqual(spring.milestone, '🌸 الاعتدال الربيعي');

        const summer = getZodiacAndMilestone(6, 21);
        assert.strictEqual(summer.milestone, '☀️ الانقلاب الصيفي');

        const autumn = getZodiacAndMilestone(9, 23);
        assert.strictEqual(autumn.milestone, '🍂 الاعتدال الخريفي');

        const winter = getZodiacAndMilestone(12, 21);
        assert.strictEqual(winter.milestone, '❄️ الانقلاب الشتوي');

        const normalDay = getZodiacAndMilestone(4, 15);
        assert.strictEqual(normalDay.milestone, '');
    });

    it('تحديد البروج الفلكية بدقة متوافقة مع التقويم الشمسي', () => {
        assert.ok(getZodiacAndMilestone(4, 1).zodiac.includes('الحمل'));
        assert.ok(getZodiacAndMilestone(5, 1).zodiac.includes('الثور'));
        assert.ok(getZodiacAndMilestone(7, 1).zodiac.includes('السرطان'));
        assert.ok(getZodiacAndMilestone(8, 1).zodiac.includes('الأسد'));
        assert.ok(getZodiacAndMilestone(1, 1).zodiac.includes('الجدي'));
        assert.ok(getZodiacAndMilestone(3, 10).zodiac.includes('الحوت'));
    });
});
