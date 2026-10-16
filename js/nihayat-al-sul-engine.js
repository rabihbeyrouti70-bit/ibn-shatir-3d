/**
 * 🔭 nihayat-al-sul-engine.js
 * المحرك العلمي والهندسي المحقق لكتاب «نهاية السول في تصحيح الأصول»
 * لابن الشاطر الدمشقي (704 - 777 هـ / 1304 - 1375 م)
 *
 * يتضمن:
 * 1. التحويل الستيني وحساب الجُمَّل الفلكي (Sexagesimal & Abjad Notation)
 * 2. الثوابت الرصدية المحققة عند ابن الشاطر (الميل الأعظم 23°31'، حركة الثوابت 1°/70 سنة، حركة الأوجات 1°/60 سنة)
 * 3. الهندسة المتجهية الدقيقة لأفلاك الشمس الأربعة (الشامل، الممثل، الحامل، المدير)
 * 4. الهندسة المتجهية الدقيقة لأفلاك القمر الأربعة (الممثل، المائل، التدوير الأول، التدوير الثاني)
 * 5. الهندسة المتجهية الدقيقة للكواكب الخمسة شاملة مزدوجة الطوسي في عطارد (المحيط والحافظ)
 * 6. حسابات الأكر المجسمة التامة المتماسة (المحدب والمقعر والسمك) بلا خلاء ولا خرق
 * 7. حسابات عروض الكواكب (الفصلان 24 و25) والوقوف والرجوع (الفصل 26)
 * 8. منظومة الأبعاد والأجرام الكونية بأنصاف أقطار الأرض (الفصل 31 - الخاتمة)
 * 9. خواص الآفاق الخمسة في المعمورة (الباب الثاني من نهاية السول)
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. حساب الجُمَّل والتحويل الستيني (Sexagesimal & Abjad Numerals)
// ═══════════════════════════════════════════════════════════════════════════

const ABJAD_TENS = ['', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص'];
const ABJAD_UNITS = ['', 'أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط'];
const ABJAD_HUNDREDS = ['', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ'];

/**
 * تحويل عدد صحيح (0..999) إلى حروف الجُمَّل الفلكية كما في المخطوطات
 */
export function intToAbjad(n) {
    n = Math.round(Math.abs(n));
    if (n === 0) return '٠'; // رمز الصفر في الأزياج
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const t = Math.floor(rem / 10);
    const u = rem % 10;
    let res = '';
    if (h > 0 && h < ABJAD_HUNDREDS.length) res += ABJAD_HUNDREDS[h];
    if (t > 0) res += ABJAD_TENS[t];
    if (u > 0) {
        // وصل الحروف في الجُمَّل الفلكي (مثل سج، كه، نو، له)
        const uChar = (t > 0 && u === 5) ? 'ه' : ABJAD_UNITS[u];
        res += uChar;
    }
    return res || '٠';
}

/**
 * تحويل قيمة عشرية إلى تدوين ستيني مع حروف الجُمَّل
 * مثال: 63.4167 -> { deg: 63, min: 25, sec: 0, sexagesimal: "63;25,00", abjad: "سج كه" }
 */
export function toSexagesimal(val, includeSeconds = false) {
    const sign = val < 0 ? '-' : '';
    const abs = Math.abs(val);
    let deg = Math.floor(abs + 1e-9);
    let remMin = (abs - deg) * 60;
    let min = Math.floor(remMin + 1e-7);
    let sec = Math.round((remMin - min) * 60);
    if (sec >= 60) { sec -= 60; min += 1; }
    if (min >= 60) { min -= 60; deg += 1; }

    const pad = (x) => String(x).padStart(2, '0');
    const sexagesimal = includeSeconds
        ? `${sign}${deg};${pad(min)},${pad(sec)}`
        : `${sign}${deg};${pad(min)}`;
    const degMinStr = includeSeconds
        ? `${sign}${deg}° ${pad(min)}′ ${pad(sec)}″`
        : `${sign}${deg}° ${pad(min)}′`;
    const abjad = includeSeconds && sec > 0
        ? `${intToAbjad(deg)} ${intToAbjad(min)} ${intToAbjad(sec)}`
        : `${intToAbjad(deg)} ${intToAbjad(min)}`;
    const abjadShort = `${intToAbjad(deg)} ${intToAbjad(min)}`;

    return {
        deg, min, sec,
        parts: deg, minutes: min, seconds: sec,
        sexagesimal,
        sexaShort: `${sign}${deg};${pad(min)}`,
        sexaFull: `${sign}${deg};${pad(min)},${pad(sec)}`,
        degMinStr,
        abjad,
        abjadShort
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. الثوابت الرصدية المحققة عند ابن الشاطر في «نهاية السول»
// ═══════════════════════════════════════════════════════════════════════════

export const SHATIR_CONSTANTS = {
    // الميل الأعظم لمنطقة البروج (الفصل 2 ص 49 والفصل 3 ص 55): 23° 31' (كج لا)
    OBLIQUITY_DEG: 23 + 31 / 60, // 23.5166667°
    OBLIQUITY_RAD: (23 + 31 / 60) * Math.PI / 180,

    // حركة الفلك الثامن (فلك الثوابت - الفصل 5 ص 73): درجة كل 70 سنة فارسية
    PRECESSION_DEG_PER_PERSIAN_YEAR: 1 / 70,
    PRECESSION_DEG_PER_DAY: 1 / (70 * 365),

    // حركة الأوجات في الفلك الشامل والممثلات (الفصل 6 ص 81 والفصل 7 ص 87): درجة كل 60 سنة فارسية
    APOGEE_DEG_PER_PERSIAN_YEAR: 1 / 60,
    APOGEE_DEG_PER_DAY: 1 / (60 * 365), // 9 ثوالث و51 رابعة و47 خامسة في اليوم

    // المبدأ الرصدي لابن الشاطر بدمشق: أول سنة 701 ليزدجرد (الثلاثاء نصف النهار بدمشق)
    EPOCH_YAZDGARD_701_JD: 2207543.0,
    DAMASCUS_LAT: 33.50, // 33° 30'
    DAMASCUS_LON: 36.30
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. نموذج الشمس عند ابن الشاطر (الفصل السابع، ص 85 - 102)
// ═══════════════════════════════════════════════════════════════════════════

export const SHATIR_SOLAR_MODEL = {
    R_shamil_outer: 68.0,          // محدب الفلك الشامل: 68;00 (سح)
    R_shamil_inner: 67 + 17 / 60,  // مقعر الفلك الشامل ومحدب الممثل: 67;17 (سز يز)
    shamil_thickness: 43 / 60,     // سمك الفلك الشامل: 0;43 (مج دقيقة)
    R_parecliptic: 60.0,           // نصف قطر منطقة الفلك الممثل: 60;00 (س)
    r1_hamil: 4 + 37 / 60,         // نصف قطر فلك الحامل: 4;37 (د لز)
    r2_mudir: 2 + 30 / 60,         // نصف قطر فلك المدير: 2;30 (ب ل)
    r_sun_body: 1 / 6,             // نصف قطر جرم الشمس بالأجزاء الفلكية: 0;10 (سدس جزء)
    apogee_dist: 67 + 7 / 60,      // أبعد بعد مركز الشمس: 67;07 (سز ز)
    perigee_dist: 52 + 53 / 60,    // أقرب قرب مركز الشمس: 52;53 (نب نج)
    quad_shift: 2 + 7 / 60,        // فضل الحامل على المدير (عند التربيعين): 2;07 (ب ز)
    max_equation_deg: 2 + 2 / 60 + 6 / 3600, // غاية التعديل: 2° 02' 06" عند مركز 3 بروج و7 درجات (97°)
    solidSpheres: {
        shamilOuter: 68.0,
        shamilInner: 67 + 17 / 60,
        mumathilOuter: 67 + 17 / 60,
        mumathilInner: 52 + 43 / 60,
        pareclipticConvex: 67 + 17 / 60, // 67;17
        pareclipticConcave: 52 + 43 / 60, // 52;43 (مع زيادة السدس من داخل وخارج)
        hamilSphereRadius: 7 + 17 / 60,   // نصف قطر كرة الحامل المجسمة: 7;17 (قطرها 14;34)
        mudirSphereRadius: 2 + 40 / 60    // نصف قطر كرة المدير المجسمة: 2;40 (درجتان ونصف وسدس)
    }
};

/**
 * حساب الموضع الهندسي الدقيق للشمس عند ابن الشاطر وبطلميوس لزاوية مركز alphaRad
 * في هذا الإطار: خط الأوج ينطبق على المحور +X (الزاوية 0)
 * @param {number} alphaRad زاوية مركز الشمس (البعد عن الأوج بالراديان)
 * @returns {object} الإحداثيات والمتجهات والتعديل والأبعاد بالستيني
 */
export function computeShatirSolarGeometry(alphaRad) {
    const R = SHATIR_SOLAR_MODEL.R_parecliptic; // 60
    const r1 = SHATIR_SOLAR_MODEL.r1_hamil;      // 4;37
    const r2 = SHATIR_SOLAR_MODEL.r2_mudir;      // 2;30

    // 1. الفلك الممثل: يتحرك إلى التوالي بمقدار مركز الشمس (+alpha)
    const p1x = R * Math.cos(alphaRad);
    const p1y = R * Math.sin(alphaRad);

    // 2. الفلك الحامل: يتحرك في أعلاه إلى خلاف التوالي بمثل مركز الشمس (-alpha بالنسبة للشعاع)
    // فيبقى متجه الحامل في الفضاء موازياً لخط الأوج (زاوية 0 في الإحداثيات العالمية)
    const hamilWorldAngle = 0;
    const p2x = p1x + r1 * Math.cos(hamilWorldAngle);
    const p2y = p1y + r1 * Math.sin(hamilWorldAngle);

    // 3. الفلك المدير: يتحرك في أعلاه إلى التوالي بضعف مركز الشمس (+2*alpha بالنسبة للحامل)
    const mudirWorldAngle = 2 * alphaRad;
    const sunX = p2x + r2 * Math.cos(mudirWorldAngle);
    const sunY = p2y + r2 * Math.sin(mudirWorldAngle);

    // البعد الحقيقي لمركز الشمس عن مركز العالم (الأرض)
    const distance = Math.hypot(sunX, sunY);

    // الموضع الحقيقي وزاوية التعديل (الاختلاف)
    const trueAngleRad = Math.atan2(sunY, sunX);
    let eqRad = trueAngleRad - alphaRad;
    while (eqRad > Math.PI) eqRad -= 2 * Math.PI;
    while (eqRad < -Math.PI) eqRad += 2 * Math.PI;
    const equationDeg = Math.abs(eqRad * 180 / Math.PI);

    // مقارنة مع نموذج بطلميوس (الفلك الخارج المركز: e = 2;30 أو 2;07)
    const e_ptolemy = 2.5; // 2;30 عند بطلميوس
    const ptoSunX = e_ptolemy + R * Math.cos(alphaRad);
    const ptoSunY = R * Math.sin(alphaRad);
    const ptoDistance = Math.hypot(ptoSunX, ptoSunY);
    const ptoTrueAngleRad = Math.atan2(ptoSunY, ptoSunX);
    let ptoEqRad = ptoTrueAngleRad - alphaRad;
    while (ptoEqRad > Math.PI) ptoEqRad -= 2 * Math.PI;
    while (ptoEqRad < -Math.PI) ptoEqRad += 2 * Math.PI;
    const ptoEquationDeg = Math.abs(ptoEqRad * 180 / Math.PI);

    // القطر الظاهري للشمس (يتناسب عكسياً مع البعد، القطر الأوسط عند البعد 60 هو 32'32")
    const apparentDiamArcmin = (32 + 32 / 60) * (60 / distance);
    const ptoApparentDiamArcmin = (32 + 32 / 60) * (60 / ptoDistance);

    return {
        R, r1, r2,
        p1: { x: p1x, y: p1y },
        p2: { x: p2x, y: p2y },
        sun: { x: sunX, y: sunY },
        c1x: p1x, c1y: p1y,
        c2x: p2x, c2y: p2y,
        sunX, sunY,
        hamilWorldAngle,
        mudirWorldAngle,
        distance,
        dist: distance,
        distanceSexa: toSexagesimal(distance),
        trueAngleRad,
        equationDeg,
        equationSexa: toSexagesimal(equationDeg, true),
        apparentDiamArcmin,
        diamArcmin: apparentDiamArcmin,
        ptolemyDist: ptoDistance,
        ptolemyEquationDeg: ptoEquationDeg,
        ptolemy: {
            e: e_ptolemy,
            sun: { x: ptoSunX, y: ptoSunY },
            distance: ptoDistance,
            distanceSexa: toSexagesimal(ptoDistance),
            equationDeg: ptoEquationDeg,
            equationSexa: toSexagesimal(ptoEquationDeg, true),
            apparentDiamArcmin: ptoApparentDiamArcmin
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. نموذج القمر عند ابن الشاطر (الفصل التاسع، ص 105 - 125)
// ═══════════════════════════════════════════════════════════════════════════

export const SHATIR_LUNAR_MODEL = {
    R_parecliptic: 60.0,          // الفلك الممثل لحركة الجوزهر (الرأس والذنب)
    R_inclined: 60.0,             // الفلك المائل (ميله 5 درجات عن فلك البروج)
    inclination_deg: 5.0,         // غاية عرض القمر: 5;00 درجات (هـ)
    r1_epicycle1: 6 + 35 / 60,    // نصف قطر التدوير الأول (الحامل): 6;35 (و له)
    r2_epicycle2: 1 + 25 / 60,    // نصف قطر التدوير الثاني (المدير): 1;25 (أ كه)
    r_moon_body: 0 + 16 / 60,     // نصف قطر جرم القمر
    syzygy_eff_r: 5 + 10 / 60,    // نصف القطر الفعال في الاجتماع والاستقبال: 5;10 (هـ ي)
    quad_eff_r: 8.0,              // نصف القطر الفعال في التربيعين: 8;00 (ح)
    max_dist_syzygy: 65 + 10 / 60,// أبعد بعد في الاجتماع والاستقبال: 65;10 (سه ي)
    min_dist_syzygy: 54 + 50 / 60,// أقرب قرب في الاجتماع والاستقبال: 54;50 (ند ن)
    max_dist_quad: 68.0,          // أبعد بعد في التربيعين: 68;00 (سح)
    min_dist_quad: 52.0,          // أقرب قرب في التربيعين: 52;00 (نب)
    solidSpheres: {
        jawzaharOuter: 68 + 16 / 60,
        mailOuter: 68 + 16 / 60,
        mailInner: 51 + 44 / 60,
        inclinedConvex: 68 + 16 / 60,  // محدب الفلك المائل: 68;16
        inclinedConcave: 51 + 44 / 60, // مقعر الفلك المائل المماس لفلك النار: 51;44
        epicycle1SphereRadius: 8 + 16 / 60, // نصف قطر كرة التدوير الأول المجسمة
        epicycle2SphereRadius: 1 + 41 / 60  // نصف قطر كرة التدوير الثاني المجسمة
    }
};

/**
 * حساب الموضع الهندسي الدقيق للقمر عند ابن الشاطر وبطلميوس
 * @param {number} meanLonRad وسط القمر (حركة المائل) بالراديان
 * @param {number} anomalyRad خاصة القمر (حركة التدوير الأول) بالراديان
 * @param {number} elongationRad البعد بين وسط القمر ووسط الشمس (D) بالراديان
 * @param {number} nodeLonRad موضع عقدة الرأس (الجوزهر) بالراديان
 */
export function computeShatirLunarGeometry(meanLonRad, anomalyRad, elongationRad, nodeLonRad = 0) {
    const R = SHATIR_LUNAR_MODEL.R_inclined;
    const r1 = SHATIR_LUNAR_MODEL.r1_epicycle1;
    const r2 = SHATIR_LUNAR_MODEL.r2_epicycle2;

    // 1. مركز التدوير الأول على محيط المائل
    const c1x = R * Math.cos(meanLonRad);
    const c1y = R * Math.sin(meanLonRad);

    // 2. التدوير الأول: يتحرك في أعلاه على خلاف التوالي بمقدار الخاصة
    const ep1WorldAngle = meanLonRad - anomalyRad;
    const c2x = c1x + r1 * Math.cos(ep1WorldAngle);
    const c2y = c1y + r1 * Math.sin(ep1WorldAngle);

    // 3. التدوير الثاني: يتحرك إلى التوالي بضعف البعد (2D) مبتدئاً من جهة المركز في الاجتماع
    // بحيث في الاجتماع (2D = 0) ينقص r2 من r1 (6;35 - 1;25 = 5;10)
    // وفي التربيع (2D = 180°) يزاد r2 على r1 (6;35 + 1;25 = 8;00)
    const ep2WorldAngle = ep1WorldAngle + Math.PI + 2 * elongationRad;
    const moonX = c2x + r2 * Math.cos(ep2WorldAngle);
    const moonY = c2y + r2 * Math.sin(ep2WorldAngle);

    const distance = Math.hypot(moonX, moonY);
    const effEpicycleRadius = Math.hypot(moonX - c1x, moonY - c1y);

    const trueLonRad = Math.atan2(moonY, moonX);
    let eqRad = trueLonRad - meanLonRad;
    while (eqRad > Math.PI) eqRad -= 2 * Math.PI;
    while (eqRad < -Math.PI) eqRad += 2 * Math.PI;
    const equationDeg = Math.abs(eqRad * 180 / Math.PI);

    // عرض القمر (الفصل 11: باعتبار حصة العرض عن عقدة الرأس وميل 5 درجات)
    const argOfLatitude = trueLonRad - nodeLonRad;
    const latitudeDeg = Math.asin(Math.sin(5 * Math.PI / 180) * Math.sin(argOfLatitude)) * 180 / Math.PI;

    // القطر الظاهري للقمر بالدقائق القوسية (عند البعد 60 يكون ~31.8')
    const apparentDiamArcmin = 31.8 * (60 / distance);

    // نموذج بطلميوس المقارن (حامل خارج المركز + مركز أوج متقهقر)
    const e_pto = 10 + 19 / 60; // 10;19
    const R_pto_deferent = 60 - e_pto; // 49;41
    const r_pto_ep = 5 + 15 / 60;      // 5;15
    const apogeeAngle = meanLonRad - 2 * elongationRad;
    const deferentCenterX = e_pto * Math.cos(apogeeAngle);
    const deferentCenterY = e_pto * Math.sin(apogeeAngle);

    // تقاطع شعاع وسط القمر مع الدائرة الحاملة الخارجة المركز عند بطلميوس
    const cosD = Math.cos(2 * elongationRad);
    const ptoEpCenterDist = e_pto * cosD + Math.sqrt(Math.max(0, R_pto_deferent * R_pto_deferent - Math.pow(e_pto * Math.sin(2 * elongationRad), 2)));
    const ptoEpCx = ptoEpCenterDist * Math.cos(meanLonRad);
    const ptoEpCy = ptoEpCenterDist * Math.sin(meanLonRad);
    const ptoMoonX = ptoEpCx + r_pto_ep * Math.cos(meanLonRad - anomalyRad);
    const ptoMoonY = ptoEpCy + r_pto_ep * Math.sin(meanLonRad - anomalyRad);
    const ptoDistance = Math.hypot(ptoMoonX, ptoMoonY);
    const ptoApparentDiamArcmin = 31.8 * (60 / ptoDistance);

    return {
        R, r1, r2,
        c1: { x: c1x, y: c1y },
        c2: { x: c2x, y: c2y },
        moon: { x: moonX, y: moonY },
        c1x, c1y, c2x, c2y, moonX, moonY,
        ep1WorldAngle,
        ep2WorldAngle,
        distance,
        dist: distance,
        distanceSexa: toSexagesimal(distance),
        effEpicycleRadius,
        effEpicycleSexa: toSexagesimal(effEpicycleRadius),
        equationDeg,
        equationSexa: toSexagesimal(equationDeg, true),
        latitudeDeg,
        apparentDiamArcmin,
        diamArcmin: apparentDiamArcmin,
        ptolemyDist: ptoDistance,
        ptolemyMoonX: ptoMoonX,
        ptolemyMoonY: ptoMoonY,
        ptolemy: {
            e: e_pto,
            R_deferent: R_pto_deferent,
            r_ep: r_pto_ep,
            deferentCenter: { x: deferentCenterX, y: deferentCenterY },
            epCenter: { x: ptoEpCx, y: ptoEpCy },
            moon: { x: ptoMoonX, y: ptoMoonY },
            distance: ptoDistance,
            distanceSexa: toSexagesimal(ptoDistance),
            apparentDiamArcmin: ptoApparentDiamArcmin
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. نماذج الكواكب الخمسة شاملة مزدوجة الطوسي في عطارد (الفصول 12 - 22)
// ═══════════════════════════════════════════════════════════════════════════

export const SHATIR_PLANETARY_MODELS = {
    saturn: {
        id: 'saturn',
        nameAr: 'زُحَل (المقاتل)',
        chapterAr: 'الفصل الثاني عشر والثالث عشر (ص 140 - 157)',
        isInferior: false,
        orbsCount: 5, // الممثل، المائل، الحامل، المدير، التدوير
        R: 60.0,
        r1: 5 + 7.5 / 60,     // 5;07,30 (هـ ز ل)
        r2: 1 + 42.5 / 60,    // 1;42,30 (أ مب ل)
        r3: 6 + 30 / 60,      // 6;30 (و ل)
        r4: 0,
        r5: 0,
        pto_e: 3 + 25 / 60,   // 3;25 (ج كه)
        apogeeEpCenterDist: 63 + 25 / 60,  // 63;25 (سج كه - نص ص 143)
        perigeeEpCenterDist: 56 + 35 / 60, // 56;35 (نو له - نص ص 145)
        maxDist: 69 + 55 / 60,             // 69;55 (مع نصف قطر التدوير)
        minDist: 50 + 5 / 60,              // 50;05
        inclinationDeg: 2 + 30 / 60,       // ميل المائل: 2;30
        epicycleTiltDeg: 4 + 30 / 60,      // ميل قطر التدوير في العرض (الفصل 24): 4;30
        retrogradeArcDeg: 7 + 16 / 60,     // قوس الرجوع الوسطى
        solidSpheres: {
            mudirSphere: 8 + 12.5 / 60,    // r3 + r2 = 8;12,30
            hamilSphere: 13 + 20 / 60,     // r3 + r2 + r1 = 13;20
            inclinedConvex: 73 + 40 / 60,  // 73;40 (شامل زيادة الثلث)
            inclinedConcave: 46 + 20 / 60  // 46;20
        }
    },
    jupiter: {
        id: 'jupiter',
        nameAr: 'المُشْتَرِي (البرجيس)',
        chapterAr: 'الفصل الخامس عشر والسادس عشر (ص 163 - 172)',
        isInferior: false,
        orbsCount: 5,
        R: 60.0,
        r1: 4 + 7.5 / 60,     // 4;07,30 (د ز ل)
        r2: 1 + 22.5 / 60,    // 1;22,30 (أ كب ل)
        r3: 11 + 30 / 60,     // 11;30 (يا ل)
        r4: 0,
        r5: 0,
        pto_e: 2 + 45 / 60,   // 2;45 (ب مه)
        apogeeEpCenterDist: 62 + 45 / 60,  // 62;45 (سب مه)
        perigeeEpCenterDist: 57 + 15 / 60, // 57;15 (نز يه)
        maxDist: 74 + 15 / 60,
        minDist: 45 + 45 / 60,
        inclinationDeg: 1 + 15 / 60,       // 1;15
        epicycleTiltDeg: 2 + 30 / 60,      // 2;30
        retrogradeArcDeg: 9 + 52 / 60,
        solidSpheres: {
            mudirSphere: 12 + 52.5 / 60,   // 12;52,30
            hamilSphere: 17.0,             // 17;00
            inclinedConvex: 77 + 20 / 60,  // 77;20
            inclinedConcave: 42 + 40 / 60  // 42;40
        }
    },
    mars: {
        id: 'mars',
        nameAr: 'المِرِّيخ (بهرام)',
        chapterAr: 'الفصل السابع عشر والثامن عشر (ص 173 - 184)',
        isInferior: false,
        orbsCount: 5,
        R: 60.0,
        r1: 9.0,              // 9;00 (ط)
        r2: 3.0,              // 3;00 (ج)
        r3: 39 + 30 / 60,     // 39;30 (لط ل)
        r4: 0,
        r5: 0,
        pto_e: 6.0,           // 6;00 (و)
        apogeeEpCenterDist: 66.0,          // 66;00 (سو)
        perigeeEpCenterDist: 54.0,         // 54;00 (ند)
        maxDist: 105 + 30 / 60,            // 105;30
        minDist: 14 + 30 / 60,             // 14;30
        inclinationDeg: 1.0,               // 1;00
        epicycleTiltDeg: 2 + 15 / 60,      // 2;15
        retrogradeArcDeg: 16 + 18 / 60,
        solidSpheres: {
            mudirSphere: 42 + 30 / 60,     // 42;30
            hamilSphere: 51 + 30 / 60,     // 51;30
            inclinedConvex: 111 + 50 / 60, // 111;50 (قيا ن - نص ص 181)
            inclinedConcave: 8 + 10 / 60   // 8;10 (ح ي - نص ص 181)
        }
    },
    venus: {
        id: 'venus',
        nameAr: 'الزُّهَرَة (الأناهيد)',
        chapterAr: 'الفصل التاسع عشر والعشرون (ص 185 - 196)',
        isInferior: true, // حركة المركز تساوي حركة وسط الشمس!
        orbsCount: 5,
        R: 60.0,
        r1: 1 + 41 / 60,      // 1;41 (أ ما)
        r2: 0 + 26 / 60,      // 0;26 (كو دقيقة)
        r3: 43 + 33 / 60,     // 43;33 (مج لج)
        r4: 0,
        r5: 0,
        pto_e: 1 + 15 / 60,   // 1;15 (أ يه)
        apogeeEpCenterDist: 61 + 15 / 60,  // 61;15 (سا يه)
        perigeeEpCenterDist: 58 + 45 / 60, // 58;45 (نح مه)
        maxDist: 104 + 48 / 60,            // 104;48 (قد مح)
        minDist: 15 + 12 / 60,             // 15;12 (يه يب)
        inclinationDeg: 0 + 10 / 60,       // ميل المائل: 0;10
        epicycleTiltDeg: 3 + 30 / 60,      // 3;30 (الفصل 25)
        retrogradeArcDeg: 15 + 45 / 60,
        solidSpheres: {
            mudirSphere: 43 + 59 / 60,     // 43;59 (مج نط - نص ص 189)
            hamilSphere: 45 + 40 / 60,     // 45;40 (مه م - نص ص 189)
            inclinedConvex: 105 + 40 / 60, // 105;40 (قه م - نص ص 189)
            inclinedConcave: 14.0          // 14;00 (يد - نص ص 189)
        }
    },
    mercury: {
        id: 'mercury',
        nameAr: 'عُطَارِد (الكاتب)',
        chapterAr: 'الفصل الحادي والعشرون والثاني والعشرون (ص 197 - 207)',
        isInferior: true, // حركة المركز تساوي حركة وسط الشمس + مزدوجة الطوسي (الشامل والحافظ)
        orbsCount: 7, // الممثل، المائل، الحامل، المدير، التدوير، المحيط/الشامل، الحافظ
        R: 60.0,
        r1: 4 + 5 / 60,       // 4;05 (د هـ)
        r2: 0 + 50 / 60,      // 0;50 (ن دقيقة)
        r3: 22 + 46 / 60,     // 22;46 (كب مو)
        r4: 0 + 33 / 60,      // الفلك المحيط/الشامل: 0;33 (لج دقيقة)
        r5: 0 + 33 / 60,      // الفلك الحافظ: 0;33 (لج دقيقة)
        pto_e: 3.0,           // 3;00 (ج)
        apogeeEpCenterDist: 63 + 15 / 60,  // 63;15 (سج يه)
        perigeeEpCenterDist: 56 + 45 / 60, // 56;45 (نو مه)
        maxDist: 86 + 1 / 60,
        minDist: 33 + 59 / 60,
        inclinationDeg: 0 + 45 / 60,       // 0;45
        epicycleTiltDeg: 6 + 15 / 60,      // 6;15 (الفصل 25)
        retrogradeArcDeg: 12 + 30 / 60,
        solidSpheres: {
            tusiCoupleRadius: 1 + 6 / 60,  // مجموع قطري المحيط والحافظ: 1;06
            epicycleSphere: 23 + 52 / 60,  // 23;52 (كج نب)
            mudirSphere: 24 + 42 / 60,     // 24;42
            hamilSphere: 28 + 47 / 60,     // 28;47
            inclinedConvex: 89 + 3 / 60,   // 89;03 (فط ج - نص ص 201)
            inclinedConcave: 30 + 53 / 60  // 30;53 (ل نج - نص ص 201)
        }
    }
};

/**
 * حساب الهندسة المتجهية الكاملة لكوكب عند ابن الشاطر وبطلميوس
 * @param {string} planetKey 'saturn' | 'jupiter' | 'mars' | 'venus' | 'mercury'
 * @param {number} centerRad زاوية المركز kappa (بالنسبة للأوج على المحور +X) بالراديان
 * @param {number} anomalyRad زاوية الخاصة alpha على فلك التدوير بالراديان
 */
export function computeShatirPlanetGeometry(planetKey, centerRad, anomalyRad) {
    const cfg = SHATIR_PLANETARY_MODELS[planetKey] || SHATIR_PLANETARY_MODELS.saturn;
    const R = cfg.R;
    const r1 = cfg.r1;
    const r2 = cfg.r2;
    const r3 = cfg.r3;
    const r4 = cfg.r4 || 0;
    const r5 = cfg.r5 || 0;

    // 1. الفلك المائل (R = 60): يتحرك إلى التوالي بمقدار المركز (+kappa)
    const p1x = R * Math.cos(centerRad);
    const p1y = R * Math.sin(centerRad);

    // 2. فلك الحامل (r1): يتحرك في أعلاه إلى خلاف التوالي بمقدار المركز (-kappa بالنسبة للشعاع)
    // فيبقى متجه الحامل موازياً دائماً لخط الأوج (زاوية 0 في الإحداثيات العالمية)
    const hamilWorldAngle = 0;
    const p2x = p1x + r1 * Math.cos(hamilWorldAngle);
    const p2y = p1y + r1 * Math.sin(hamilWorldAngle);

    // 3. فلك المدير (r2): يتحرك في أعلاه إلى التوالي بضعف المركز (+2*kappa)
    // مبتدئاً من جهة مركز العالم في الأوج (زاوية pi + 2*kappa في الإحداثيات العالمية)
    // النتيجة الهندسية الفذة لابن الشاطر:
    // - في الأوج (kappa = 0): بعد مركز التدوير = 60 + r1 - r2 = 60 + e
    // - في الحضيض (kappa = pi): بعد مركز التدوير = 60 - (r1 - r2) = 60 - e
    // - في التربيعين (kappa = pi/2): الانزياح الأفقي نحو الأوج = r1 + r2 = 2e (يطابق معدل المسير!)
    const mudirWorldAngle = Math.PI + 2 * centerRad;
    const epCx = p2x + r2 * Math.cos(mudirWorldAngle);
    const epCy = p2y + r2 * Math.sin(mudirWorldAngle);

    const epCenterDist = Math.hypot(epCx, epCy);
    const trueDeferredAngle = Math.atan2(epCy, epCx);

    // الذروة الوسطى (موازية للخط المار بمركز معدل المسير أو الحامل) والذروة المرئية (من الأرض لمركز التدوير)
    let eqCenterRad = trueDeferredAngle - centerRad;
    while (eqCenterRad > Math.PI) eqCenterRad -= 2 * Math.PI;
    while (eqCenterRad < -Math.PI) eqCenterRad += 2 * Math.PI;
    const eqCenterDeg = eqCenterRad * 180 / Math.PI;

    // 4. فلك التدوير (r3): يتحرك الكوكب (أو مركز المحيط في عطارد) بحركة الخاصة
    const epWorldAngle = centerRad + anomalyRad;
    const epPerimX = epCx + r3 * Math.cos(epWorldAngle);
    const epPerimY = epCy + r3 * Math.sin(epWorldAngle);

    // 5. الفلكان السادس والسابع في عطارد (المحيط/الشامل r4=0;33 والحافظ r5=0;33 — مزدوجة الطوسي)
    let muhitCenter = null;
    let muhitHafiz = null;
    let planetX = epPerimX;
    let planetY = epPerimY;
    let effectiveEpRadius = r3;
    let muhitWorldAngle = epWorldAngle;
    let hafizWorldAngle = epWorldAngle;

    if (planetKey === 'mercury' && (r4 > 0 || r5 > 0)) {
        // مزدوجة الطوسي على امتداد نصف قطر التدوير:
        // المحيط (r4) يدور بضعف المركز (+2*kappa) بالنسبة لنصف قطر التدوير (مبتدئاً نحو داخل التدوير في الأوج)
        // والحافظ (r5 = r4) يدور بأربعة أمثال المركز (-4*kappa) في الاتجاه المعاكس
        // فتتحرك النقطة المحمولة حركة خطية ترددية صرفة على قطر التدوير بمقدار: -(r4 + r5)*cos(2*kappa)
        muhitWorldAngle = epWorldAngle + Math.PI + 2 * centerRad;
        const mCx = epPerimX + r4 * Math.cos(muhitWorldAngle);
        const mCy = epPerimY + r4 * Math.sin(muhitWorldAngle);
        muhitCenter = { x: mCx, y: mCy };

        hafizWorldAngle = epWorldAngle + Math.PI - 2 * centerRad;
        planetX = mCx + r5 * Math.cos(hafizWorldAngle);
        planetY = mCy + r5 * Math.sin(hafizWorldAngle);

        // نصف قطر التدوير المرئي الفعلي:
        // في الأوج والحضيض: 22;46 - 1;06 = 21;40
        // في التربيعين: 22;46 + 1;06 = 23;52
        effectiveEpRadius = r3 - (r4 + r5) * Math.cos(2 * centerRad);
        muhitHafiz = {
            r4,
            r5,
            baseX: epPerimX,
            baseY: epPerimY,
            muhitCenterX: mCx,
            muhitCenterY: mCy,
            radialShift: -(r4 + r5) * Math.cos(2 * centerRad),
            minEffectiveR3: r3 - (r4 + r5),
            maxEffectiveR3: r3 + (r4 + r5)
        };
    }

    const planetDist = Math.hypot(planetX, planetY);
    const truePlanetAngle = Math.atan2(planetY, planetX);

    // زاوية تعديل الخاصة (بين مركز التدوير والكوكب كما يُرى من الأرض)
    let eqAnomalyRad = truePlanetAngle - trueDeferredAngle;
    while (eqAnomalyRad > Math.PI) eqAnomalyRad -= 2 * Math.PI;
    while (eqAnomalyRad < -Math.PI) eqAnomalyRad += 2 * Math.PI;
    const eqAnomalyDeg = eqAnomalyRad * 180 / Math.PI;

    // فحص حالة السرعة والاستقامة والوقوف والرجوع (الفصل السادس والعشرون، ص 243)
    const cosAnom = Math.cos(anomalyRad);
    const isRetrograde = (effectiveEpRadius * cosAnom + epCenterDist * Math.cos(eqAnomalyRad)) < 0 ||
                         (Math.cos(anomalyRad) < -0.68);
    const isStationary = Math.abs(Math.cos(anomalyRad) + 0.68) < 0.06;
    const motionStateAr = isStationary
        ? (Math.sin(anomalyRad) > 0 ? 'مقام أول للرجوع (وقوف)' : 'مقام ثانٍ للاستقامة (وقوف)')
        : (isRetrograde ? 'رجوع (خلاف التوالي)' : 'استقامة (إلى التوالي)');
    const motionState = isStationary ? 'stationary' : (isRetrograde ? 'retrograde' : 'direct');

    // حساب العرض (الفصلان 24 و25): ميل المائل + ميل التدوير
    const latInclined = cfg.inclinationDeg * Math.sin(centerRad);
    const latEpicycle = cfg.epicycleTiltDeg * Math.sin(anomalyRad) * (effectiveEpRadius / 60);
    const totalLatitudeDeg = latInclined + latEpicycle;

    // نموذج بطلميوس المقارن (الحامل الخارج المركز بـ e + نقطة معدل المسير بـ 2e)
    const e = cfg.pto_e;
    const ptoDefCenter = { x: e, y: 0 };
    const ptoEquant = { x: 2 * e, y: 0 };
    // شعاع يخرج من معدل المسير (2e, 0) بزاوية kappa ويقطع دائرة الحامل التي مركزها (e, 0) ونصف قطرها 60
    const sinK = Math.sin(centerRad);
    const cosK = Math.cos(centerRad);
    const sDist = -e * cosK + Math.sqrt(Math.max(0, R * R - e * e * sinK * sinK));
    const ptoEpCx = 2 * e + sDist * cosK;
    const ptoEpCy = sDist * sinK;
    const ptoPlanetX = ptoEpCx + r3 * Math.cos(centerRad + anomalyRad);
    const ptoPlanetY = ptoEpCy + r3 * Math.sin(centerRad + anomalyRad);
    const ptoEpCenterDist = Math.hypot(ptoEpCx, ptoEpCy);
    const ptoPlanetDist = Math.hypot(ptoPlanetX, ptoPlanetY);
    const ptoTrueAngle = Math.atan2(ptoPlanetY, ptoPlanetX);

    // الفارق الزاوي الدقيق بين موضع ابن الشاطر وموضع بطلميوس
    let diffRad = truePlanetAngle - ptoTrueAngle;
    while (diffRad > Math.PI) diffRad -= 2 * Math.PI;
    while (diffRad < -Math.PI) diffRad += 2 * Math.PI;
    const angularDiffDeg = Math.abs(diffRad * 180 / Math.PI);

    return {
        cfg,
        R, r1, r2, r3, r4, r5,
        p1: { x: p1x, y: p1y },
        p2: { x: p2x, y: p2y },
        epCenter: { x: epCx, y: epCy },
        epPerim: { x: epPerimX, y: epPerimY },
        muhitCenter,
        muhitHafiz,
        planet: { x: planetX, y: planetY },
        c0x: p1x, c0y: p1y,
        c1x: p2x, c1y: p2y,
        c2x: epCx, c2y: epCy,
        planetX, planetY,
        hamilWorldAngle,
        mudirWorldAngle,
        epWorldAngle,
        muhitWorldAngle,
        hafizWorldAngle,
        epCenterDist,
        deferentCenterDist: epCenterDist,
        epCenterDistSexa: toSexagesimal(epCenterDist),
        effectiveEpRadius,
        effectiveR3: effectiveEpRadius,
        effectiveEpRadiusSexa: toSexagesimal(effectiveEpRadius),
        planetDist,
        dist: planetDist,
        planetDistSexa: toSexagesimal(planetDist),
        trueDeferredAngle,
        truePlanetAngle,
        eqCenterDeg,
        eqCenterSexa: toSexagesimal(Math.abs(eqCenterDeg), true),
        eqAnomalyDeg,
        eqAnomalySexa: toSexagesimal(Math.abs(eqAnomalyDeg), true),
        totalLatitudeDeg,
        latitudeDeg: totalLatitudeDeg,
        motionStateAr,
        motionState,
        isRetrograde,
        isStationary,
        angularDiffDeg,
        angularDiffSexa: toSexagesimal(angularDiffDeg, true),
        ptolemy: {
            e,
            defCenter: ptoDefCenter,
            equant: ptoEquant,
            epCenter: { x: ptoEpCx, y: ptoEpCy },
            planet: { x: ptoPlanetX, y: ptoPlanetY },
            epCenterDist: ptoEpCenterDist,
            epCenterDistSexa: toSexagesimal(ptoEpCenterDist),
            planetDist: ptoPlanetDist,
            planetDistSexa: toSexagesimal(ptoPlanetDist),
            trueAngle: ptoTrueAngle
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. الأبعاد والأجرام الكونية في الخاتمة (الفصل الحادي والثلاثون، ص 271 - 304)
//    بأنصاف أقطار الأرض (Earth Radii - R_earth) حيث مقعر فلك القمر = 50;16
// ═══════════════════════════════════════════════════════════════════════════

export const SHATIR_COSMIC_SCALE = [
    {
        order: 0,
        nameAr: 'الأركان الأربعة (الأرض، الماء، الهواء، النار)',
        minDistRe: '0;00',
        maxDistRe: '50;16',
        minAbjad: '٠',
        maxAbjad: 'ن يو',
        bodyDiamRe: '2;00 (قطر الأرض)',
        volumeRatioEarth: '1.00×',
        notesAr: 'مقعر فلك القمر المائل يماس محدب كرة النار على بعد 50;16 نصف قطر أرضي بلا خلاء.'
    },
    {
        order: 1,
        nameAr: 'فلك القمر (الممثل والمائل والتدويران)',
        minDistRe: '50;16',
        maxDistRe: '66;00',
        minAbjad: 'ن يو',
        maxAbjad: 'سو ٠',
        bodyDiamRe: '0;35,28',
        volumeRatioEarth: '1 / 39.2 (جزء من 39 من الأرض)',
        notesAr: 'أقرب قرب القمر في التربيعين (52 جزءاً فلكياً = 50;16 نصف قطر أرضي)، وأبعد بعده في التربيعين (68 جزءاً = 66 نصف قطر أرضي).'
    },
    {
        order: 2,
        nameAr: 'فلك عطارد (الأفلاك السبعة ومزدوجة الطوسي)',
        minDistRe: '66;00',
        maxDistRe: '193;26',
        minAbjad: 'سو ٠',
        maxAbjad: 'قصج كو',
        bodyDiamRe: '0;04,30',
        volumeRatioEarth: '1 / 19,000 من الأرض',
        notesAr: 'مقعر فلك عطارد يماس محدب فلك القمر على بعد 66 نصف قطر أرضي، ومحدبه ينتهي عند 193;26.'
    },
    {
        order: 3,
        nameAr: 'فلك الزهرة (الأفلاك الخمسة)',
        minDistRe: '193;26',
        maxDistRe: '1464;34',
        minAbjad: 'قصج كو',
        maxAbjad: 'أغسد لد',
        bodyDiamRe: '0;36,00',
        volumeRatioEarth: '1 / 36 من الأرض',
        notesAr: 'لِكِبَر فلك تدوير الزهرة (43;33 جزءاً)، يتسع ثخن فلكها المائل من 193;26 إلى 1464;34 نصف قطر أرضي.'
    },
    {
        order: 4,
        nameAr: 'فلك الشمس (الممثل والحامل والمدير والشامل)',
        minDistRe: '1470;29',
        maxDistRe: '1883;46',
        minAbjad: 'أذع كط',
        maxAbjad: 'أفضج مو',
        bodyDiamRe: '15;25,46 (نصف قطره 7;42,53)',
        volumeRatioEarth: '459× ضعف جرم الأرض!',
        notesAr: 'البعد الأوسط للشمس 1677 نصف قطر أرضي؛ حقق ابن الشاطر بالرصد أن جرم الشمس أعظم من الأرض بـ 459 مرة (مقابل 170 عند بطلميوس).'
    },
    {
        order: 5,
        nameAr: 'فلك المريخ (الأفلاك الخمسة)',
        minDistRe: '1890;00',
        maxDistRe: '26,460',
        minAbjad: 'أفص ٠',
        maxAbjad: 'كو ألفاً وونم',
        bodyDiamRe: '2;16',
        volumeRatioEarth: '1.46× جرم الأرض',
        notesAr: 'أوسع أفلاك الكواكب ثخناً لأن مقعره 8;10 أجزاء ومحدبه 111;50 جزءاً فلكياً (نسبة 1 إلى 14).'
    },
    {
        order: 6,
        nameAr: 'فلك المشتري (الأفلاك الخمسة)',
        minDistRe: '26,460',
        maxDistRe: '48,019',
        minAbjad: 'كو ألفاً وونم',
        maxAbjad: 'مح ألفاً ويط',
        bodyDiamRe: '9;14',
        volumeRatioEarth: '98.5× ضعف جرم الأرض',
        notesAr: 'مقعره يماس محدب المريخ، ومحدبه يماس مقعر فلك زحل.'
    },
    {
        order: 7,
        nameAr: 'فلك زحل (الأفلاك الخمسة)',
        minDistRe: '48,019',
        maxDistRe: '76,472',
        minAbjad: 'مح ألفاً ويط',
        maxAbjad: 'عو ألفاً وذعب',
        bodyDiamRe: '8;56',
        volumeRatioEarth: '89× ضعف جرم الأرض',
        notesAr: 'أعلى الكواكب السيارة، يماس محدبه مقعر فلك الثوابت (الكرسي).'
    },
    {
        order: 8,
        nameAr: 'الفلك الثامن (فلك الثوابت / الكرسي) والفلك التاسع (الأطلس)',
        minDistRe: '76,472',
        maxDistRe: 'محيط العالم',
        minAbjad: 'عو ألفاً وذعب',
        maxAbjad: 'محيط الأكر',
        bodyDiamRe: 'أقدار الكواكب الثابتة الستة',
        volumeRatioEarth: 'أعظم الكواكب الثابتة 108× الأرض',
        notesAr: 'يتحرك الثامن بدرجة كل 70 سنة فارسية، ويحيط به الفلك التاسع الأطلس الأملس المتحرك بالحركة اليومية الأولى.'
    }
];

// ═══════════════════════════════════════════════════════════════════════════
// 7. خواص الآفاق الخمسة في المعمورة (الباب الثاني من نهاية السول، ص 305 - 398)
// ═══════════════════════════════════════════════════════════════════════════

export const SHATIR_FIVE_HORIZONS = [
    {
        id: 'equator',
        key: 'equator_0',
        nameAr: '١. أفق خط الاستواء (الفلك المستقيم)',
        titleAr: '١. أفق خط الاستواء (الفلك المستقيم)',
        chapterAr: 'الباب الثاني - الفصل الثاني (ص 313)',
        phenomenonAr: 'استواء الليل والنهار أبداً (12 ساعة) وممر الشمس بسمت الرأس مرتين في السنة',
        lat: 0.0,
        latDeg: 0.0,
        lon: 36.3,
        cityAr: 'خط الاستواء (عرض 0°)',
        summaryAr: 'يتساوى فيه الليل والنهار أبداً (12 ساعة لكل منهما)، وتمر الشمس بسمت الرأس مرتين في السنة عند الاعتدالين، وجميع الكواكب تطلع وتغرب فيه عمودياً، وله ظلان (شمالي وجنوبي).',
        explanationAr: 'يتساوى فيه الليل والنهار أبداً (12 ساعة لكل منهما)، وتمر الشمس بسمت الرأس مرتين في السنة عند الاعتدالين، وجميع الكواكب تطلع وتغرب فيه عمودياً، وله ظلان (شمالي وجنوبي).'
    },
    {
        id: 'damascus',
        key: 'oblique_damascus',
        nameAr: '٢. الآفاق المائلة دون تمام الميل (دمشق الشام)',
        titleAr: '٢. الآفاق المائلة دون تمام الميل (دمشق الشام)',
        chapterAr: 'الباب الثاني - الفصل الثالث (ص 321)',
        phenomenonAr: 'اختلاف الليل والنهار فصلياً وظهور القطب الشمالي بارتفاع يساوي عرض البلد (33°30′)',
        lat: 33.50,
        latDeg: 33.50,
        lon: 36.30,
        cityAr: 'دمشق الشام - مرصد ابن الشاطر (عرض 33°30′)',
        summaryAr: 'عرضه أكبر من الميل الأعظم (23°31′) وأقل من تمام الميل (66°29′)؛ لا تمر الشمس بسمت رأسه أبداً، وظله الزوالي شمالي دائماً، وتختلف فيه ساعات الليل والنهار ومطالع البروج.',
        explanationAr: 'عرضه أكبر من الميل الأعظم (23°31′) وأقل من تمام الميل (66°29′)؛ لا تمر الشمس بسمت رأسه أبداً، وظله الزوالي شمالي دائماً، وتختلف فيه ساعات الليل والنهار ومطالع البروج.'
    },
    {
        id: 'colatitude',
        key: 'arctic_66_29',
        nameAr: '٣. أفق تمام الميل الأعظم (عرض 66° 29′)',
        titleAr: '٣. أفق تمام الميل الأعظم (عرض 66° 29′)',
        chapterAr: 'الباب الثاني - الفصل الرابع (ص 339)',
        phenomenonAr: 'انطباق منطقة البروج على دائرة الأفق مرة كل يوم وطلوع ستة بروج دفعةً واحدة!',
        lat: 66.4833,
        latDeg: 66.4833,
        lon: 36.30,
        cityAr: 'دائرة تمام الميل (عرض 66°29′ - كب لا من القطب)',
        summaryAr: 'ينطبق فيه قطب فلك البروج على سمت الرأس مرة كل يوم، وفيه تنطبق منطقة البروج على دائرة الأفق لحظةً فكأن الستة البروج الشمالية تطلع دفعةً واحدةً، ويبقى رأس السرطان ظاهراً 24 ساعة في الانقلاب الصيفي.',
        explanationAr: 'ينطبق فيه قطب فلك البروج على سمت الرأس مرة كل يوم، وفيه تنطبق منطقة البروج على دائرة الأفق لحظةً فكأن الستة البروج الشمالية تطلع دفعةً واحدةً، ويبقى رأس السرطان ظاهراً 24 ساعة في الانقلاب الصيفي.'
    },
    {
        id: 'beyond_colat',
        key: 'reverse_rising_75',
        nameAr: '٤. الآفاق المتجاوزة لتمام الميل (ظاهرة الطلوع المعكوس!)',
        titleAr: '٤. الآفاق المتجاوزة لتمام الميل (ظاهرة الطلوع المعكوس!)',
        chapterAr: 'الباب الثاني - الفصل الخامس (ص 343)',
        phenomenonAr: 'الطلوع المعكوس لستة بروج من السنبلة إلى الحوت (يطلع الثور قبل الحمل، والحوت قبل الدلو)!',
        lat: 75.0,
        latDeg: 75.0,
        lon: 36.30,
        cityAr: 'عرض 75° شمالاً (مجاوز لتمام الميل)',
        summaryAr: 'من أعجب ما حققه ابن الشاطر: فيه بروج أبدية الظهور وبروج أبدية الخفاء، وتطلع فيه ستة بروج معكوسةً على خلاف التوالي (تطلع السنبلة ثم الأسد ثم السرطان ثم الجوزاء ثم الثور ثم الحمل!) وتغرب ستة بروج معكوسةً.',
        explanationAr: 'من أعجب ما حققه ابن الشاطر: فيه بروج أبدية الظهور وبروج أبدية الخفاء، وتطلع فيه ستة بروج معكوسةً على خلاف التوالي (تطلع السنبلة ثم الأسد ثم السرطان ثم الجوزاء ثم الثور ثم الحمل!) وتغرب ستة بروج معكوسةً.'
    },
    {
        id: 'north_pole',
        key: 'polar_millstone_90',
        nameAr: '٥. أفق القطب حيث العرض ربع الدور (الحركة الرحوية 90°)',
        titleAr: '٥. أفق القطب حيث العرض ربع الدور (الحركة الرحوية 90°)',
        chapterAr: 'الباب الثاني - الفصل السادس (ص 357)',
        phenomenonAr: 'دوران الفلك رحوياً موازياً للأفق، والسنة كلها يوم واحد (6 أشهر نهار و6 أشهر ليل)',
        lat: 89.99,
        latDeg: 89.99,
        lon: 36.30,
        cityAr: 'القطب الشمالي (عرض 90° - الفلك الرحوي)',
        summaryAr: 'ينطبق فيه قطب العالم على سمت الرأس ومعدّل النهار على الأفق؛ فتدور الكواكب موازيةً للأفق كالرحى لا تطلع ولا تغرب بالحركة اليومية، وتكون السنة كلها يوماً واحداً (6 أشهر نهار متصل و6 أشهر ليل متصل).',
        explanationAr: 'ينطبق فيه قطب العالم على سمت الرأس ومعدّل النهار على الأفق؛ فتدور الكواكب موازيةً للأفق كالرحى لا تطلع ولا تغرب بالحركة اليومية، وتكون السنة كلها يوماً واحداً (6 أشهر نهار متصل و6 أشهر ليل متصل).'
    }
];
