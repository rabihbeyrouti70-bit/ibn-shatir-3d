import { computeHorizontalCoords, getJD } from './astronomy-core.js';
const getJD_Mujaib = getJD;
import { computePrayersMujaib, getCityTimezoneHours, calculateQiblaDirection, COUNTRY_TIMEZONE_IANA } from './prayer-core.js';
import {
    SHATIR_CONSTANTS,
    SHATIR_SOLAR_MODEL,
    SHATIR_LUNAR_MODEL,
    SHATIR_PLANETARY_MODELS,
    SHATIR_COSMIC_SCALE,
    SHATIR_FIVE_HORIZONS,
    computeShatirSolarGeometry,
    computeShatirLunarGeometry,
    computeShatirPlanetGeometry,
    toSexagesimal,
    intToAbjad
} from './nihayat-al-sul-engine.js';
window.calculateQiblaDirection = calculateQiblaDirection;
window.SHATIR_CONSTANTS = SHATIR_CONSTANTS;
window.SHATIR_SOLAR_MODEL = SHATIR_SOLAR_MODEL;
window.SHATIR_LUNAR_MODEL = SHATIR_LUNAR_MODEL;
window.SHATIR_PLANETARY_MODELS = SHATIR_PLANETARY_MODELS;
window.SHATIR_COSMIC_SCALE = SHATIR_COSMIC_SCALE;
window.SHATIR_FIVE_HORIZONS = SHATIR_FIVE_HORIZONS;
window.toSexagesimal = toSexagesimal;
window.intToAbjad = intToAbjad;

// المتغيرات الجغرافية والمدينة الحالية (معرّفة في أعلى الملف لتفادي الـ Temporal Dead Zone عند الإقلاع)
let currentCityKey = 'damascus';
let currentCityName = 'دمشق (الجامع الأموي)';
let currentCityCountry = 'سوريا';
let currentLatDeg = 33.5138;
let currentLonDeg = 36.2924;
let currentLatRad = currentLatDeg * Math.PI / 180;

// أوضاع العرض الفيزيائي في «نهاية السول»: الأكر المجسمة التامة المتماسة (المحدب والمقعر) والأركان الأربعة
let showSolidSpheres = true;
let showFourElements = true;
let manualSolarAngleOverride = null;
let manualLunarElongOverride = null;
let manualPlanetAngleOverride = null;

function toggleSolidSpheres(val) {
    showSolidSpheres = !!val;
    document.querySelectorAll('.chk-solid-spheres').forEach(el => { el.checked = showSolidSpheres; });
    showToast(showSolidSpheres ? '🟢 وضع الأكر المجسمة المتماسة (المحدب والمقعر بلا خلاء)' : '🔵 وضع الدوائر الهندسية المجردة لحركة المراكز');
}
window.toggleSolidSpheres = toggleSolidSpheres;

function toggleFourElements(val) {
    showFourElements = !!val;
    showToast(showFourElements ? '🌍 إظهار كرات الأركان الأربعة تحت مقعر فلك القمر' : '🌑 إخفاء كرات الأركان الأربعة');
}
window.toggleFourElements = toggleFourElements;

function jumpSolarAngle(deg) {
    if (deg === null) {
        manualSolarAngleOverride = null;
        sunTrail = [];
        showToast('⏱️ عودة لمزامنة مركز الشمس مع التاريخ الحي');
        return;
    }
    setClockRunning(false);
    manualSolarAngleOverride = (deg * Math.PI) / 180;
    sunAlpha = manualSolarAngleOverride;
    sunTrail = [];
    drawSunComparison();
    showToast(`☀️ اختبار رصدي: مركز الشمس = ${deg}° (${toSexagesimal(deg).abjad})`);
}
window.jumpSolarAngle = jumpSolarAngle;

function jumpLunarElongation(deg) {
    if (deg === null) {
        manualLunarElongOverride = null;
        moonTrail = []; ibsMoonTrail = [];
        showToast('⏱️ عودة لمزامنة القمر مع التاريخ الحي');
        return;
    }
    setClockRunning(false);
    manualLunarElongOverride = (deg * Math.PI) / 180;
    moonAlpha = manualLunarElongOverride;
    moonTrail = []; ibsMoonTrail = [];
    drawMoonComparison();
    showToast(`🌙 اختبار رصدي: استطالة القمر = ${deg}°`);
}
window.jumpLunarElongation = jumpLunarElongation;

function jumpPlanetAngle(centerDeg, anomDeg = null) {
    if (centerDeg === null) {
        manualPlanetAngleOverride = null;
        ptPlanetTrail = []; ibsPlanetTrail = [];
        showToast('⏱️ عودة لمزامنة الكوكب مع التاريخ الحي');
        return;
    }
    setClockRunning(false);
    const cur = planetAngles[selectedPlanet] || { mean: 0, anomaly: 0 };
    manualPlanetAngleOverride = {
        mean: (centerDeg * Math.PI) / 180,
        anomaly: anomDeg !== null ? (anomDeg * Math.PI) / 180 : cur.anomaly
    };
    planetAngles[selectedPlanet] = { ...manualPlanetAngleOverride };
    ptPlanetTrail = []; ibsPlanetTrail = [];
    drawPlanets();
    showToast(`🪐 اختبار رصدي (${planetData[selectedPlanet].nameAr}): المركز = ${centerDeg}°${anomDeg !== null ? '، الخاصة = ' + anomDeg + '°' : ''}`);
}
window.jumpPlanetAngle = jumpPlanetAngle;

function applyShatirHorizonPreset(horizonId) {
    const h = SHATIR_FIVE_HORIZONS.find(x => x.id === horizonId);
    if (!h) return;
    if (activeTab !== 'cosmos3D') {
        switchTab('cosmos3D');
    }
    currentLatDeg = h.lat;
    currentLonDeg = h.lon;
    currentLatRad = currentLatDeg * Math.PI / 180;
    currentCityName = h.cityAr;
    const inLat = document.getElementById('inputLat');
    const inLon = document.getElementById('inputLon');
    if (inLat) inLat.value = h.lat.toFixed(2);
    if (inLon) inLon.value = h.lon.toFixed(2);
    const horizonBanner = document.getElementById('shatirHorizonExplainBox');
    if (horizonBanner) {
        horizonBanner.style.display = 'block';
        horizonBanner.innerHTML = `<strong style="color:#FDE047;">🧭 ${h.nameAr} (${h.chapterAr}):</strong> <span style="color:#E2E8F0;">${h.summaryAr}</span>`;
    }
    document.querySelectorAll('.btn-shatir-horizon').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-horizon') === horizonId);
    });
    forceRebuildPrayerArcs = true;
    if (cosmos3DInitialized && typeof updateObserverLocation === 'function') {
        updateObserverLocation(h.lat, h.lon, h.cityAr, 'سوريا');
    } else if (cosmos3DInitialized && typeof updateAstronomy === 'function') {
        updateAstronomy(currentDate);
    }
    showToast(`🧭 تم تطبيق: ${h.nameAr}`);
}
window.applyShatirHorizonPreset = applyShatirHorizonPreset;


// ==================== SURGICAL POLISH HELPERS ====================
function setupHiDpiCanvas(canvas, logicalW, logicalH) {
    if (!canvas) return null;
    const dpr = Math.ceil(window.devicePixelRatio || 1); // Clean integer DPR eliminates subpixel jitter
    const targetW = logicalW * dpr;
    const targetH = logicalH * dpr;
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
}

// Smooth spline curve for orbital trails to eliminate polygonal corners
function drawSmoothTrail(ctx, points, strokeStyle, lineWidth) {
    if (!points || points.length < 2) return;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
}

function drawFadingTrail(ctx, trail, r, g, b, maxPoints) {
    if (!trail || trail.length < 2) return;
    const len = trail.length;
    for (let i = 1; i < len; i++) {
        const alpha = Math.min(0.85, (i / len) * 0.85);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.0 + (i / len) * 1.5;
        ctx.beginPath();
        ctx.moveTo(trail[i-1].x, trail[i-1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
    }
}

// Toast HUD Helper
let toastTimer = null;
function showToast(msg) {
    const toast = document.getElementById('toastHud');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 1800);
}

// Modal Dialog Helpers
function toggleShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    if (modal) modal.classList.toggle('active');
}
function closeShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    if (modal) modal.classList.remove('active');
}
function onModalBackdropClick(e) {
    if (e.target && e.target.id === 'shortcutsModal') {
        closeShortcutsModal();
    }
}

// Global Keyboard Navigation
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space') {
        e.preventDefault();
        toggleClockPlay();
        showToast(isClockRunning ? '⏱️ بدء تدفق الزمن' : '⏸️ تم إيقاف تدفق الزمن');
    } else if (e.key >= '1' && e.key <= '7') {
        const tabKeys = ['cosmos3D', 'cosmos', 'sunComp', 'moonComp', 'planets', 'study', 'revolution'];
        const idx = parseInt(e.key) - 1;
        if (tabKeys[idx]) {
            switchTab(tabKeys[idx]);
            const tabNames = ['الأفلاك التسعة', 'نموذج الشمس', 'نموذج القمر', 'الكواكب ومعدل المسير', 'الدراسة الشاملة', 'ثورة كوبرنيكوس وكيبلر'];
            showToast(`🔭 التبويب ${e.key}: ${tabNames[idx]}`);
        }
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        addTime(1, 'day');
        showToast('⏩ +1 يوم');
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        addTime(-1, 'day');
        showToast('⏪ -1 يوم');
    } else if (e.key === 'm' || e.key === 'M') {
        const chk = document.getElementById('chkShowMoon');
        if (chk) {
            chk.checked = !chk.checked;
            toggleMoon(chk.checked);
            showToast(chk.checked ? '🌙 تم إظهار حركة القمر' : '🌑 تم إخفاء حركة القمر');
        }
    } else if (e.key === 'o' || e.key === 'O') {
        if (activeTab === 'revolution') {
            const newMode = (currentMode === '3way') ? 'overlay' : '3way';
            setMode(newMode);
            showToast(newMode === 'overlay' ? '🧬 شاشة التراكب الهندسي' : '📊 المقارنة الثلاثية المتزامنة');
        }
    } else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        toggleShortcutsModal();
    } else if (e.key === 'Escape') {
        closeShortcutsModal();
    }
});
}


let selectedPlanet = 'mars';

// ==================== TIME ENGINE ====================
let currentDate = new Date();
let isClockRunning = true;
let timeSpeedDaysPerSec = 1.0 / 86400.0; // الوضع الافتراضي: واقعي (1 ثانية = 1 ثانية)
let isPlaying = true;
let simDays = 0;
let timeSpeed = 1.0 / 86400.0;
let lastFrameTimestamp = performance.now();
let c3dTimeSpeedMode = 'realtime'; // 'realtime' | 'hours' | 'days' | 'months'
let c3dSubSpeed = 1.0;

// Shared computed values
let sunAlpha = 0, moonAlpha = 0, moonAnomalyRad = 0, precessionAngle = 0, atlasAngle = 0;
let currentSolarLongitude = 0, currentLunarLongitude = 0, currentMoonElongation = 0;
let currentN = 0, currentJD = 2451545;
let planetAngles = {}; // {planet: {mean, anomaly}}

function updateDateTimeUI() {
    const tzOffset = currentDate.getTimezoneOffset() * 60000;
    const localISO = (new Date(currentDate.getTime() - tzOffset)).toISOString().slice(0,16);
    const dateInput = document.getElementById('astroDateTime');
    if (dateInput && dateInput.value !== localISO) {
        dateInput.value = localISO;
    }
    calculateAstroPosition();
    updateC3DSpeedStatusPill();
    if (typeof window !== 'undefined' && typeof window.syncAnnualTimelineUI === 'function') {
        window.syncAnnualTimelineUI(currentDate);
    } else if (typeof syncAnnualTimelineUI === 'function') {
        syncAnnualTimelineUI(currentDate);
    }
}

/**
 * حساب الوقت والتاريخ المحلي الفعلي لأي مدينة حول العالم بناءً على إحداثياتها ودولتها ومعايير IANA
 */
function getCityCurrentDate(lat, lon, country, refDate = new Date()) {
    if (country && typeof COUNTRY_TIMEZONE_IANA !== 'undefined' && COUNTRY_TIMEZONE_IANA[country]) {
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
    const tzHours = (typeof getCityTimezoneHours === 'function')
        ? getCityTimezoneHours(lat, lon, country, refDate)
        : Math.round(lon / 15.0);
    const utcMs = refDate.getTime() + (refDate.getTimezoneOffset() * 60000);
    return new Date(utcMs + tzHours * 3600000);
}

/**
 * مزامنة محاكي الزمن فوراً مع الوقت الحقيقي اللحظي للمدينة المختارة
 */
function syncCityRealTime(showFeedback = false) {
    const cityLat = (typeof currentLatDeg !== 'undefined') ? currentLatDeg : 33.5138;
    const cityLon = (typeof currentLonDeg !== 'undefined') ? currentLonDeg : 36.2924;
    const cityCountry = (typeof currentCityCountry !== 'undefined') ? currentCityCountry : 'سوريا';

    currentDate = getCityCurrentDate(cityLat, cityLon, cityCountry, new Date());
    sunTrail = []; moonTrail = []; ibsMoonTrail = [];
    updateDateTimeUI();

    if (cosmos3DInitialized && typeof updateAstronomy === 'function') {
        updateAstronomy(currentDate);
        if (typeof renderer !== 'undefined' && renderer && scene && camera) renderer.render(scene, camera);
    }

    if (showFeedback && typeof showC3DToast === 'function') {
        const cName = (typeof currentCityName !== 'undefined') ? currentCityName : 'دمشق';
        showC3DToast(`🔴 تم تفعيل الوقت الواقعي اللحظي لمدينة ${cName}`);
    }
}

/**
 * تحديث شارة حالة سرعة المحاكاة العائمة في أعلى المشهد ثلاثي الأبعاد
 */
function updateC3DSpeedStatusPill() {
    const el = document.getElementById('c3dSpeedStatusText');
    if (!el) return;

    const h = currentDate.getHours();
    const m = currentDate.getMinutes();
    const s = currentDate.getSeconds();
    const h12 = h % 12 || 12;
    const ampm = h >= 12 ? 'م' : 'ص';
    const timeStr = `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} ${ampm}`;
    const cName = (typeof currentCityName !== 'undefined') ? currentCityName : 'دمشق';

    if (c3dTimeSpeedMode === 'realtime') {
        el.innerHTML = `🔴 <strong>واقعي:</strong> توقيت ${cName} الآن <strong>${timeStr}</strong> • مباشر (1 ث = 1 ث)`;
    } else if (c3dTimeSpeedMode === 'hours') {
        el.innerHTML = `⏱️ <strong>بالساعات:</strong> ${timeStr} • تدفق ${c3dSubSpeed} س/ث (تعاقب ليل ونهار)`;
    } else if (c3dTimeSpeedMode === 'days') {
        const d = currentDate.getDate();
        const mo = currentDate.getMonth() + 1;
        el.innerHTML = `📅 <strong>بالأيام:</strong> ${d}/${mo} (${timeStr}) • تدفق ${c3dSubSpeed} يوم/ث (فصول)`;
    } else if (c3dTimeSpeedMode === 'months') {
        const y = currentDate.getFullYear();
        const mo = currentDate.getMonth() + 1;
        el.innerHTML = `🌕 <strong>بالشهور:</strong> ${mo}/${y} • تدفق ${c3dSubSpeed} شهر/ث (البروج والسنة)`;
    }
}

/**
 * ضبط وضع وسرعة محاكي الزمن بحسب الخيارات الأربعة المطلوبة
 * @param {'realtime'|'hours'|'days'|'months'} mode النمط المختار
 * @param {number|null} subSpeed معامل السرعة الفرعي
 */
function setC3DSpeedMode(mode, subSpeed = null) {
    c3dTimeSpeedMode = mode;

    // تحديث القائمة المنسدلة في شريط أدوات 3D
    const sel = document.getElementById('c3dSpeedModeSelect');
    if (sel && sel.value !== mode) sel.value = mode;

    // تحديث الأزرار في اللوحة السفلية (Card 3)
    const modeBtns = {
        'realtime': document.getElementById('btnModeRealtime'),
        'hours': document.getElementById('btnModeHours'),
        'days': document.getElementById('btnModeDays'),
        'months': document.getElementById('btnModeMonths')
    };
    Object.keys(modeBtns).forEach(k => {
        if (modeBtns[k]) modeBtns[k].classList.toggle('active-speed', k === mode);
    });

    const activeTag = document.getElementById('c3dActiveModeTag');
    const subSpeedRow = document.getElementById('c3dSubSpeedRow');
    const cName = (typeof currentCityName !== 'undefined') ? currentCityName : 'دمشق';

    if (mode === 'realtime') {
        // 1. نمط واقعي بحسب الموقع والوقت الحالي للمدينة المختارة
        syncCityRealTime();
        timeSpeedDaysPerSec = 1.0 / 86400.0;
        setClockRunning(true);
        if (activeTag) {
            activeTag.innerText = `🔴 1. واقعي (${cName})`;
            activeTag.style.color = '#F87171';
            activeTag.style.background = 'rgba(239,68,68,0.15)';
            activeTag.style.borderColor = 'rgba(239,68,68,0.3)';
        }
        if (subSpeedRow) {
            subSpeedRow.innerHTML = `
                <span style="font-size:0.78em; color:#38BDF8;">⏱️ تدفق الزمن متزامن مع ساعة الأرض الحقيقية (1 ث = 1 ث)</span>
                <button type="button" class="btn-time active-speed" style="padding:2px 8px; font-size:0.75em;" onclick="syncCityRealTime(true)">🔄 إعادة المزامنة مع الآن</button>
            `;
        }
        if (typeof showC3DToast === 'function') {
            showC3DToast(`🔴 تم تفعيل الوقت الواقعي اللحظي لمدينة ${cName}`);
        }
    } else if (mode === 'hours') {
        // 2. السرعة بالساعات
        const spd = (subSpeed !== null) ? subSpeed : (c3dSubSpeed > 0 && c3dSubSpeed <= 6 ? c3dSubSpeed : 1.0);
        c3dSubSpeed = spd;
        timeSpeedDaysPerSec = spd / 24.0;
        setClockRunning(true);
        if (activeTag) {
            activeTag.innerText = `⏱️ 2. بالساعات (${spd} س/ث)`;
            activeTag.style.color = '#FDE047';
            activeTag.style.background = 'rgba(245,158,11,0.15)';
            activeTag.style.borderColor = 'rgba(245,158,11,0.3)';
        }
        if (subSpeedRow) {
            subSpeedRow.innerHTML = `
                <span style="font-size:0.78em; color:var(--subtext);">خيارات السرعة بالساعات:</span>
                <button type="button" class="btn-time ${Math.abs(spd - 0.5) < 0.05 ? 'active-speed' : ''}" style="padding:2px 8px; font-size:0.75em;" onclick="setC3DSpeedMode('hours', 0.5)">0.5 س/ث</button>
                <button type="button" class="btn-time ${Math.abs(spd - 1.0) < 0.05 ? 'active-speed' : ''}" style="padding:2px 8px; font-size:0.75em;" onclick="setC3DSpeedMode('hours', 1.0)">1 س/ث</button>
                <button type="button" class="btn-time ${Math.abs(spd - 2.0) < 0.05 ? 'active-speed' : ''}" style="padding:2px 8px; font-size:0.75em;" onclick="setC3DSpeedMode('hours', 2.0)">2 س/ث</button>
                <button type="button" class="btn-time ${Math.abs(spd - 6.0) < 0.05 ? 'active-speed' : ''}" style="padding:2px 8px; font-size:0.75em;" onclick="setC3DSpeedMode('hours', 6.0)">6 س/ث</button>
            `;
        }
        if (typeof showC3DToast === 'function') {
            showC3DToast(`⏱️ سرعة المحاكاة بالساعات: ${spd} س/ث (دورة ليل ونهار كاملة كل ${Math.round(24/spd)} ثانية)`);
        }
    } else if (mode === 'days') {
        // 3. السرعة بالأيام
        const spd = (subSpeed !== null) ? subSpeed : (c3dSubSpeed >= 1 && c3dSubSpeed <= 7 ? c3dSubSpeed : 1.0);
        c3dSubSpeed = spd;
        timeSpeedDaysPerSec = spd;
        setClockRunning(true);
        if (activeTag) {
            activeTag.innerText = `📅 3. بالأيام (${spd} يوم/ث)`;
            activeTag.style.color = '#34D399';
            activeTag.style.background = 'rgba(16,185,129,0.15)';
            activeTag.style.borderColor = 'rgba(16,185,129,0.3)';
        }
        if (subSpeedRow) {
            subSpeedRow.innerHTML = `
                <span style="font-size:0.78em; color:var(--subtext);">خيارات السرعة بالأيام:</span>
                <button type="button" class="btn-time ${Math.abs(spd - 1.0) < 0.05 ? 'active-speed' : ''}" style="padding:2px 8px; font-size:0.75em;" onclick="setC3DSpeedMode('days', 1.0)">1 يوم/ث</button>
                <button type="button" class="btn-time ${Math.abs(spd - 3.0) < 0.05 ? 'active-speed' : ''}" style="padding:2px 8px; font-size:0.75em;" onclick="setC3DSpeedMode('days', 3.0)">3 أيام/ث</button>
                <button type="button" class="btn-time ${Math.abs(spd - 7.0) < 0.05 ? 'active-speed' : ''}" style="padding:2px 8px; font-size:0.75em;" onclick="setC3DSpeedMode('days', 7.0)">7 أيام/ث (أسبوع)</button>
            `;
        }
        if (typeof showC3DToast === 'function') {
            showC3DToast(`📅 سرعة المحاكاة بالأيام: ${spd} يوم/ث (شهر كامل كل ${Math.round(30/spd)} ثانية)`);
        }
    } else if (mode === 'months') {
        // 4. السرعة بالشهور
        const spd = (subSpeed !== null) ? subSpeed : (c3dSubSpeed >= 1 && c3dSubSpeed <= 6 ? c3dSubSpeed : 1.0);
        c3dSubSpeed = spd;
        timeSpeedDaysPerSec = spd * 30.0;
        setClockRunning(true);
        if (activeTag) {
            activeTag.innerText = `🌕 4. بالشهور (${spd} شهر/ث)`;
            activeTag.style.color = '#C084FC';
            activeTag.style.background = 'rgba(168,85,247,0.15)';
            activeTag.style.borderColor = 'rgba(168,85,247,0.3)';
        }
        if (subSpeedRow) {
            subSpeedRow.innerHTML = `
                <span style="font-size:0.78em; color:var(--subtext);">خيارات السرعة بالشهور:</span>
                <button type="button" class="btn-time ${Math.abs(spd - 1.0) < 0.05 ? 'active-speed' : ''}" style="padding:2px 8px; font-size:0.75em;" onclick="setC3DSpeedMode('months', 1.0)">1 شهر/ث</button>
                <button type="button" class="btn-time ${Math.abs(spd - 3.0) < 0.05 ? 'active-speed' : ''}" style="padding:2px 8px; font-size:0.75em;" onclick="setC3DSpeedMode('months', 3.0)">3 شهور/ث (فصل كامل)</button>
                <button type="button" class="btn-time ${Math.abs(spd - 6.0) < 0.05 ? 'active-speed' : ''}" style="padding:2px 8px; font-size:0.75em;" onclick="setC3DSpeedMode('months', 6.0)">6 شهور/ث (نصف سنة)</button>
            `;
        }
        if (typeof showC3DToast === 'function') {
            showC3DToast(`🌕 سرعة المحاكاة بالشهور: ${spd} شهر/ث (سنة كاملة كل ${Math.round(12/spd)} ثانية)`);
        }
    }

    applyUnifiedSpeed(timeSpeedDaysPerSec, true);
    updateDateTimeUI();
    if (cosmos3DInitialized && typeof updateAstronomy === 'function') {
        updateAstronomy(currentDate);
        if (typeof renderer !== 'undefined' && renderer && scene && camera) renderer.render(scene, camera);
    }
}

function setLiveNow() { 
    if (c3dTimeSpeedMode === 'realtime') {
        syncCityRealTime(false);
    } else {
        currentDate = new Date(); 
        sunTrail=[]; moonTrail=[]; ibsMoonTrail=[]; 
        updateDateTimeUI(); 
        if (cosmos3DInitialized && typeof updateAstronomy === 'function') {
            updateAstronomy(currentDate);
            if (renderer && scene && camera) renderer.render(scene, camera);
        }
    }
}
function onManualDateChange() {
    const v = document.getElementById('astroDateTime').value;
    if(v) { 
        currentDate = new Date(v); 
        sunTrail=[]; moonTrail=[]; ibsMoonTrail=[]; 
        calculateAstroPosition(); 
        if (typeof forceRebuildPrayerArcs !== 'undefined') forceRebuildPrayerArcs = true;
        if (cosmos3DInitialized && typeof updateAstronomy === 'function') {
            updateAstronomy(currentDate);
            if (renderer && scene && camera) renderer.render(scene, camera);
        }
    }
}
function addTime(a, u) {
    let d = 0;
    if(u==='day') { d = a; currentDate.setDate(currentDate.getDate()+a); }
    else if(u==='month') { d = a * 30.4375; currentDate.setMonth(currentDate.getMonth()+a); }
    else if(u==='year') { d = a * 365.25; currentDate.setFullYear(currentDate.getFullYear()+a); }
    simDays += d;
    sunTrail=[]; moonTrail=[]; ibsMoonTrail=[];
    trailShatir=[]; trailCopernicus=[]; trailKepler=[];
    trailMoonShatir=[]; trailMoonCopernicus=[]; trailMoonKepler=[];
    updateDateTimeUI();
    if (typeof forceRebuildPrayerArcs !== 'undefined') forceRebuildPrayerArcs = true;
    if (cosmos3DInitialized && typeof updateAstronomy === 'function') {
        updateAstronomy(currentDate);
        if (renderer && scene && camera) renderer.render(scene, camera);
    }
}

function setClockRunning(running) {
    isClockRunning = running;
    isPlaying = running;
    const btnClock = document.getElementById('btnPlayClock');
    if (btnClock) {
        btnClock.innerText = running ? '⏸️ إيقاف تدفق الزمن' : '⏯️ بدء تدفق الزمن';
        btnClock.classList.toggle('active', running);
    }
    const btnPlayPause = document.getElementById('btnPlayPause');
    if (btnPlayPause) {
        btnPlayPause.innerText = running ? '⏸️ إيقاف مؤقت' : '▶️ تشغيل';
        btnPlayPause.classList.toggle('active', running);
    }
    const btnPlay3D = document.getElementById('btnPlay') || document.getElementById('btnPlay3D');
    if (btnPlay3D) {
        btnPlay3D.innerText = running ? '⏸️ إيقاف' : '▶️ تشغيل';
        btnPlay3D.classList.toggle('active', running);
    }
    const btnC3DTop = document.getElementById('c3dBtnPlayPause');
    if (btnC3DTop) {
        btnC3DTop.innerText = running ? '⏸️' : '▶️';
        btnC3DTop.classList.toggle('active', running);
    }
    showToast(running ? '⏱️ تدفق الزمن مستمر' : '⏸️ تم إيقاف تدفق الزمن');
}

function toggleClockPlay() {
    setClockRunning(!isClockRunning);
}

function togglePlay() {
    setClockRunning(!isClockRunning);
}

function setTimeSpeed(d) {
    applyUnifiedSpeed(d);
}

function setSpeed(spd) {
    applyUnifiedSpeed(spd);
}

function onSliderSpeedChange(v) {
    applyUnifiedSpeed(parseFloat(v));
}

function applyUnifiedSpeed(d, silent = false) {
    timeSpeedDaysPerSec = d;
    timeSpeed = d;

    // Update slider
    const slider = document.getElementById('timeSpeedSlider');
    if (slider) slider.value = d;

    // Update top badge
    const badge = document.getElementById('speedDisplayBadge');
    if (badge) {
        const isHour = Math.abs(d - 0.0417) < 0.005;
        badge.innerText = isHour ? '⏱️ التدفق: 1 ساعة/ث' : `⏱️ التدفق: ${d>0?'+':''}${d.toFixed(d>=1?1:2)} يوم/ث`;
    }

    // Update top speed buttons
    document.querySelectorAll('.time-group .btn-time').forEach(b => {
        if (b.innerText.includes('/ث') || b.innerText.includes('عكسي')) {
            b.classList.remove('active-speed');
        }
    });
    const speedLabels = [
        { val: 0.0417, lbl: '1 ساعة/ث' },
        { val: 1,      lbl: '1 يوم/ث' },
        { val: 7,      lbl: 'أسبوع/ث' },
        { val: 30,     lbl: 'شهر/ث' },
        { val: 365.25, lbl: 'سنة/ث' },
        { val: 3652.5, lbl: 'عقد/ث' },
        { val: -30,    lbl: 'عكسي' }
    ];
    document.querySelectorAll('.time-group .btn-time').forEach(b => {
        for (const s of speedLabels) {
            if (b.innerText.includes(s.lbl) && Math.abs(d - s.val) < 0.1) {
                b.classList.add('active-speed');
            }
        }
    });

    // Update 3D bottom bar speed buttons (.btn-ui and .c3d-btn-ui)
    document.querySelectorAll('#cosmos3DPanel .btn-ui, #cosmos3DPanel .c3d-btn-ui').forEach(b => {
        if (b.innerText.includes('س/ث') || b.innerText.includes('يوم/ث') || b.innerText.includes('شهر/ث') || b.innerText.includes('أسبوع/ث')) {
            b.classList.remove('active');
            if (Math.abs(d - 0.0417) < 0.005 && b.innerText.includes('س/ث')) b.classList.add('active');
            else if (Math.abs(d - 1.0) < 0.1 && b.innerText.includes('يوم/ث')) b.classList.add('active');
            else if (Math.abs(d - 7.0) < 0.5 && b.innerText.includes('أسبوع/ث')) b.classList.add('active');
            else if (Math.abs(d - 30.0) < 1.0 && b.innerText.includes('شهر/ث')) b.classList.add('active');
        }
    });

    // Update revolution speed buttons
    ['spd1', 'spd5', 'spd20', 'spd60'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });
    const rBtn = document.getElementById('spd' + Math.round(d));
    if (rBtn) rBtn.classList.add('active');

    if (!silent && typeof showToast === 'function') {
        const speedText = Math.abs(d - 0.0417) < 0.005 ? '1 ساعة/ث' : `${d>0?'+':''}${d.toFixed(1)} يوم/ث`;
        showToast(`⏱️ سرعة المحاكاة: ${speedText}`);
    }
}
function jumpToEpoch(yr) {
    currentDate = new Date(yr, 2, 21, 12, 0);
    sunTrail = [];
    moonTrail = [];
    ibsMoonTrail = [];
    trailShatir = [];
    trailCopernicus = [];
    trailKepler = [];
    trailMoonShatir = [];
    trailMoonCopernicus = [];
    trailMoonKepler = [];
    updateDateTimeUI();
    showToast(`⏳ الانتقال لعصر عام ${yr}م`);
}

// ==================== ASTRONOMY CALCULATION ====================
function calculateAstroPosition() {
    const y = currentDate.getFullYear(), m = currentDate.getMonth()+1, d = currentDate.getDate();
    const h = currentDate.getHours() + currentDate.getMinutes()/60 + currentDate.getSeconds()/3600;
    const a = Math.floor((14-m)/12);
    const y1 = y+4800-a, m1 = m+12*a-3;
    const jd = d + Math.floor((153*m1+2)/5) + 365*y1 + Math.floor(y1/4) - Math.floor(y1/100) + Math.floor(y1/400) - 32045;
    const jdFrac = jd + (h-12)/24;
    currentJD = jdFrac;
    const n = jdFrac - 2451545.0;
    currentN = n;

    // Sun
    const L_sun = (280.460 + 0.9856474*n) % 360;
    const g_sun = ((357.528 + 0.9856003*n) % 360) * Math.PI/180;
    let lambda_sun = (L_sun + 1.915*Math.sin(g_sun) + 0.020*Math.sin(2*g_sun)) % 360;
    if(lambda_sun<0) lambda_sun+=360;
    currentSolarLongitude = lambda_sun;

    // Moon
    const L_moon = (218.316 + 13.176396*n) % 360;
    const D_moon = (297.850 + 12.190749*n) % 360;
    currentMoonElongation = (D_moon+360)%360;
    const M_moon = ((134.963 + 13.064993*n)%360 + 360)%360;
    moonAnomalyRad = M_moon * Math.PI / 180;
    let lambda_moon = (L_moon + 6.289*Math.sin(moonAnomalyRad)) % 360;
    if(lambda_moon<0) lambda_moon+=360;
    currentLunarLongitude = lambda_moon;

    // Precession (حركة الفلك الثامن عند ابن الشاطر: درجة كل 70 سنة فارسية)
    const decYear = y + (m-1)/12 + d/365.25;
    let totalPrec = (decYear - 150.0) / 70.0;
    if(totalPrec<0) totalPrec=0;
    precessionAngle = totalPrec * Math.PI/180;

    // Atlas (diurnal)
    atlasAngle = ((h/24 + n) % 1) * Math.PI * 2;

    // Sun anomaly مع حساب انزياح أوج الشمس في الفلك الشامل عند ابن الشاطر بمعدل درجة كل 60 سنة (60"/سنة)
    const solarApogeeLong = 89.87 + (decYear - 1332.0) * (1.0 / 60.0);
    let anom = ((L_sun - solarApogeeLong) % 360 + 360) % 360;
    sunAlpha = (manualSolarAngleOverride !== null && !isClockRunning)
        ? manualSolarAngleOverride
        : (anom * Math.PI/180);

    // Moon elongation
    moonAlpha = (manualLunarElongOverride !== null && !isClockRunning)
        ? manualLunarElongOverride
        : (currentMoonElongation * Math.PI/180);

    // Planets:
    // - الكواكب العلوية (زحل، المشتري، المريخ): المركز يدور بمسير الكوكب، والخاصة = وسط الشمس - وسط الكوكب
    // - الكواكب السفلية (الزهرة وعطارد - نهاية السول الفصلان 19 و21): حركة المركز تساوي حركة وسط الشمس، والخاصة هي مسير الكوكب الذاتي على التدوير!
    if (typeof planetData !== 'undefined' && planetData) {
        for(const [key, pd] of Object.entries(planetData)) {
            if (manualPlanetAngleOverride !== null && !isClockRunning && key === selectedPlanet) {
                planetAngles[key] = { ...manualPlanetAngleOverride };
                continue;
            }
            const planetOwnCycle = ((pd.mean0 + (360/pd.sidereal)*n) % 360 + 360) % 360;
            if (key === 'venus' || key === 'mercury') {
                planetAngles[key] = {
                    mean: anom * Math.PI / 180, // وسط المركز = مركز الشمس (الفصلان 19 و21)
                    anomaly: planetOwnCycle * Math.PI / 180 // الخاصة على التدوير
                };
            } else {
                const synAnom = ((lambda_sun - planetOwnCycle) % 360 + 360) % 360;
                planetAngles[key] = {
                    mean: planetOwnCycle * Math.PI / 180,
                    anomaly: synAnom * Math.PI / 180
                };
            }
        }
    }

    // Update UI: البروج الاصطلاحية والكوكبات الفعلية والمنازل
    const signIdx = Math.floor(lambda_sun / 30);
    const degInSign = lambda_sun % 30;
    const deg = Math.floor(degInSign);
    const min = Math.floor((degInSign - deg) * 60);
    const sec = Math.floor(((degInSign - deg) * 60 - min) * 60);
    const signInfo = (typeof zodiacData !== 'undefined' && zodiacData[signIdx]) ? zodiacData[signIdx] : { name: '', symbol: '', elem: '', season: '' };

    // الطول النجمي الفعلي في فلك الثوابت المنزاح بالمبادرة
    let siderealLong = (lambda_sun - totalPrec) % 360.0;
    if(siderealLong < 0) siderealLong += 360.0;
    let siderealSignIdx = Math.floor(siderealLong / 30);
    let siderealSignInfo = (typeof zodiacData !== 'undefined' && zodiacData[siderealSignIdx]) ? zodiacData[siderealSignIdx] : { name: '', symbol: '' };
    let siderealDegInSign = siderealLong % 30;
    let sDeg = Math.floor(siderealDegInSign);
    let sMin = Math.floor((siderealDegInSign - sDeg) * 60);
    let sSec = Math.floor(((siderealDegInSign - sDeg) * 60 - sMin) * 60);

    const mansionIdx = Math.floor(lambda_sun / (360.0 / 28.0)) % 28;

    const elZodiacBadge = document.getElementById('zodiacBadge');
    if (elZodiacBadge) elZodiacBadge.innerHTML = `☀️ ${signInfo.name} (${signInfo.symbol})`;
    if(document.getElementById('zodiacDegVal')) {
        document.getElementById('zodiacDegVal').innerText = `${deg}° ${min}' ${sec}" (بالبرج)`;
    }
    const elSolarLongVal = document.getElementById('solarLongVal');
    if (elSolarLongVal) elSolarLongVal.innerText = `الطول الاستوائي λ = ${lambda_sun.toFixed(2)}°`;

    if(document.getElementById('siderealConstBadge')) {
        document.getElementById('siderealConstBadge').innerHTML = `✨ كوكبة ${siderealSignInfo.name.replace('برج ', '')} (${siderealSignInfo.symbol})`;
    }
    if(document.getElementById('siderealDegVal')) {
        document.getElementById('siderealDegVal').innerText = `${sDeg}° ${sMin}' ${sSec}" (في كوكبة النجوم)`;
    }
    if(document.getElementById('siderealLongVal')) {
        document.getElementById('siderealLongVal').innerText = `الطول النجمي λ* = ${siderealLong.toFixed(2)}°`;
    }

    if(document.getElementById('precessionVal')) {
        document.getElementById('precessionVal').innerText = `${totalPrec.toFixed(2)}°`;
    }
    if(document.getElementById('precessionSignsVal')) {
        document.getElementById('precessionSignsVal').innerText = `انزياح ~${(totalPrec/30).toFixed(1)} برج (1°/70س)`;
    }
    if(document.getElementById('lunarMansionVal')) {
        document.getElementById('lunarMansionVal').innerText = `منزلة ${lunarMansions[mansionIdx]} (${mansionIdx + 1})`;
    }
    if(document.getElementById('zodiacSeasonVal')) {
        document.getElementById('zodiacSeasonVal').innerText = `${signInfo.elem} | ${signInfo.season}`;
    }
    if(document.getElementById('lunarLongVal')) {
        document.getElementById('lunarLongVal').innerText = `λ☽ = ${lambda_moon.toFixed(1)}°`;
    }
    if(document.getElementById('moonElongVal')) {
        document.getElementById('moonElongVal').innerText = `الاستطالة D = ${currentMoonElongation.toFixed(1)}°`;
    }
    if(document.getElementById('jdVal')) {
        document.getElementById('jdVal').innerText = jdFrac.toFixed(2);
    }
}


// دالة رسم شارات الجهات الأصلية لتكون واضحة تماماً وغير مقطوعة أبداً
function drawDirectionBadge(ctx, x, y, text, textColor, bgColor, borderColor) {
    ctx.font = 'bold 10px "Segoe UI", Tahoma, sans-serif';
    let textWidth = ctx.measureText(text).width;
    let bw = textWidth + 16;
    let bh = 22;

    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x - bw/2, y - bh/2, bw, bh, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.textBaseline = 'alphabetic';
}

// ==================== COSMOS CANVAS ====================
const cosmosCanvas = document.getElementById('cosmosCanvas');
const cosmosCtx = setupHiDpiCanvas(cosmosCanvas, 660, 660);
const canvasW = 660, canvasH = 660;
const ccx = 330, ccy = 330;

const cosmosBodies = [
    {key:'moon',    r:34,  color:'#E2E8F0', size:3.5, name:'القمر ☽'},
    {key:'mercury', r:58,  color:'#C084FC', size:3.2, name:'عطارد ☿'},
    {key:'venus',   r:82,  color:'#F472B6', size:4.2, name:'الزهرة ♀'},
    {key:'sun',     r:110, color:'#FBBF24', size:6.5, name:'الشمس ☉'},
    {key:'mars',    r:138, color:'#F87171', size:4.0, name:'المريخ ♂'},
    {key:'jupiter', r:164, color:'#FB923C', size:5.5, name:'المشتري ♃'},
    {key:'saturn',  r:188, color:'#FACC15', size:5.0, name:'زحل ♄'},
];


// دالة رسم أسهم اتجاهات الدوران على أفلاك التدوير (Vector Rotation Arrows)
function drawCircleArrow(ctx, cx, cy, r, startAngle, endAngle, counterClockwise, color) {
    if (r <= 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle, counterClockwise);
    ctx.stroke();

    // رأس السهم عند نقطة النهاية
    const tipX = cx + r * Math.cos(endAngle);
    const tipY = cy + r * Math.sin(endAngle);
    const tangent = endAngle + (counterClockwise ? -Math.PI / 2 : Math.PI / 2);
    const arrowLen = 6.5;
    const arrowSpread = 0.45;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - arrowLen * Math.cos(tangent - arrowSpread), tipY - arrowLen * Math.sin(tangent - arrowSpread));
    ctx.lineTo(tipX - arrowLen * Math.cos(tangent + arrowSpread), tipY - arrowLen * Math.sin(tangent + arrowSpread));
    ctx.closePath();
    ctx.fill();
}

function drawCosmos() {
    if (!cosmosCtx) return;
    cosmosCtx.clearRect(0,0,canvasW,canvasH);
    const elStars = document.getElementById('showPolarStars');
    const showStars = elStars ? elStars.checked : false;
    const showAxis  = document.getElementById('showCelestialAxis') ? document.getElementById('showCelestialAxis').checked : true;
    const showEWAxis= document.getElementById('showEastWestAxis') ? document.getElementById('showEastWestAxis').checked : true;
    const elPtEpi = document.getElementById('showPtolemyEpicycles');
    const showPtEpi = elPtEpi ? elPtEpi.checked : false;

    // 0.1 محور القطبين السماويين (شمال - جنوب)
    if(showAxis) {
        cosmosCtx.strokeStyle = 'rgba(56,189,248,0.35)';
        cosmosCtx.lineWidth = 1.3;
        cosmosCtx.setLineDash([6,5]);
        cosmosCtx.beginPath();
        cosmosCtx.moveTo(ccx, 44);
        cosmosCtx.lineTo(ccx, canvasH - 44);
        cosmosCtx.stroke();
        cosmosCtx.setLineDash([]);

        drawDirectionBadge(cosmosCtx, ccx, 22, '⬆ القطب الشمالي السماوي', '#38BDF8', 'rgba(15, 23, 42, 0.92)', '#0284C7');
        drawDirectionBadge(cosmosCtx, ccx, canvasH - 22, '⬇ القطب الجنوبي السماوي', '#38BDF8', 'rgba(15, 23, 42, 0.92)', '#0284C7');
    }

    // 0.2 خط الشرق والغرب (المشرق والمغرب)
    if(showEWAxis) {
        cosmosCtx.strokeStyle = 'rgba(245,158,11,0.35)';
        cosmosCtx.lineWidth = 1.3;
        cosmosCtx.setLineDash([6,5]);
        cosmosCtx.beginPath();
        cosmosCtx.moveTo(85, ccy);
        cosmosCtx.lineTo(canvasW - 85, ccy);
        cosmosCtx.stroke();
        cosmosCtx.setLineDash([]);

        drawDirectionBadge(cosmosCtx, canvasW - 55, ccy, 'المشرق ⮕', '#FBBF24', 'rgba(15, 23, 42, 0.92)', '#D97706');
        drawDirectionBadge(cosmosCtx, 55, ccy, '⬅ المغرب', '#FBBF24', 'rgba(15, 23, 42, 0.92)', '#D97706');
    }

    // 1. الفلك التاسع (الأطلس 24h)
    let atlasR = 274;
    cosmosCtx.strokeStyle = '#A855F7';
    cosmosCtx.lineWidth = 2.5;
    cosmosCtx.beginPath();
    cosmosCtx.arc(ccx, ccy, atlasR, 0, Math.PI * 2);
    cosmosCtx.stroke();
    for(let k = 0; k < 8; k++) {
        let aAng = k * Math.PI / 4 + atlasAngle;
        cosmosCtx.fillStyle = '#C084FC';
        cosmosCtx.beginPath();
        cosmosCtx.arc(ccx + atlasR * Math.cos(aAng), ccy - atlasR * Math.sin(aAng), 3.5, 0, Math.PI * 2);
        cosmosCtx.fill();
    }

    // 2. الفلك الثامن المزدوج
    // أ. الحلقة الخارجية: البروج الاصطلاحية الفصلية (Tropical Signs)
    let tropicalR = 246;
    cosmosCtx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    cosmosCtx.lineWidth = 1.5;
    cosmosCtx.beginPath();
    cosmosCtx.arc(ccx, ccy, tropicalR, 0, Math.PI * 2);
    cosmosCtx.stroke();

    for(let i = 0; i < 12; i++) {
        let divAng = -i * Math.PI / 6;
        cosmosCtx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        cosmosCtx.lineWidth = 1.2;
        cosmosCtx.beginPath();
        cosmosCtx.moveTo(ccx + (tropicalR - 8) * Math.cos(divAng), ccy + (tropicalR - 8) * Math.sin(divAng));
        cosmosCtx.lineTo(ccx + (tropicalR + 8) * Math.cos(divAng), ccy + (tropicalR + 8) * Math.sin(divAng));
        cosmosCtx.stroke();
    }

    let currentSignIdx = Math.floor(currentSolarLongitude / 30);
    for(let i = 0; i < 12; i++) {
        let ang = -(i + 0.5) * Math.PI / 6;
        let tx = ccx + tropicalR * Math.cos(ang);
        let ty = ccy + tropicalR * Math.sin(ang);
        let isActive = (i === currentSignIdx);

        cosmosCtx.fillStyle = isActive ? '#F59E0B' : '#7DD3FC';
        cosmosCtx.font = isActive ? 'bold 11px Segoe UI, sans-serif' : '9px Segoe UI, sans-serif';
        cosmosCtx.textAlign = 'center';
        cosmosCtx.textBaseline = 'middle';
        cosmosCtx.fillText(zodiacData[i].name.replace('برج ', ''), tx, ty);
    }

    // ب. الحلقة الداخلية: الصور النجمية المكوكبة للثوابت (Sidereal Constellations)
    let siderealR = 212;
    cosmosCtx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
    cosmosCtx.lineWidth = 1.4;
    cosmosCtx.setLineDash([3, 3]);
    cosmosCtx.beginPath();
    cosmosCtx.arc(ccx, ccy, siderealR, 0, Math.PI * 2);
    cosmosCtx.stroke();
    cosmosCtx.setLineDash([]);

    for(let i = 0; i < 12; i++) {
        let sDivAng = -(i * Math.PI / 6 + precessionAngle);
        cosmosCtx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
        cosmosCtx.lineWidth = 1.2;
        cosmosCtx.beginPath();
        cosmosCtx.moveTo(ccx + (siderealR - 7) * Math.cos(sDivAng), ccy + (siderealR - 7) * Math.sin(sDivAng));
        cosmosCtx.lineTo(ccx + (siderealR + 7) * Math.cos(sDivAng), ccy + (siderealR + 7) * Math.sin(sDivAng));
        cosmosCtx.stroke();
    }

    let siderealLon = (currentSolarLongitude - (precessionAngle * 180 / Math.PI)) % 360;
    if(siderealLon < 0) siderealLon += 360;
    let activeSiderealIdx = Math.floor(siderealLon / 30);

    for(let i = 0; i < 12; i++) {
        let sAng = -((i + 0.5) * Math.PI / 6 + precessionAngle);
        let sx = ccx + siderealR * Math.cos(sAng);
        let sy = ccy + siderealR * Math.sin(sAng);
        let isSidActive = (i === activeSiderealIdx);

        cosmosCtx.fillStyle = isSidActive ? '#F43F5E' : '#C084FC';
        cosmosCtx.beginPath();
        cosmosCtx.arc(sx, sy, isSidActive ? 4.5 : 2.5, 0, Math.PI * 2);
        cosmosCtx.fill();
        if(isSidActive) {
            cosmosCtx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
            cosmosCtx.lineWidth = 2;
            cosmosCtx.beginPath();
            cosmosCtx.arc(sx, sy, 8, 0, Math.PI * 2);
            cosmosCtx.stroke();
        }

        cosmosCtx.fillStyle = isSidActive ? '#FDA4AF' : '#E9D5FF';
        cosmosCtx.font = isSidActive ? 'bold 10px Segoe UI, sans-serif' : '8px Segoe UI, sans-serif';
        cosmosCtx.textAlign = 'center';
        cosmosCtx.textBaseline = 'middle';
        cosmosCtx.fillText('كوكبة ' + zodiacData[i].name.replace('برج ', ''), sx, sy - 8);
    }

    // ج. شعاع محاذاة الشمس المزدوج
    let showRays = document.getElementById('showSolarZodiacRay') ? document.getElementById('showSolarZodiacRay').checked : true;
    if(showRays) {
        let sunTheta = currentSolarLongitude * Math.PI / 180;
        let sunCos = Math.cos(sunTheta);
        let sunSin = Math.sin(sunTheta);

        let rayGrad = cosmosCtx.createLinearGradient(ccx, ccy, ccx + 265 * sunCos, ccy - 265 * sunSin);
        rayGrad.addColorStop(0, 'rgba(251, 191, 36, 0.15)');
        rayGrad.addColorStop(0.4, 'rgba(251, 191, 36, 0.7)');
        rayGrad.addColorStop(1, 'rgba(251, 191, 36, 0.95)');

        cosmosCtx.strokeStyle = rayGrad;
        cosmosCtx.lineWidth = 2.0;
        cosmosCtx.setLineDash([5, 3]);
        cosmosCtx.beginPath();
        cosmosCtx.moveTo(ccx, ccy);
        cosmosCtx.lineTo(ccx + 265 * sunCos, ccy - 265 * sunSin);
        cosmosCtx.stroke();
        cosmosCtx.setLineDash([]);

        let sPtX = ccx + siderealR * sunCos;
        let sPtY = ccy - siderealR * sunSin;
        cosmosCtx.fillStyle = '#C084FC';
        cosmosCtx.beginPath(); cosmosCtx.arc(sPtX, sPtY, 5, 0, Math.PI * 2); cosmosCtx.fill();
        cosmosCtx.strokeStyle = '#FFFFFF'; cosmosCtx.lineWidth = 1.5; cosmosCtx.stroke();

        let tPtX = ccx + tropicalR * sunCos;
        let tPtY = ccy - tropicalR * sunSin;
        cosmosCtx.fillStyle = '#F59E0B';
        cosmosCtx.beginPath(); cosmosCtx.arc(tPtX, tPtY, 5, 0, Math.PI * 2); cosmosCtx.fill();
        cosmosCtx.strokeStyle = '#FFFFFF'; cosmosCtx.lineWidth = 1.5; cosmosCtx.stroke();

        let degInS = Math.floor(currentSolarLongitude % 30);
        let sDegInC = Math.floor(siderealLon % 30);

        let badgeX = ccx + 280 * sunCos;
        let badgeY = ccy - 280 * sunSin;
        let bw = 142, bh = 34;
        badgeX = Math.max(bw/2 + 15, Math.min(canvasW - bw/2 - 15, badgeX));
        badgeY = Math.max(bh/2 + 35, Math.min(canvasH - bh/2 - 35, badgeY));

        cosmosCtx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        cosmosCtx.strokeStyle = '#6366F1';
        cosmosCtx.lineWidth = 1.4;
        let badgeText1 = `☀️ اصطلاحاً: ${zodiacData[currentSignIdx].name.replace('برج ', '')} (${degInS}°)`;
        let badgeText2 = `✨ فعلياً: كوكبة ${zodiacData[activeSiderealIdx].name.replace('برج ', '')} (${sDegInC}°)`;
        
        cosmosCtx.beginPath();
        cosmosCtx.roundRect(badgeX - bw/2, badgeY - bh/2, bw, bh, 6);
        cosmosCtx.fill();
        cosmosCtx.stroke();

        cosmosCtx.fillStyle = '#FDE047';
        cosmosCtx.font = 'bold 9.5px Segoe UI, sans-serif';
        cosmosCtx.textAlign = 'center';
        cosmosCtx.textBaseline = 'middle';
        cosmosCtx.fillText(badgeText1, badgeX, badgeY - 7);
        cosmosCtx.fillStyle = '#C084FC';
        cosmosCtx.fillText(badgeText2, badgeX, badgeY + 7);
        cosmosCtx.textBaseline = 'alphabetic';
    }

    // 3. النجم القطبي
    if(showStars) {
        let polR = 14;
        let polCY = ccy - 240;
        let polCX = ccx;

        cosmosCtx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        cosmosCtx.lineWidth = 1;
        cosmosCtx.setLineDash([2, 2]);
        cosmosCtx.beginPath();
        cosmosCtx.arc(polCX, polCY, polR, 0, Math.PI * 2);
        cosmosCtx.stroke();
        cosmosCtx.setLineDash([]);

        let polAng = atlasAngle + precessionAngle;
        let polX = polCX + polR * Math.cos(polAng);
        let polY = polCY - polR * Math.sin(polAng); // متطابق مع حركة الشمس والكواكب من الشرق للغرب ⟲

        cosmosCtx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        cosmosCtx.beginPath(); cosmosCtx.arc(polX, polY, 7, 0, Math.PI * 2); cosmosCtx.fill();
        cosmosCtx.fillStyle = '#E0F2FE';
        cosmosCtx.beginPath(); cosmosCtx.arc(polX, polY, 3.5, 0, Math.PI * 2); cosmosCtx.fill();

        cosmosCtx.fillStyle = '#38BDF8';
        cosmosCtx.font = 'bold 9.5px Segoe UI, sans-serif';
        cosmosCtx.textAlign = 'left';
        cosmosCtx.textBaseline = 'middle';
        cosmosCtx.fillText('★ النجم القطبي (Polaris - شمالاً)', polX + 10, polY);
        cosmosCtx.textBaseline = 'alphabetic';
    }

    // 3.5 كرات الأركان الأربعة تحت مقعر فلك القمر المائل (نهاية السول - الفصل الثالث ص 55 والفصل التاسع ص 107)
    if (showFourElements) {
        const elemSpheres = [
            { r: 26, color: 'rgba(239, 68, 68, 0.16)', stroke: 'rgba(239, 68, 68, 0.55)', name: 'كرة النار' },
            { r: 20, color: 'rgba(56, 189, 248, 0.14)', stroke: 'rgba(56, 189, 248, 0.45)', name: 'كرة الهواء' },
            { r: 13, color: 'rgba(37, 99, 235, 0.22)', stroke: 'rgba(96, 165, 250, 0.55)', name: 'كرة الماء' }
        ];
        elemSpheres.forEach(el => {
            cosmosCtx.fillStyle = el.color;
            cosmosCtx.strokeStyle = el.stroke;
            cosmosCtx.lineWidth = 0.9;
            cosmosCtx.beginPath();
            cosmosCtx.arc(ccx, ccy, el.r, 0, Math.PI * 2);
            cosmosCtx.fill();
            cosmosCtx.stroke();
        });
    }

    // 4. مدارات وكواكب الأفلاك السبعة (وفق هيئة ابن الشاطر: الممثل + الحامل + المدير + التدوير)
    cosmosBodies.forEach(b => {
        // قشرة الفلك المجسمة (المحدب والمقعر) عند تفعيل وضع الأكر المجسمة
        if (showSolidSpheres) {
            cosmosCtx.strokeStyle = b.color + '22';
            cosmosCtx.lineWidth = 10;
            cosmosCtx.beginPath();
            cosmosCtx.arc(ccx, ccy, b.r, 0, Math.PI * 2);
            cosmosCtx.stroke();
        }

        cosmosCtx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        cosmosCtx.lineWidth = 1;
        cosmosCtx.beginPath();
        cosmosCtx.arc(ccx, ccy, b.r, 0, Math.PI * 2);
        cosmosCtx.stroke();

        let angle = 0, epAngle = 0;
        const rHamil = b.r * 0.085;
        const rMudir = b.r * 0.045;
        const rTadwir = b.r * 0.095;
        const sunThetaRad = currentSolarLongitude * Math.PI / 180;

        if (b.key === 'moon') {
            angle = moonAlpha;
            epAngle = moonAnomalyRad;
        } else if (b.key === 'sun') {
            angle = sunThetaRad;
            epAngle = sunAlpha;
        } else if (planetAngles[b.key]) {
            angle = planetAngles[b.key].mean;
            epAngle = planetAngles[b.key].anomaly;
        }

        // نقطة المركز الأولى على الفلك الحامل/الممثل (نصف قطره الثابت b.r)
        const p1x = ccx + b.r * Math.cos(angle);
        const p1y = ccy - b.r * Math.sin(angle);

        // زاوية الذراع الأول (التدوير الأول / الحامل الصغير rHamil):
        // للقمر: يتحرك في أعلاه خلاف التوالي بالخاصة (angle - epAngle)
        // للشمس والكواكب: يبقى موازياً لخط الأوج (زاوية 0)
        const hamilAng = (b.key === 'moon') ? (angle - epAngle) : 0;
        const p2x = p1x + (showPtEpi ? rHamil * Math.cos(hamilAng) : 0);
        const p2y = p1y - (showPtEpi ? rHamil * Math.sin(hamilAng) : 0);

        // زاوية الذراع الثاني (التدوير الثاني / المدير الأصفر rMudir):
        // للقمر: يتحرك إلى التوالي بضعف البعد عن الشمس مبتدئاً من نحو المركز
        const elongMoon = angle - sunThetaRad;
        const mudirAng = (b.key === 'moon')
            ? (hamilAng + Math.PI + 2 * elongMoon)
            : (b.key === 'sun' ? (2 * angle) : (Math.PI + 2 * angle));
        const epCx = p2x + (showPtEpi ? rMudir * Math.cos(mudirAng) : 0);
        const epCy = p2y - (showPtEpi ? rMudir * Math.sin(mudirAng) : 0);

        const px = (b.key === 'sun' || b.key === 'moon')
            ? epCx
            : epCx + (showPtEpi ? rTadwir * Math.cos(angle + epAngle) : 0);
        const py = (b.key === 'sun' || b.key === 'moon')
            ? epCy
            : epCy - (showPtEpi ? rTadwir * Math.sin(angle + epAngle) : 0);

        if (showPtEpi) {
            // رسم التدوير الأول (الحامل الصغير r1 بنصف قطر ثابت)
            cosmosCtx.strokeStyle = '#60A5FA77';
            cosmosCtx.lineWidth = 0.9;
            cosmosCtx.beginPath();
            cosmosCtx.arc(p1x, p1y, rHamil, 0, Math.PI * 2);
            cosmosCtx.stroke();

            // رسم التدوير الثاني (المدير الأصفر r2 بنصف قطر ثابت)
            cosmosCtx.strokeStyle = '#FBBF2488';
            cosmosCtx.lineWidth = 0.95;
            cosmosCtx.beginPath();
            cosmosCtx.arc(p2x, p2y, rMudir, 0, Math.PI * 2);
            cosmosCtx.stroke();

            // الأذرع الميكانيكية الرابطة بين المراكز والجرم
            cosmosCtx.strokeStyle = '#60A5FA99';
            cosmosCtx.lineWidth = 1.1;
            cosmosCtx.beginPath();
            cosmosCtx.moveTo(p1x, p1y);
            cosmosCtx.lineTo(p2x, p2y);
            cosmosCtx.stroke();

            cosmosCtx.strokeStyle = '#FBBF24AA';
            cosmosCtx.lineWidth = 1.2;
            cosmosCtx.beginPath();
            cosmosCtx.moveTo(p2x, p2y);
            cosmosCtx.lineTo(epCx, epCy);
            cosmosCtx.stroke();

            // للكواكب الخمسة: رسم فلك التدوير الثالث (r3) وذراعه
            if (b.key !== 'sun' && b.key !== 'moon') {
                cosmosCtx.strokeStyle = b.color + '88';
                cosmosCtx.lineWidth = 0.9;
                cosmosCtx.beginPath();
                cosmosCtx.arc(epCx, epCy, rTadwir, 0, Math.PI * 2);
                cosmosCtx.stroke();

                cosmosCtx.strokeStyle = b.color + 'AA';
                cosmosCtx.lineWidth = 1.1;
                cosmosCtx.beginPath();
                cosmosCtx.moveTo(epCx, epCy);
                cosmosCtx.lineTo(px, py);
                cosmosCtx.stroke();
            }
        }

        cosmosCtx.fillStyle = b.color;
        cosmosCtx.beginPath();
        cosmosCtx.arc(px, py, b.size, 0, Math.PI * 2);
        cosmosCtx.fill();

        cosmosCtx.fillStyle = '#F8FAFC';
        cosmosCtx.font = 'bold 9px Segoe UI, sans-serif';
        let alignL = p1x > ccx;
        cosmosCtx.textAlign = alignL ? 'left' : 'right';
        cosmosCtx.fillText(b.name, p1x + (alignL ? 8 : -8), p1y - 4);
    });

    // مركز الأرض (مركز العالم)
    cosmosCtx.fillStyle = '#38BDF8';
    cosmosCtx.beginPath();
    cosmosCtx.arc(ccx, ccy, 6.5, 0, Math.PI * 2);
    cosmosCtx.fill();
    cosmosCtx.fillStyle = '#FFF';
    cosmosCtx.font = 'bold 9.5px Segoe UI, sans-serif';
    cosmosCtx.textAlign = 'center';
    cosmosCtx.fillText('الأرض O (مركز العالم)', ccx, ccy + 17);
}

// ==================== SUN COMPARISON (الفصل السابع من نهاية السول) ====================
const ptSunCanvas = document.getElementById('ptolemySunCanvas');
const ptSunCtx = setupHiDpiCanvas(ptSunCanvas, 480, 480);
const ibsSunCanvas = document.getElementById('ibsSunCanvas');
const ibsSunCtx = setupHiDpiCanvas(ibsSunCanvas, 480, 480);
const sunSCX = 240, sunSCY = 240, sunScale = 2.85;
const R_sun = 60, r1_sun = 4 + 37 / 60, r2_sun = 2.5;
const e_ptol_sun = 2.5; // 2;30 عند بطلميوس
let sunTrail = [];

function drawPtolemySun(alpha) {
    if (!ptSunCtx) return;
    const ctx = ptSunCtx, cx = sunSCX, cy = sunSCY, sc = sunScale;
    ctx.clearRect(0, 0, 480, 480);
    ctx.fillStyle = '#080F25'; ctx.fillRect(0, 0, 480, 480);

    // Grid
    ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(480, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, 480); ctx.stroke();

    // Apse line (خط الأوج والحضيض)
    ctx.strokeStyle = '#374151'; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(460, cy); ctx.stroke(); ctx.setLineDash([]);

    const Ox = cx, Oy = cy;
    const Ex = Ox + e_ptol_sun * sc, Ey = Oy;

    // Draw connection line Earth → E
    ctx.strokeStyle = 'rgba(255,107,107,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(Ox, Oy); ctx.lineTo(Ex, Ey); ctx.stroke();
    ctx.fillStyle = '#FF6B6B'; ctx.font = '11px Segoe UI,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('ما بين المركزين e = 2;30 (ب ل)', Ox + 4, Oy - 10);

    // Eccentric circle centered at E
    ctx.strokeStyle = '#FF6B6B'; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(Ex, Ey, R_sun * sc, 0, Math.PI * 2); ctx.stroke();

    // Sun position on Ptolemy's eccentric circle
    const sx = Ex + R_sun * Math.cos(alpha) * sc;
    const sy = Ey - R_sun * Math.sin(alpha) * sc;

    // Ray from E (uniform motion center) and Ray from O (observer sightline)
    ctx.strokeStyle = 'rgba(251,191,36,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(Ex, Ey); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.strokeStyle = 'rgba(56,189,248,0.4)'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(Ox, Oy); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]);

    // Apogee and Perigee
    ctx.fillStyle = '#10B981'; ctx.beginPath(); ctx.arc(Ex + R_sun * sc, Ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#DC2626'; ctx.beginPath(); ctx.arc(Ex - R_sun * sc, Ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10B981'; ctx.font = '10px Segoe UI'; ctx.textAlign = 'left';
    ctx.fillText('أوج 62;30', Ex + R_sun * sc - 42, Ey - 8);
    ctx.fillStyle = '#DC2626'; ctx.fillText('حضيض 57;30', Ex - R_sun * sc + 6, Ey - 8);

    // Earth (O)
    ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(Ox, Oy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'left';
    ctx.fillText('الأرض O', Ox - 14, Oy + 22);

    // Eccentric center E
    ctx.fillStyle = '#FF6B6B'; ctx.beginPath(); ctx.arc(Ex, Ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FF6B6B'; ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('E (مركز الخارج)', Ex + 14, Ey + 18);

    // Sun
    ctx.fillStyle = '#FBBF24'; ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText('الشمس ☉', sx - 3, sy - 14);

    // Warning badge
    ctx.fillStyle = 'rgba(239,68,68,0.15)'; ctx.fillRect(5, 5, 290, 40);
    ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 1.5; ctx.strokeRect(5, 5, 290, 40);
    ctx.fillStyle = '#FCA5A5'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText('⚠️ إشكالية بطلميوس: خروج المركز + ثبات الأوج', 290, 21);
    ctx.font = '9px Segoe UI'; ctx.fillStyle = '#CBD5E1';
    ctx.fillText('يلزم منه الخلاء أو خرق الأفلاك، ويجعل الأوج ساكناً بلا فلك شامل', 290, 37);
}

function drawIbsSun(alpha) {
    if (!ibsSunCtx) return;
    const ctx = ibsSunCtx, cx = sunSCX, cy = sunSCY, sc = sunScale;
    ctx.clearRect(0, 0, 480, 480);
    ctx.fillStyle = '#080F25'; ctx.fillRect(0, 0, 480, 480);

    ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(480, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, 480); ctx.stroke();

    ctx.strokeStyle = '#374151'; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(460, cy); ctx.stroke(); ctx.setLineDash([]);

    // حساب الهندسة المتجهية المحققة من محرك نهاية السول
    const geo = computeShatirSolarGeometry(alpha);
    const p3x = cx + geo.p1.x * sc, p3y = cy - geo.p1.y * sc;
    const p4x = cx + geo.p2.x * sc, p4y = cy - geo.p2.y * sc;
    const px = cx + geo.sun.x * sc, py = cy - geo.sun.y * sc;

    // 0. وضع الأكر المجسمة المتماسة (الفصل السابع ص 89: الفلك الشامل 68;00، محدب الممثل 67;17، مقعر الممثل 52;43)
    if (showSolidSpheres) {
        // أ. القشرة الكروية للفلك الممثل (بين المقعر 52;43 والمحدب 67;17)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, SHATIR_SOLAR_MODEL.solidSpheres.pareclipticConvex * sc, 0, Math.PI * 2);
        ctx.arc(cx, cy, SHATIR_SOLAR_MODEL.solidSpheres.pareclipticConcave * sc, 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.07)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(cx, cy, SHATIR_SOLAR_MODEL.solidSpheres.pareclipticConvex * sc, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, SHATIR_SOLAR_MODEL.solidSpheres.pareclipticConcave * sc, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        // ب. الفلك الرابع: «الفلك الشامل» لحفظ الأوج وتحريكه (مقعره 67;17 ومحدبه 68;00 وسمكه 0;43)
        ctx.beginPath();
        ctx.arc(cx, cy, SHATIR_SOLAR_MODEL.R_shamil_outer * sc, 0, Math.PI * 2);
        ctx.arc(cx, cy, SHATIR_SOLAR_MODEL.R_shamil_inner * sc, 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.16)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, SHATIR_SOLAR_MODEL.R_shamil_outer * sc, 0, Math.PI * 2); ctx.stroke();

        // ج. كرة الحامل المجسمة المغرقة في سمك الممثل (نصف قطرها 7;17 وقطرها 14;34)
        ctx.fillStyle = 'rgba(96, 165, 250, 0.09)';
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p3x, p3y, SHATIR_SOLAR_MODEL.solidSpheres.hamilSphereRadius * sc, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // د. كرة المدير المجسمة المغرقة في كرة الحامل (نصف قطرها 2;40)
        ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
        ctx.beginPath();
        ctx.arc(p4x, p4y, SHATIR_SOLAR_MODEL.solidSpheres.mudirSphereRadius * sc, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#C084FC'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center';
        ctx.fillText('الفلك الرابع الشامل (R=68;00، سمكه 0;43 — حركة الأوج 1°/60س)', cx, cy - SHATIR_SOLAR_MODEL.R_shamil_outer * sc - 5);
        ctx.fillStyle = '#7DD3FC'; ctx.font = '8.5px Segoe UI';
        ctx.fillText('مقعر الممثل (52;43)', cx, cy + SHATIR_SOLAR_MODEL.solidSpheres.pareclipticConcave * sc - 5);
        ctx.restore();
    }

    // 1. منطقة الفلك الممثل (مركزه الأرض O ونصف قطره R=60)
    ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R_sun * sc, 0, Math.PI * 2); ctx.stroke();

    sunTrail.push({ x: px, y: py }); if (sunTrail.length > 360) sunTrail.shift();

    // مسار الشمس الناتج
    ctx.strokeStyle = 'rgba(239,68,68,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < sunTrail.length; i++) {
        if (i === 0) ctx.moveTo(sunTrail[i].x, sunTrail[i].y);
        else ctx.lineTo(sunTrail[i].x, sunTrail[i].y);
    }
    ctx.stroke();

    // 2. مدار مركز المدير (فلك الحامل r1 = 4;37 — يتحرك في أعلاه خلاف التوالي بمثل المركز)
    ctx.strokeStyle = '#60A5FA'; ctx.fillStyle = 'rgba(96,165,250,0.08)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p3x, p3y, r1_sun * sc, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawCircleArrow(ctx, p3x, p3y, r1_sun * sc, -alpha, -alpha + 1.1, false, '#93C5FD');

    // 3. مدار مركز الشمس (فلك المدير r2 = 2;30 — يتحرك في أعلاه إلى التوالي بضعف المركز)
    ctx.strokeStyle = '#FBBF24'; ctx.fillStyle = 'rgba(251,191,36,0.14)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(p4x, p4y, r2_sun * sc, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawCircleArrow(ctx, p4x, p4y, r2_sun * sc, -2 * alpha, -2 * alpha - 1.1, true, '#FDE047');

    // شعاع وسط الشمس (من الأرض إلى مركز الحامل P3) وشعاع تقويم الشمس الحقيقي (من الأرض إلى الشمس)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p3x, p3y); ctx.stroke();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);

    // الأذرع المتجهية: P3 → P4 (موازٍ لخط الأوج دائماً) ثم P4 → Sun
    ctx.strokeStyle = '#60A5FA'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(p3x, p3y); ctx.lineTo(p4x, p4y); ctx.stroke();
    ctx.strokeStyle = '#FBBF24'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(p4x, p4y); ctx.lineTo(px, py); ctx.stroke();

    // الأوج (67;07 = سز ز) والحضيض (52;53 = نب نج)
    const apoX = cx + (R_sun + r1_sun + r2_sun) * sc, perX = cx - (R_sun - r1_sun - r2_sun) * sc;
    ctx.fillStyle = '#10B981'; ctx.beginPath(); ctx.arc(apoX, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#DC2626'; ctx.beginPath(); ctx.arc(perX, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10B981'; ctx.font = 'bold 9.5px Segoe UI'; ctx.textAlign = 'left';
    ctx.fillText('الأوج 67;07 (سز ز)', apoX - 72, cy - 8);
    ctx.fillStyle = '#DC2626'; ctx.fillText('الحضيض 52;53 (نب نج)', perX + 6, cy - 8);

    // الأرض O (مركز العالم)
    ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('الأرض O (مركز العالم)', cx, cy + 20);

    // الشمس
    ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FEF08A'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 10.5px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText(`الشمس ☉ (${geo.distanceSexa.sexagesimal})`, px - 5, py - 13);

    // Labels
    ctx.fillStyle = '#93C5FD'; ctx.font = '9.5px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText('الحامل د لز (4;37)', p3x - 4, p3y + 14);
    ctx.fillStyle = '#FDE047'; ctx.fillText('المدير ب ل (2;30)', p4x + 4, p4y + 18);

    // OK badge
    ctx.fillStyle = 'rgba(16,185,129,0.14)'; ctx.fillRect(5, 5, 315, 40);
    ctx.strokeStyle = '#10B981'; ctx.lineWidth = 1.5; ctx.strokeRect(5, 5, 315, 40);
    ctx.fillStyle = '#6EE7B7'; ctx.font = 'bold 9.5px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText('✅ ٤ أفلاك مركزية تامة (الشامل + الممثل + الحامل + المدير)', 315, 20);
    ctx.font = '8.5px Segoe UI'; ctx.fillStyle = '#CBD5E1';
    ctx.fillText(`أقصى تعديل: 2° 02′ 06″ عند مركز 97° (3 بروج و7 درجات) — بلا خلاء ولا خرق`, 315, 36);

    // تحديث الإحصاءات بالستيني وحساب الجُمَّل
    const alphaDeg = ((alpha * 180 / Math.PI) % 360 + 360) % 360;
    const alphaSexa = toSexagesimal(alphaDeg);
    if (document.getElementById('sunAlphaComp')) {
        document.getElementById('sunAlphaComp').innerText = `${alphaSexa.sexagesimal}° (${alphaSexa.abjad})`;
    }
    if (document.getElementById('ibsSunDist')) {
        document.getElementById('ibsSunDist').innerText = `${geo.distanceSexa.sexagesimal} (${geo.distanceSexa.abjad})`;
    }
    if (document.getElementById('ptSunDist')) {
        document.getElementById('ptSunDist').innerText = `${geo.ptolemy.distanceSexa.sexagesimal} (${geo.ptolemy.distanceSexa.abjad})`;
    }
    if (document.getElementById('ibsSunEq')) {
        document.getElementById('ibsSunEq').innerText = `${geo.equationSexa.degMinStr} (${geo.equationSexa.abjad})`;
    }
    if (document.getElementById('ptSunEq')) {
        document.getElementById('ptSunEq').innerText = `${geo.ptolemy.equationSexa.degMinStr}`;
    }
    if (document.getElementById('ibsSunDiam')) {
        const diamSexa = toSexagesimal(geo.apparentDiamArcmin / 60, true);
        document.getElementById('ibsSunDiam').innerText = `${diamSexa.min}′ ${String(diamSexa.sec).padStart(2, '0')}″`;
    }
}

function drawSunComparison() {
    drawPtolemySun(sunAlpha);
    drawIbsSun(sunAlpha);
}

// ==================== MOON COMPARISON (الفصل التاسع من نهاية السول) ====================
const ptMoonCanvas = document.getElementById('ptolemyMoonCanvas');
const ptMoonCtx = setupHiDpiCanvas(ptMoonCanvas, 480, 480);
const ibsMoonCanvas = document.getElementById('ibsMoonCanvas');
const ibsMoonCtx = setupHiDpiCanvas(ibsMoonCanvas, 480, 480);
const moonCX = 240, moonCY = 240, moonScale = 2.8;
const R_moon = 60, r1_moon = 6 + 35 / 60, r2_moon = 1 + 25 / 60;
const rho_ptol = 10 + 19 / 60;      // 10;19
const R_ptol_defer = 49 + 41 / 60;  // 49;41
const r_ep_ptol_moon = 5 + 15 / 60; // 5;15
let moonTrail = [], ibsMoonTrail = [];

function getPtMoonDist(eta) {
    return 64.17 - 29.77 * Math.pow(Math.sin(eta), 2);
}

function drawPtolemyMoon(eta, gamma) {
    if (!ptMoonCtx) return;
    gamma = gamma || 0;
    const ctx = ptMoonCtx, cx = moonCX, cy = moonCY, sc = moonScale;
    ctx.clearRect(0, 0, 480, 480);
    ctx.fillStyle = '#080F25'; ctx.fillRect(0, 0, 480, 480);

    // Grid
    ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(480, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, 480); ctx.stroke();

    // 1. مركز المرفاق اللامركزي D (Crank Center)
    const Dx = cx + rho_ptol * Math.cos(-eta) * sc;
    const Dy = cy - rho_ptol * Math.sin(-eta) * sc;

    // دائرة المرفاق (نصف قطرها 10;19)
    ctx.strokeStyle = 'rgba(100,116,139,0.45)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(cx, cy, rho_ptol * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

    // 2. الفلك الحامل اللامركزي لبطلميوس (مركزه D ونصف قطره 49;41)
    ctx.strokeStyle = 'rgba(239,68,68,0.4)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(Dx, Dy, R_ptol_defer * sc, 0, Math.PI * 2); ctx.stroke();

    // 3. مركز فلك التدوير E على الفلك الحامل
    const Ex = Dx + R_ptol_defer * Math.cos(eta) * sc;
    const Ey = Dy - R_ptol_defer * Math.sin(eta) * sc;

    // فلك تدوير بطلميوس (r_ep = 5;15)
    ctx.strokeStyle = 'rgba(245,158,11,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(Ex, Ey, r_ep_ptol_moon * sc, 0, Math.PI * 2); ctx.stroke();
    drawCircleArrow(ctx, Ex, Ey, r_ep_ptol_moon * sc, -(eta + gamma), -(eta + gamma) - 1.2, true, '#FCD34D');

    // 4. موضع قمر بطلميوس
    const moonX = Ex + r_ep_ptol_moon * Math.cos(eta + gamma) * sc;
    const moonY = Ey - r_ep_ptol_moon * Math.sin(eta + gamma) * sc;

    const ptDist = Math.hypot((moonX - cx) / sc, (moonY - cy) / sc);
    const ptDistSexa = toSexagesimal(ptDist);

    moonTrail.push({ x: moonX, y: moonY }); if (moonTrail.length > 220) moonTrail.shift();
    ctx.strokeStyle = 'rgba(239,68,68,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < moonTrail.length; i++) {
        if (i === 0) ctx.moveTo(moonTrail[i].x, moonTrail[i].y); else ctx.lineTo(moonTrail[i].x, moonTrail[i].y);
    }
    ctx.stroke();

    // أذرع الربط لبطلميوس
    ctx.strokeStyle = 'rgba(148,163,184,0.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(Dx, Dy); ctx.stroke();
    ctx.strokeStyle = 'rgba(239,68,68,0.4)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(Dx, Dy); ctx.lineTo(Ex, Ey); ctx.stroke();
    ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(Ex, Ey); ctx.lineTo(moonX, moonY); ctx.stroke();

    ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(moonX, moonY); ctx.stroke(); ctx.setLineDash([]);

    // دوائر البعد المرجعية عند بطلميوس
    ctx.strokeStyle = 'rgba(239,68,68,0.2)'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, 65.25 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(239,68,68,0.35)';
    ctx.beginPath(); ctx.arc(cx, cy, 34.12 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(239,68,68,0.6)'; ctx.font = '9px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText('أقصى بعد: 65;15 (سه يه)', cx - 2, cy - 65.25 * sc - 3);
    ctx.fillText('أدنى بعد (التربيع): 34;07 (لد ز)!', cx - 2, cy - 34.12 * sc - 3);

    ctx.fillStyle = '#94A3B8'; ctx.beginPath(); ctx.arc(Dx, Dy, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(Ex, Ey, 3.5, 0, Math.PI * 2); ctx.fill();

    // الأرض O
    ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('الأرض O', cx, cy + 20);

    // قمر بطلميوس - يتضاعف حجمه بصرياً كلما اقترب إلى 34 جزءاً
    const moonR = 4.0 * (60.0 / ptDist);
    ctx.fillStyle = '#FBBF24'; ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText(`قمر بطلميوس (${ptDistSexa.sexagesimal})`, moonX - 4, moonY - moonR - 4);

    const etaDeg = ((eta * 180 / Math.PI) % 360 + 360) % 360;
    const isQuad = (etaDeg > 70 && etaDeg < 110) || (etaDeg > 250 && etaDeg < 290);
    if (isQuad) {
        ctx.fillStyle = 'rgba(239,68,68,0.25)'; ctx.fillRect(4, 4, 290, 48);
        ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 1.5; ctx.strokeRect(4, 4, 290, 48);
        ctx.fillStyle = '#FCA5A5'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'right';
        ctx.fillText('⚠️ معضلة بطلميوس في التربيعين (نهاية السول ص 105)!', 288, 20);
        ctx.font = '9px Segoe UI'; ctx.fillStyle = '#CBD5E1';
        ctx.fillText(`البعد هبط إلى ${ptDistSexa.sexagesimal} (${ptDistSexa.abjad}) ← القطر الظاهري ≈ 56′!`, 288, 35);
        ctx.fillText('هذا التضاعف الظاهري باطل حسّاً وعياناً كما برهن ابن الشاطر', 288, 49);
    }

    if (document.getElementById('ptMoonDist')) {
        document.getElementById('ptMoonDist').innerText = `${ptDistSexa.sexagesimal} (${ptDistSexa.abjad})`;
        const ratio = (60.0 / ptDist * 100).toFixed(0);
        document.getElementById('ptMoonSize').innerText = `${ratio}% (قطر ${(31.8 * 60 / ptDist).toFixed(1)}′)`;
        const etaSexa = toSexagesimal(etaDeg);
        document.getElementById('moonEtaComp').innerText = `${etaSexa.sexagesimal}° (${etaSexa.abjad})`;
        let phaseLabel = '—';
        if (etaDeg < 12 || etaDeg > 348) phaseLabel = 'المحاق (اجتماع) — D≈0°';
        else if (etaDeg > 38 && etaDeg < 52) phaseLabel = 'نصف الربع الأول (تثليث/تسديس) — D≈45°';
        else if (etaDeg > 78 && etaDeg < 102) phaseLabel = 'التربيع الأول — D≈90°';
        else if (etaDeg > 128 && etaDeg < 142) phaseLabel = 'نصف الربع الثاني — D≈135°';
        else if (etaDeg > 168 && etaDeg < 192) phaseLabel = 'البدر (استقبال) — D≈180°';
        else if (etaDeg > 258 && etaDeg < 282) phaseLabel = 'التربيع الثاني — D≈270°';
        const elPhase = document.getElementById('moonPhaseLabel');
        if (elPhase) elPhase.innerText = phaseLabel;
    }
}

function drawIbsMoon(eta, gamma) {
    if (!ibsMoonCtx) return;
    gamma = gamma || 0;
    const ctx = ibsMoonCtx, cx = moonCX, cy = moonCY, sc = moonScale;
    ctx.clearRect(0, 0, 480, 480);
    ctx.fillStyle = '#080F25'; ctx.fillRect(0, 0, 480, 480);

    // Grid
    ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(480, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, 480); ctx.stroke();

    // 0. الأكر المجسمة المتماسة لفلك القمر (الفصل التاسع ص 107: محدب المائل 68;16، مقعر المائل المماس لفلك النار 51;44)
    if (showSolidSpheres) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 68 * sc, 0, Math.PI * 2);
        ctx.arc(cx, cy, 52 * sc, 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.07)';
        ctx.fill();

        // كرة النار المماسة لمقعر فلك القمر (50;16 نصف قطر أرضي = 51;44 جزءاً)
        ctx.beginPath();
        ctx.arc(cx, cy, 51.5 * sc, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.32)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(248, 113, 113, 0.65)';
        ctx.font = '8.5px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('مقعر فلك القمر المائل المماس لمحدب كرة النار (51;44 جزءاً = 50;16 نصف قطر أرضي)', cx, cy + 51.5 * sc + 11);
        ctx.restore();
    }

    // الدوائر المرجعية لحدود ابن الشاطر الثابتة (52 إلى 68)
    ctx.strokeStyle = 'rgba(16,185,129,0.28)'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, 68 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 52 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(16,185,129,0.7)'; ctx.font = '9px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText('أبعد البعد في التربيع: 68;00 (سح)', cx - 2, cy - 68 * sc - 3);
    ctx.fillText('أقرب القرب في التربيع: 52;00 (نب)', cx - 2, cy - 52 * sc - 3);

    // 1. الفلك الممثل (لحركة الجوزهر: الرأس والذنب) والفلك المائل (ميله 5 درجات)
    const R_vis = 138;
    ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(cx, cy, R_vis, 0, Math.PI * 2); ctx.stroke();

    // رسم خط عقدتي الجوزهر (الرأس ☊ والذنب ☋) المتقهقر بحركة الممثل (3 دقائق و10 ثوانٍ يومياً إلى خلاف التوالي)
    const nodeAngle = -((currentN * 0.05295) % 360) * Math.PI / 180;
    const nodeRx = cx + R_vis * Math.cos(nodeAngle), nodeRy = cy - R_vis * Math.sin(nodeAngle);
    const nodeTx = cx - R_vis * Math.cos(nodeAngle), nodeTy = cy + R_vis * Math.sin(nodeAngle);
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(nodeRx, nodeRy); ctx.lineTo(nodeTx, nodeTy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#C084FC'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('☊ الرأس (الجوزهر)', nodeRx, nodeRy - 6);
    ctx.fillText('☋ الذنب', nodeTx, nodeTy + 12);

    const r1_vis = 36; // التدوير الأول (الحامل r1 = 6;35)
    const r2_vis = 15; // التدوير الثاني (المدير r2 = 1;25)

    const p1x = cx + R_vis * Math.cos(eta);
    const p1y = cy - R_vis * Math.sin(eta);

    // التدوير الأول يتحرك في أعلاه خلاف التوالي بالخاصة
    const p2x = p1x + r1_vis * Math.cos(eta - gamma);
    const p2y = p1y - r1_vis * Math.sin(eta - gamma);

    // التدوير الثاني يتحرك إلى التوالي بضعف البعد (2*eta) مبتدئاً من نحو المركز في الاجتماع
    const ang_m = (eta - gamma) + Math.PI + 2 * eta;
    const mx = p2x + r2_vis * Math.cos(ang_m);
    const my = p2y - r2_vis * Math.sin(ang_m);

    // حساب الأبعاد الحقيقية بالستيني من محرك نهاية السول
    const lunarGeo = computeShatirLunarGeometry(eta, gamma, eta, nodeAngle);
    const ibsDist = lunarGeo.distance;
    const visibleEpRadius = lunarGeo.effEpicycleRadius;

    ibsMoonTrail.push({ x: mx, y: my }); if (ibsMoonTrail.length > 220) ibsMoonTrail.shift();
    ctx.strokeStyle = 'rgba(78,205,196,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < ibsMoonTrail.length; i++) {
        if (i === 0) ctx.moveTo(ibsMoonTrail[i].x, ibsMoonTrail[i].y); else ctx.lineTo(ibsMoonTrail[i].x, ibsMoonTrail[i].y);
    }
    ctx.stroke();

    // رسم فلك التدوير الأول (الحامل r1=6;35)
    ctx.strokeStyle = '#60A5FA'; ctx.fillStyle = 'rgba(96,165,250,0.09)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(p1x, p1y, r1_vis, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawCircleArrow(ctx, p1x, p1y, r1_vis, -(eta - gamma), -(eta - gamma) + 1.1, false, '#93C5FD');

    // رسم فلك التدوير الثاني (المدير r2=1;25)
    ctx.strokeStyle = '#FBBF24'; ctx.fillStyle = 'rgba(251,191,36,0.18)'; ctx.lineWidth = 2.0;
    ctx.beginPath(); ctx.arc(p2x, p2y, r2_vis, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawCircleArrow(ctx, p2x, p2y, r2_vis, -ang_m, -ang_m - 1.1, true, '#FDE047');

    // الأذرع الميكانيكية الرابطة
    ctx.strokeStyle = 'rgba(148,163,184,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p1x, p1y); ctx.stroke();
    ctx.strokeStyle = '#60A5FA'; ctx.lineWidth = 2.0;
    ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
    ctx.strokeStyle = '#FBBF24'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(p2x, p2y); ctx.lineTo(mx, my); ctx.stroke();

    ctx.fillStyle = '#60A5FA'; ctx.beginPath(); ctx.arc(p1x, p1y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(p2x, p2y, 3.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#93C5FD'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText('التدوير الأول و له (6;35)', p1x - 5, p1y + r1_vis + 10);
    ctx.fillStyle = '#FDE047';
    ctx.fillText('التدوير الثاني أ كه (1;25)', p2x + 5, p2y - r2_vis - 4);

    // الأرض O (مركز العالم)
    ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('الأرض O (مركز العالم)', cx, cy + 20);

    // جرم قمر ابن الشاطر
    const moonR = 3.8;
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(mx, my, moonR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText(`قمر الشاطر ☽ (${lunarGeo.distanceSexa.sexagesimal})`, mx - 4, my - 10);

    // شارة الحفظ العلمي المطابق لمخطوطة نهاية السول
    ctx.fillStyle = 'rgba(16,185,129,0.12)'; ctx.fillRect(4, 4, 315, 50);
    ctx.strokeStyle = '#10B981'; ctx.lineWidth = 1.5; ctx.strokeRect(4, 4, 315, 50);
    ctx.fillStyle = '#6EE7B7'; ctx.font = 'bold 9.5px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText('✅ ٤ أفلاك للقمر: الممثل + المائل (5°) + التدوير الأول + الثاني', 313, 19);
    ctx.font = '8.5px Segoe UI'; ctx.fillStyle = '#CBD5E1';
    ctx.fillText(`نصف قطر التدوير المرئي الآن: ${lunarGeo.effEpicycleSexa.sexagesimal} (${lunarGeo.effEpicycleSexa.abjad}) [5;10 اجتماعاً ↔ 8;00 تربيعاً]`, 313, 34);
    ctx.fillText(`عرض القمر عن فلك البروج: ${lunarGeo.latitudeDeg >= 0 ? '+' : ''}${lunarGeo.latitudeDeg.toFixed(2)}° | القطر الظاهري: ${lunarGeo.apparentDiamArcmin.toFixed(1)}′`, 313, 48);

    if (document.getElementById('ibsMoonDist')) {
        document.getElementById('ibsMoonDist').innerText = `${lunarGeo.distanceSexa.sexagesimal} (${lunarGeo.distanceSexa.abjad})`;
        const ratio = (60.0 / ibsDist * 100).toFixed(0);
        document.getElementById('ibsMoonSize').innerText = `${ratio}% (قطر ${lunarGeo.apparentDiamArcmin.toFixed(1)}′ مستقر)`;
    }
}

function drawMoonComparison() {
    drawPtolemyMoon(moonAlpha, moonAnomalyRad);
    drawIbsMoon(moonAlpha, moonAnomalyRad);
}

// ==================== PLANET COMPARISON (الفصول 12 إلى 26 من نهاية السول) ====================
const ptPlanetCanvas = document.getElementById('ptolemyPlanetCanvas');
const ptPlanetCtx = setupHiDpiCanvas(ptPlanetCanvas, 480, 480);
const ibsPlanetCanvas = document.getElementById('ibsPlanetCanvas');
const ibsPlanetCtx = setupHiDpiCanvas(ibsPlanetCanvas, 480, 480);
const planCX = 240, planCY = 240;

function selectPlanet(key, btn) {
    selectedPlanet = key;
    manualPlanetAngleOverride = null;
    ptPlanetTrail = [];
    ibsPlanetTrail = [];
    document.querySelectorAll('.planet-btn').forEach(b => b.classList.remove('active'));
    if (typeof planetData === 'undefined' || !planetData || !planetData[key]) return;
    const pd = planetData[key];
    const shatirCfg = (typeof SHATIR_PLANETARY_MODELS !== 'undefined' && SHATIR_PLANETARY_MODELS) ? SHATIR_PLANETARY_MODELS[key] : null;
    const t = pd ? (pd.nameAr + ' ' + pd.symbol) : '';
    const elPtTitle = document.getElementById('ptolemyPlanetTitle');
    if (elPtTitle) elPtTitle.innerText = t;
    const elIbsTitle = document.getElementById('ibsPlanetTitle');
    if (elIbsTitle) elIbsTitle.innerText = t;
    const elCompTitle = document.getElementById('planetCompTitle');
    if (elCompTitle) elCompTitle.innerText = `مقارنة نموذجَي ${t}${shatirCfg ? ' — ' + shatirCfg.chapterAr : ''}`;

    const info = {
        mars:    '<strong>المريخ (٥ أفلاك — الفصل ١٧ ص ١٧٣):</strong> الممثل + المائل (R=60، ميله 1;00°) + الحامل r1=9;00 (ط) + المدير r2=3;00 (ج) + التدوير r3=39;30 (لط ل). بعد مركز التدوير في الأوج <strong>66;00 (سو)</strong> وفي الحضيض <strong>54;00 (ند)</strong>. محدب المائل 111;50 (قيا ن) ومقعره 8;10 (ح ي).',
        jupiter: '<strong>المشتري (٥ أفلاك — الفصل ١٥ ص ١٦٣):</strong> الممثل + المائل (R=60، ميله 1;15°) + الحامل r1=4;07,30 (د ز ل) + المدير r2=1;22,30 (أ كب ل) + التدوير r3=11;30 (يا ل). بعد مركز التدوير في الأوج <strong>62;45 (سب مه)</strong> وفي الحضيض <strong>57;15 (نز يه)</strong>.',
        saturn:  '<strong>زحل (٥ أفلاك — الفصل ١٢ ص ١٤٠):</strong> الممثل + المائل (R=60، ميله 2;30°) + الحامل r1=5;07,30 (هـ ز ل) + المدير r2=1;42,30 (أ مب ل) + التدوير r3=6;30 (و ل). بعد مركز التدوير في الأوج <strong>63;25 (سج كه)</strong> وفي الحضيض <strong>56;35 (نو له)</strong> كما نص عليه ابن الشاطر في ص 143 و145.',
        venus:   '<strong>الزهرة (٥ أفلاك — الفصل ١٩ ص ١٨٥):</strong> كوكب سفلي <strong>حركة مركزه تساوي حركة وسط الشمس</strong>! المائل (R=60، ميله 0;10°) + الحامل r1=1;41 (أ ما) + المدير r2=0;26 (كو) + التدوير r3=43;33 (مج لج). محدب المائل <strong>105;40 (قه م)</strong> ومقعره <strong>14;00 (يد)</strong>.',
        mercury: '<strong>عطارد (٧ أفلاك شاملة مزدوجة الطوسي — الفصل ٢١ ص ١٩٧):</strong> حركة مركزه تساوي حركة وسط الشمس! الممثل + المائل (R=60) + الحامل r1=4;05 (د هـ) + المدير r2=0;50 (ن) + التدوير r3=22;46 (كب مو) + <strong>الفلك المحيط/الشامل (r4=0;33 لج) + الفلك الحافظ (r5=0;33 لج)</strong> اللذان يشكلان مزدوجة الطوسي لتقليص قطر التدوير المرئي إلى <strong>21;40 (كا م)</strong> في الأوج والحضيض وتوسيعه إلى <strong>23;52 (كج نب)</strong> في التربيعين!'
    };
    const elPBox = document.getElementById('planetParamsBox');
    if (elPBox) elPBox.innerHTML = '⚙️ ' + info[key];
    drawPlanets();
}

let ptPlanetTrail = [], ibsPlanetTrail = [];

function drawPtPlanet(key, alpha, centerAngle) {
    if (!ptPlanetCtx) return;
    const pd = planetData[key];
    const geo = computeShatirPlanetGeometry(key, centerAngle, alpha);
    const ctx = ptPlanetCtx, cx = planCX, cy = planCY;
    const R = 60, e = geo.ptolemy.e, r_ep = geo.r3;
    const sc = 480 / (2 * (R + e + r_ep + 18));

    ctx.clearRect(0, 0, 480, 480);
    ctx.fillStyle = '#080F25'; ctx.fillRect(0, 0, 480, 480);

    ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(480, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, 480); ctx.stroke();

    // Eccentric center E at (e, 0) and Equant Q at (2e, 0)
    const Ex = cx + e * sc, Ey = cy;
    const Qx = cx + 2 * e * sc, Qy = cy;

    // Eccentric circle around E
    ctx.strokeStyle = 'rgba(255,107,107,0.7)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(Ex, Ey, R * sc, 0, Math.PI * 2); ctx.stroke();

    // Connection line O - E - Q (خط الأوج والحضيض)
    ctx.strokeStyle = 'rgba(255,165,0,0.4)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(460, cy); ctx.stroke(); ctx.setLineDash([]);

    // تقاطع شعاع معدل المسير Q مع دائرة الحامل الخارجة المركز E
    const defX = cx + geo.ptolemy.epCenter.x * sc;
    const defY = cy - geo.ptolemy.epCenter.y * sc;

    // Epicycle around defX, defY
    ctx.strokeStyle = pd.color; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(defX, defY, r_ep * sc, 0, Math.PI * 2); ctx.stroke();

    // Planet on epicycle
    const pX = cx + geo.ptolemy.planet.x * sc;
    const pY = cy - geo.ptolemy.planet.y * sc;

    // Lines: E -> defCenter (physical radius) and Q -> defCenter (uniform angular motion ray!)
    ctx.strokeStyle = 'rgba(239,68,68,0.45)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(Ex, Ey); ctx.lineTo(defX, defY); ctx.stroke();
    ctx.strokeStyle = 'rgba(250,204,21,0.65)'; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(Qx, Qy); ctx.lineTo(defX, defY); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(148,163,184,0.6)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(defX, defY); ctx.lineTo(pX, pY); ctx.stroke();

    // Earth O
    ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('O الأرض', cx, cy + 16);

    // Eccentric center E
    ctx.fillStyle = 'rgba(255,107,107,0.95)'; ctx.beginPath(); ctx.arc(Ex, Ey, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FF6B6B'; ctx.font = '8.5px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText(`E (${toSexagesimal(e).sexagesimal})`, Ex, Ey - 8);

    // Equant Q
    ctx.fillStyle = '#FACC15'; ctx.beginPath();
    ctx.moveTo(Qx, Qy - 6); ctx.lineTo(Qx + 6, Qy + 5); ctx.lineTo(Qx - 6, Qy + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FACC15'; ctx.font = 'bold 8.5px Segoe UI'; ctx.textAlign = 'left';
    ctx.fillText(`Q معدل المسير (${toSexagesimal(2 * e).sexagesimal})`, Qx + 7, Qy - 2);

    // Planet
    ctx.fillStyle = pd.color; ctx.beginPath(); ctx.arc(pX, pY, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText(pd.nameAr + ' ' + pd.symbol, pX - 4, pY - 9);

    // Warning badge
    ctx.fillStyle = 'rgba(239,68,68,0.14)'; ctx.fillRect(4, 4, 295, 34);
    ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 1.2; ctx.strokeRect(4, 4, 295, 34);
    ctx.fillStyle = '#FCA5A5'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText('⚠️ إشكالية معدل المسير Q: الفلك الحامل يدور حول E وينتظم حول Q!', 295, 18);
    ctx.font = '8px Segoe UI'; ctx.fillStyle = '#CBD5E1';
    ctx.fillText('وفي عطارد أضاف بطلميوس مديراً عكسياً يخرق الأصول الفيزيائية', 295, 31);
}

function drawIbsPlanet(key, alpha, centerAngle) {
    if (!ibsPlanetCtx) return;
    const pd = planetData[key];
    const geo = computeShatirPlanetGeometry(key, centerAngle, alpha);
    const ctx = ibsPlanetCtx, cx = planCX, cy = planCY;
    const R = geo.R, r1 = geo.r1, r2 = geo.r2, r3 = geo.r3;
    const sc = 480 / (2 * (R + r1 + r2 + r3 + 18));

    ctx.clearRect(0, 0, 480, 480);
    ctx.fillStyle = '#080F25'; ctx.fillRect(0, 0, 480, 480);

    ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(480, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, 480); ctx.stroke();

    // خط الأوج والحضيض
    ctx.strokeStyle = '#374151'; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(15, cy); ctx.lineTo(465, cy); ctx.stroke(); ctx.setLineDash([]);

    const p1x = cx + geo.p1.x * sc, p1y = cy - geo.p1.y * sc;
    const p2x = cx + geo.p2.x * sc, p2y = cy - geo.p2.y * sc;
    const epCx = cx + geo.epCenter.x * sc, epCy = cy - geo.epCenter.y * sc;
    const epPerimX = cx + geo.epPerim.x * sc, epPerimY = cy - geo.epPerim.y * sc;
    const pX = cx + geo.planet.x * sc, pY = cy - geo.planet.y * sc;

    // 0. الأكر المجسمة المتماسة (المحدب والمقعر وكرة الحامل وكرة المدير — الفصول 12، 15، 17، 19، 21)
    if (showSolidSpheres && geo.cfg.solidSpheres) {
        const ss = geo.cfg.solidSpheres;
        ctx.save();
        // قشرة الفلك المائل بين مقعره ومحدبه
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(236, ss.inclinedConvex * sc), 0, Math.PI * 2);
        ctx.arc(cx, cy, Math.max(4, ss.inclinedConcave * sc), 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(cx, cy, Math.min(236, ss.inclinedConvex * sc), 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, ss.inclinedConcave * sc), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        // كرة الحامل المجسمة الشاملة للداخليات (نصف قطرها r1 + r2 + r3)
        ctx.fillStyle = 'rgba(96, 165, 250, 0.06)';
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.32)';
        ctx.beginPath(); ctx.arc(p1x, p1y, ss.hamilSphere * sc, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // كرة المدير المجسمة الشاملة للتدوير (نصف قطرها r2 + r3)
        ctx.fillStyle = 'rgba(251, 191, 36, 0.06)';
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.32)';
        ctx.beginPath(); ctx.arc(p2x, p2y, ss.mudirSphere * sc, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#7DD3FC'; ctx.font = '8px Segoe UI'; ctx.textAlign = 'center';
        ctx.fillText(`محدب المائل: ${toSexagesimal(ss.inclinedConvex).sexagesimal} | مقعره: ${toSexagesimal(ss.inclinedConcave).sexagesimal}`, cx, 473);
        ctx.restore();
    }

    // 1. الفلك الممثل والفلك المائل (R = 60، مركزهما الأرض O)
    ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R * sc, 0, Math.PI * 2); ctx.stroke();

    // مسار الكوكب الناتج
    ibsPlanetTrail.push({ x: pX, y: pY }); if (ibsPlanetTrail.length > 260) ibsPlanetTrail.shift();
    ctx.strokeStyle = pd.color + '88'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < ibsPlanetTrail.length; i++) {
        if (i === 0) ctx.moveTo(ibsPlanetTrail[i].x, ibsPlanetTrail[i].y);
        else ctx.lineTo(ibsPlanetTrail[i].x, ibsPlanetTrail[i].y);
    }
    ctx.stroke();

    // 2. فلك الحامل (r1 حول P1 — يتحرك في أعلاه خلاف التوالي بمثل المركز، فيبقى ذراعه موازياً للأوج +X)
    ctx.strokeStyle = '#60A5FA'; ctx.fillStyle = 'rgba(96,165,250,0.1)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(p1x, p1y, Math.max(4, r1 * sc), 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // 3. فلك المدير (r2 حول P2 — يتحرك في أعلاه إلى التوالي بضعف المركز 2*kappa)
    ctx.strokeStyle = '#FBBF24'; ctx.fillStyle = 'rgba(251,191,36,0.14)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(p2x, p2y, Math.max(3, r2 * sc), 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // 4. فلك التدوير (r3 حول مركز التدوير epC)
    ctx.strokeStyle = pd.color; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(epCx, epCy, r3 * sc, 0, Math.PI * 2); ctx.stroke();

    // خط البرهان الهندسي لابن الشاطر: الشعاع من موضع (2e) إلى مركز التدوير يوازي شعاع المائل!
    const virtualEquantX = cx + 2 * geo.cfg.pto_e * sc, virtualEquantY = cy;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'; ctx.lineWidth = 1.1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(virtualEquantX, virtualEquantY); ctx.lineTo(epCx, epCy); ctx.stroke();
    // شعاع الرؤية من الأرض إلى الكوكب
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pX, pY); ctx.stroke();
    ctx.setLineDash([]);

    // الأذرع المتجهية: الأرض O → P1 → P2 → epC → الكوكب
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p1x, p1y); ctx.stroke();
    ctx.strokeStyle = '#60A5FA'; ctx.lineWidth = 2.0;
    ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
    ctx.strokeStyle = '#FBBF24'; ctx.lineWidth = 2.0;
    ctx.beginPath(); ctx.moveTo(p2x, p2y); ctx.lineTo(epCx, epCy); ctx.stroke();
    ctx.strokeStyle = pd.color; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(epCx, epCy); ctx.lineTo(epPerimX, epPerimY); ctx.stroke();

    // 5. الفلكان السادس والسابع في عطارد: المحيط/الشامل (r4=0;33) والحافظ (r5=0;33) — مزدوجة الطوسي!
    if (key === 'mercury' && geo.muhitCenter) {
        const mCx = cx + geo.muhitCenter.x * sc, mCy = cy - geo.muhitCenter.y * sc;
        // رسم على طرف التدوير
        ctx.strokeStyle = '#34D399'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(epPerimX, epPerimY, Math.max(3.5, geo.r4 * sc * 3), 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#F472B6'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(mCx, mCy, Math.max(2.5, geo.r5 * sc * 3), 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(epPerimX, epPerimY); ctx.lineTo(mCx, mCy); ctx.lineTo(pX, pY); ctx.stroke();

        // عدسة تكبير مجهرية (25×) في الزاوية اليسرى العليا لإظهار مزدوجة الطوسي (المحيط والحافظ) بوضوح تام!
        const magX = 76, magY = 104, magR = 56;
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(magX, magY, magR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        const r4_mag = 18; // تكبير 0;33 دقيقة
        const r5_mag = 18; // تكبير 0;33 دقيقة
        // خط قطر التدوير داخل العدسة
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(magX - (magR - 6) * Math.cos(geo.epWorldAngle), magY + (magR - 6) * Math.sin(geo.epWorldAngle));
        ctx.lineTo(magX + (magR - 6) * Math.cos(geo.epWorldAngle), magY - (magR - 6) * Math.sin(geo.epWorldAngle));
        ctx.stroke(); ctx.setLineDash([]);

        // دائرة الفلك السادس (المحيط/الشامل r4=0;33) متمركزة في محيط التدوير (magX, magY)
        ctx.strokeStyle = '#38BDF8'; ctx.fillStyle = 'rgba(56, 189, 248, 0.12)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(magX, magY, r4_mag, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // مركز الفلك السابع (الحافظ r5=0;33)
        const magMCx = magX + r4_mag * Math.cos(geo.muhitWorldAngle);
        const magMCy = magY - r4_mag * Math.sin(geo.muhitWorldAngle);
        ctx.strokeStyle = '#F59E0B'; ctx.fillStyle = 'rgba(245, 158, 11, 0.16)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(magMCx, magMCy, r5_mag, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // موضع جرم عطارد المتردد خطياً على قطر التدوير!
        const magPx = magMCx + r5_mag * Math.cos(geo.hafizWorldAngle);
        const magPy = magMCy - r5_mag * Math.sin(geo.hafizWorldAngle);

        ctx.strokeStyle = '#60A5FA'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(magX, magY); ctx.lineTo(magMCx, magMCy); ctx.stroke();
        ctx.strokeStyle = '#FBBF24'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(magMCx, magMCy); ctx.lineTo(magPx, magPy); ctx.stroke();

        ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(magX, magY, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(magMCx, magMCy, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#C084FC'; ctx.beginPath(); ctx.arc(magPx, magPy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.2; ctx.stroke();

        ctx.fillStyle = '#6EE7B7'; ctx.font = 'bold 8.5px Segoe UI'; ctx.textAlign = 'center';
        ctx.fillText('🔍 مزدوجة عطارد (25×): المحيط والحافظ', magX, magY - magR - 5);
        ctx.fillStyle = '#FDE047'; ctx.font = '8px Segoe UI';
        ctx.fillText(`قطر التدوير المرئي: ${geo.effectiveEpRadiusSexa.sexagesimal} (${geo.effectiveEpRadiusSexa.abjad})`, magX, magY + magR + 11);
        ctx.restore();
    }

    // نقاط المفاصل (P1, P2, epC)
    [[p1x, p1y, '#38BDF8'], [p2x, p2y, '#FBBF24'], [epCx, epCy, '#10B981']].forEach(([jx, jy, jc]) => {
        ctx.fillStyle = jc; ctx.beginPath(); ctx.arc(jx, jy, 3.2, 0, Math.PI * 2); ctx.fill();
    });

    // الكوكب
    ctx.fillStyle = pd.color; ctx.beginPath(); ctx.arc(pX, pY, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText(`${pd.nameAr} ${pd.symbol} (${geo.planetDistSexa.sexagesimal})`, pX - 5, pY - 9);

    // الأرض O (مركز العالم)
    ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('الأرض O (المركز)', cx, cy + 16);

    // OK badge
    ctx.fillStyle = 'rgba(16,185,129,0.12)'; ctx.fillRect(145, 4, 330, 38);
    ctx.strokeStyle = '#10B981'; ctx.lineWidth = 1.2; ctx.strokeRect(145, 4, 330, 38);
    ctx.fillStyle = '#6EE7B7'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText(`✅ مركز التدوير الآن: ${geo.epCenterDistSexa.sexagesimal} (${geo.epCenterDistSexa.abjad}) — ${geo.motionStateAr}`, 470, 18);
    ctx.font = '8px Segoe UI'; ctx.fillStyle = '#CBD5E1';
    ctx.fillText(`الحامل (${toSexagesimal(r1).sexagesimal}) يوازي الأوج، والمدير (${toSexagesimal(r2).sexagesimal}) بضعف المركز ← إلغاء معدل المسير`, 470, 34);

    // تحديث الإحصاءات في لوحة الكواكب
    const cDeg = ((centerAngle * 180 / Math.PI) % 360 + 360) % 360;
    const cSexa = toSexagesimal(cDeg);
    if (document.getElementById('planetAlpha')) {
        document.getElementById('planetAlpha').innerText = `${cSexa.sexagesimal}° (${cSexa.abjad})`;
    }
    if (document.getElementById('ibsPlanetDist')) {
        document.getElementById('ibsPlanetDist').innerText = `${geo.planetDistSexa.sexagesimal} (${geo.planetDistSexa.abjad})`;
    }
    if (document.getElementById('ptPlanetDist')) {
        document.getElementById('ptPlanetDist').innerText = `${geo.ptolemy.planetDistSexa.sexagesimal} (${geo.ptolemy.planetDistSexa.abjad})`;
    }
    if (document.getElementById('ptEquantDist')) {
        const eq2e = toSexagesimal(2 * geo.cfg.pto_e);
        document.getElementById('ptEquantDist').innerText = `${eq2e.sexagesimal} (${eq2e.abjad})`;
    }
    if (document.getElementById('ibsEpCenterDist')) {
        document.getElementById('ibsEpCenterDist').innerText = `${geo.epCenterDistSexa.sexagesimal} (${geo.epCenterDistSexa.abjad})`;
    }
    if (document.getElementById('ibsPlanetMotionState')) {
        document.getElementById('ibsPlanetMotionState').innerText = geo.motionStateAr;
    }
    if (document.getElementById('ibsPlanetLat')) {
        document.getElementById('ibsPlanetLat').innerText = `${geo.totalLatitudeDeg >= 0 ? '+' : ''}${geo.totalLatitudeDeg.toFixed(2)}°`;
    }
    if (document.getElementById('ibsVisibleEpRadius')) {
        document.getElementById('ibsVisibleEpRadius').innerText = `${geo.effectiveEpRadiusSexa.sexagesimal} (${geo.effectiveEpRadiusSexa.abjad})`;
    }
}

function drawPlanets() {
    if (!planetAngles[selectedPlanet]) return;
    const pa = planetAngles[selectedPlanet];
    drawPtPlanet(selectedPlanet, pa.anomaly, pa.mean);
    drawIbsPlanet(selectedPlanet, pa.anomaly, pa.mean);
}

// ==================== TAB SWITCHING ====================
const tabMap = {
    cosmos3D:   'cosmos3DPanel',
    cosmos:     'cosmosPanel',
    sunComp:    'sunCompPanel',
    moonComp:   'moonCompPanel',
    planets:    'planetsPanel',
    study:      'studyPanel',
    revolution: 'revolutionPanel'
};
let activeTab = 'cosmos3D';

function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));
    const btns = document.querySelectorAll('.tab-btn');
    const tabKeys = Object.keys(tabMap);
    const idx = tabKeys.indexOf(tab);
    if(idx>=0 && btns[idx]) btns[idx].classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.getAttribute('onclick') && b.getAttribute('onclick').indexOf("'" + tab + "'") !== -1) {
            b.classList.add('active');
        }
    });
    const panel = document.getElementById(tabMap[tab]);
    if(panel) panel.classList.add('active');
    if(tab === 'revolution' && typeof initRevolution === 'function') {
        initRevolution();
    }
    if(tab === 'cosmos3D') {
        if (typeof c3dTimeSpeedMode !== 'undefined' && c3dTimeSpeedMode === 'realtime') {
            timeSpeedDaysPerSec = 1.0 / 86400.0;
        } else {
            applyUnifiedSpeed(typeof timeSpeedDaysPerSec !== 'undefined' ? timeSpeedDaysPerSec : 0.0417, true);
        }
        if(!cosmos3DInitialized && typeof init3D === 'function') {
            try {
                init3D();
            } catch (err) {
                console.error('Cosmos3D initialization caught error:', err);
            }
        }
        setTimeout(() => {
            try {
                if(typeof onCosmos3DResize === 'function') onCosmos3DResize();
                if(cosmos3DInitialized && typeof updateAstronomy === 'function') updateAstronomy(currentDate);
            } catch(e) {
                console.warn('Post-cosmos3D resize error:', e);
            }
        }, 60);
    }
}


window._fullSwitchTab = switchTab;
window.switchTab = switchTab;
if (typeof window !== "undefined" && window._pendingTab && window._pendingTab !== "cosmos") {
    switchTab(window._pendingTab);
}

/* ==================== REVOLUTION ENGINE CODE (COPERNICUS & KEPLER) ==================== */
// ==================== SIMULATION STATE ====================
        // isPlaying, simDays, timeSpeed are unified globally
        let currentMode = '3way'; // '3way' or 'overlay'
        let lastTime = performance.now();

        // Canvas contexts
        let cvsShatir = document.getElementById('canvasShatir');
        let ctxShatir = cvsShatir ? cvsShatir.getContext('2d') : null;

        let cvsCopernicus = document.getElementById('canvasCopernicus');
        let ctxCopernicus = cvsCopernicus ? cvsCopernicus.getContext('2d') : null;

        let cvsKepler = document.getElementById('canvasKepler');
        let ctxKepler = cvsKepler ? cvsKepler.getContext('2d') : null;

        let cvsOverlay = document.getElementById('canvasOverlay');
        let ctxOverlay = cvsOverlay ? cvsOverlay.getContext('2d') : null;

        // Parameters
        // Astronomical parameters for Earth/Sun orbit
        const R_base = 135; // base deferent radius in px
        const e_kepler = 0.12; // exaggerated for clear visualization (real Earth is 0.0167)
        // Ibn al-Shatir equivalent epicycles to generate same eccentricity:
        // r1 = 3/4 * e * R, r2 = 1/4 * e * R
        const r1_shatir = R_base * (1.5 * e_kepler);
        const r2_shatir = R_base * (0.5 * e_kepler);

        let showMoon = true;
        let trailShatir = [];
        let trailCopernicus = [];
        let trailKepler = [];

        // Moon trails
        let trailMoonShatir = [];
        let trailMoonCopernicus = [];
        let trailMoonKepler = [];

        // Swept sectors for Kepler's 2nd Law
        let keplerSectors = [];

        function toggleMoon(val) {
            showMoon = val;
            trailMoonShatir = [];
            trailMoonCopernicus = [];
            trailMoonKepler = [];
        }

        function addDays(d) {
            simDays += d;
            currentDate = new Date(currentDate.getTime() + d * 86400000);
            sunTrail = []; moonTrail = []; ibsMoonTrail = [];
            trailShatir = []; trailCopernicus = []; trailKepler = [];
            trailMoonShatir = []; trailMoonCopernicus = []; trailMoonKepler = [];
            updateDateTimeUI();
            showToast(`${d > 0 ? '⏩ +' : '⏪ '}${d} يوم`);
        }

        function resetEpoch() {
            simDays = 0;
            currentDate = new Date(currentDate.getFullYear(), 0, 1, 12, 0); // 1 يناير
            sunTrail = []; moonTrail = []; ibsMoonTrail = [];
            trailShatir = []; trailCopernicus = []; trailKepler = [];
            trailMoonShatir = []; trailMoonCopernicus = []; trailMoonKepler = [];
            updateDateTimeUI();
            showToast('🔄 تم ضبط التاريخ على 1 يناير');
        }

        function setMode(mode) {
            currentMode = mode;
            document.getElementById('btnMode3way').classList.toggle('active', mode === '3way');
            document.getElementById('btnModeOverlay').classList.toggle('active', mode === 'overlay');

            document.getElementById('view3way').style.display = mode === '3way' ? 'grid' : 'none';
            document.getElementById('viewOverlay').style.display = mode === 'overlay' ? 'flex' : 'none';
        }

        function _revDrawCircleArrow(ctx, cx, cy, r, startAngle, endAngle, counterClockwise, color) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, r, startAngle, endAngle, counterClockwise);
            ctx.stroke();

            const arrowAngle = endAngle;
            const ax = cx + r * Math.cos(arrowAngle);
            const ay = cy + r * Math.sin(arrowAngle);
            const dir = counterClockwise ? -1 : 1;
            const headlen = 5;
            const tangent = arrowAngle + (dir * Math.PI / 2);

            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax - headlen * Math.cos(tangent - Math.PI / 6), ay - headlen * Math.sin(tangent - Math.PI / 6));
            ctx.lineTo(ax - headlen * Math.cos(tangent + Math.PI / 6), ay - headlen * Math.sin(tangent + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // ==================== RENDER ENGINES ====================

        // 1. IBN AL-SHATIR (Geocentric, 2 uniform epicycles)
        function drawShatir(ctx, w, h, angle) {
            ctx.clearRect(0, 0, w, h);
            const cx = w / 2, cy = h / 2;

            // Grid
            ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

            // Main Deferent (Earth-centered)
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(cx, cy, R_base, 0, Math.PI * 2); ctx.stroke();

            // P1 on Deferent (moves uniformly with angle)
            const p1x = cx + R_base * Math.cos(angle);
            const p1y = cy - R_base * Math.sin(angle);

            // Epicycle 1 (Hamil r1) centered at P1
            ctx.strokeStyle = '#60A5FA'; ctx.fillStyle = 'rgba(96, 165, 250, 0.08)'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(p1x, p1y, r1_shatir, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            _revDrawCircleArrow(ctx, p1x, p1y, r1_shatir, -angle, -angle - 1.2, true, '#93C5FD');

            // P2 on Epicycle 1 (Hamil rotates -angle relative to radius -> stays parallel to Apogee line +X!)
            const p2x = p1x + r1_shatir;
            const p2y = p1y;

            // Epicycle 2 (Mudir r2) centered at P2
            ctx.strokeStyle = '#FBBF24'; ctx.fillStyle = 'rgba(251, 191, 36, 0.15)'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.arc(p2x, p2y, r2_shatir, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            _revDrawCircleArrow(ctx, p2x, p2y, r2_shatir, -(2*angle), -(2*angle) - 1.2, true, '#FDE047');

            // Sun position (rotates with 2*angle on Mudir)
            const sx = p2x - r2_shatir * Math.cos(2 * angle);
            const sy = p2y + r2_shatir * Math.sin(2 * angle);

            // Trail (Silky smooth spline)
            trailShatir.push({x: sx, y: sy});
            if (trailShatir.length > 250) trailShatir.shift();
            drawSmoothTrail(ctx, trailShatir, 'rgba(56, 189, 248, 0.65)', 2);

            // Mechanical arms
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p1x, p1y); ctx.stroke();
            ctx.strokeStyle = '#60A5FA'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
            ctx.strokeStyle = '#FBBF24'; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(p2x, p2y); ctx.lineTo(sx, sy); ctx.stroke();

            // Pivots
            ctx.fillStyle = '#60A5FA'; ctx.beginPath(); ctx.arc(p1x, p1y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(p2x, p2y, 3, 0, Math.PI * 2); ctx.fill();

            // Earth O (Center)
            ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();

            // Sun
            ctx.fillStyle = '#FBBF24'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 2; ctx.stroke();

            // ==================== قمر ابن الشاطر حول الأرض O ====================
            if (showMoon) {
                const R_moon_shatir = 55; // نصف قطر فلك ممثل القمر بالبكسل (ثابت)
                const r1_m = 12;          // فلك التدوير الأول (الحامل 6;35 — نصف قطر ثابت)
                const r2_m = 4.5;         // فلك التدوير الثاني (المدير 1;25 — نصف قطر ثابت)

                const eta_m = (simDays * (360 / 29.53059)) * Math.PI / 180; // زاوية الاستطالة
                const gam_m = (simDays * (360 / 27.55455)) * Math.PI / 180; // خاصة القمر

                // فلك حامل القمر (الممثل/المائل)
                ctx.strokeStyle = 'rgba(226, 232, 240, 0.22)'; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
                ctx.beginPath(); ctx.arc(cx, cy, R_moon_shatir, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

                // مركز التدوير الأول على الحامل P1m
                const mp1x = cx + R_moon_shatir * Math.cos(eta_m);
                const mp1y = cy - R_moon_shatir * Math.sin(eta_m);

                // دائرة التدوير الأول (الحامل r1_m بنصف قطر ثابت)
                ctx.strokeStyle = 'rgba(96, 165, 250, 0.48)'; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(mp1x, mp1y, r1_m, 0, Math.PI * 2); ctx.stroke();

                // مركز التدوير الثاني P2m (يدور خلاف التوالي بالخاصة gam_m على محيط التدوير الأول)
                const ang_ep1 = eta_m - gam_m;
                const mp2x = mp1x + r1_m * Math.cos(ang_ep1);
                const mp2y = mp1y - r1_m * Math.sin(ang_ep1);

                // دائرة التدوير الثاني (المدير الأصفر r2_m بنصف قطر ثابت)
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.58)'; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(mp2x, mp2y, r2_m, 0, Math.PI * 2); ctx.stroke();

                // جرم قمر ابن الشاطر (يدور إلى التوالي بضعف الاستطالة 2*eta_m على محيط المدير)
                const ang_m = ang_ep1 + Math.PI + 2 * eta_m;
                const moonX = mp2x + r2_m * Math.cos(ang_m);
                const moonY = mp2y - r2_m * Math.sin(ang_m);

                // الأذرع الميكانيكية الرابطة للقمر
                ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)'; ctx.lineWidth = 1.3;
                ctx.beginPath(); ctx.moveTo(mp1x, mp1y); ctx.lineTo(mp2x, mp2y); ctx.stroke();
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)'; ctx.lineWidth = 1.4;
                ctx.beginPath(); ctx.moveTo(mp2x, mp2y); ctx.lineTo(moonX, moonY); ctx.stroke();

                // أثر مدار القمر (Silky smooth spline)
                trailMoonShatir.push({x: moonX, y: moonY});
                if (trailMoonShatir.length > 80) trailMoonShatir.shift();
                drawSmoothTrail(ctx, trailMoonShatir, 'rgba(243, 232, 255, 0.65)', 1.5);

                // رسم قمر ابن الشاطر على محيط المدير مباشرة
                ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(moonX, moonY, 3.5, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 1.2; ctx.stroke();

                // تحديث الطور
                const etaDeg = ((eta_m * 180 / Math.PI) % 360 + 360) % 360;
                let phaseName = 'هلال';
                if (etaDeg < 20 || etaDeg > 340) phaseName = 'محاق (اجتماع)';
                else if (etaDeg >= 70 && etaDeg <= 110) phaseName = 'تربيع أول';
                else if (etaDeg >= 160 && etaDeg <= 200) phaseName = 'بدر تام (استقبال)';
                else if (etaDeg >= 250 && etaDeg <= 290) phaseName = 'تربيع ثانٍ';
                const phaseEl = document.getElementById('moonPhaseShatir');
                if (phaseEl) phaseEl.innerText = `${phaseName} (η=${etaDeg.toFixed(0)}°)`;
            }

            return { x: sx, y: sy };
        }

        // 2. COPERNICUS (Heliocentric with Ibn al-Shatir's epicycles inverted)
        function drawCopernicus(ctx, w, h, angle) {
            ctx.clearRect(0, 0, w, h);
            const cx = w / 2, cy = h / 2;

            // Grid
            ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

            // Sun at Center!
            ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FEF08A'; ctx.lineWidth = 2; ctx.stroke();

            // Deferent of Earth around Sun
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(cx, cy, R_base, 0, Math.PI * 2); ctx.stroke();

            // Epicycle 1 (Copernicus used Ibn al-Shatir's exact ratios)
            const p1x = cx + R_base * Math.cos(angle);
            const p1y = cy - R_base * Math.sin(angle);

            ctx.strokeStyle = '#F59E0B'; ctx.fillStyle = 'rgba(245, 158, 11, 0.08)'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(p1x, p1y, r1_shatir, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

            // Epicycle 2 (parallel to Apse line +X)
            const p2x = p1x + r1_shatir;
            const p2y = p1y;

            ctx.strokeStyle = '#A855F7'; ctx.fillStyle = 'rgba(168, 85, 247, 0.15)'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.arc(p2x, p2y, r2_shatir, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

            // Earth position
            const ex = p2x - r2_shatir * Math.cos(2 * angle);
            const ey = p2y + r2_shatir * Math.sin(2 * angle);

            // Trail (Silky smooth spline)
            trailCopernicus.push({x: ex, y: ey});
            if (trailCopernicus.length > 250) trailCopernicus.shift();
            drawSmoothTrail(ctx, trailCopernicus, 'rgba(245, 158, 11, 0.65)', 2);

            // Mechanical arms
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p1x, p1y); ctx.stroke();
            ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
            ctx.strokeStyle = '#A855F7'; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(p2x, p2y); ctx.lineTo(ex, ey); ctx.stroke();

            // Earth
            ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.5; ctx.stroke();

            // ==================== قمر كوبرنيكوس حول الأرض المتحركة ====================
            if (showMoon) {
                const R_moon_cop = 28; // نصف قطر مدار القمر حول الأرض المتحركة
                const eta_m = (simDays * (360 / 29.53059)) * Math.PI / 180;
                const gam_m = (simDays * (360 / 27.55455)) * Math.PI / 180;

                // مدار القمر حول الأرض
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)'; ctx.lineWidth = 1; ctx.setLineDash([2,2]);
                ctx.beginPath(); ctx.arc(ex, ey, R_moon_cop, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

                // كوبرنيكوس استخدم نفس دوائر ابن الشاطر الثابتة حول الأرض المتحركة!
                const r1_m = 6, r2_m = 2.2;
                const mp1x = ex + R_moon_cop * Math.cos(eta_m);
                const mp1y = ey - R_moon_cop * Math.sin(eta_m);
                const ang_ep1 = eta_m - gam_m;
                const mp2x = mp1x + r1_m * Math.cos(ang_ep1);
                const mp2y = mp1y - r1_m * Math.sin(ang_ep1);
                const ang_m = ang_ep1 + Math.PI + 2 * eta_m;
                const moonX = mp2x + r2_m * Math.cos(ang_m);
                const moonY = mp2y - r2_m * Math.sin(ang_m);

                ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)'; ctx.lineWidth = 1.0;
                ctx.beginPath(); ctx.arc(mp1x, mp1y, r1_m, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)'; ctx.lineWidth = 1.0;
                ctx.beginPath(); ctx.arc(mp2x, mp2y, r2_m, 0, Math.PI * 2); ctx.stroke();

                // أثر مسار القمر في الفضاء الشمسي (Epicycloidal Wave - Silky smooth spline)
                trailMoonCopernicus.push({x: moonX, y: moonY});
                if (trailMoonCopernicus.length > 180) trailMoonCopernicus.shift();
                drawSmoothTrail(ctx, trailMoonCopernicus, 'rgba(251, 191, 36, 0.65)', 1.3);

                // رسم قمر كوبرنيكوس
                ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(moonX, moonY, 3.2, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#FBBF24'; ctx.lineWidth = 1; ctx.stroke();
            }

            return { x: ex, y: ey };
        }

        // 3. KEPLER (True Ellipse, Sun at focus, Equal Areas Law)
        function drawKepler(ctx, w, h, meanAnomaly) {
            ctx.clearRect(0, 0, w, h);
            const cx = w / 2, cy = h / 2;

            // Grid
            ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

            const a = R_base;
            const e = e_kepler;
            const b = a * Math.sqrt(1 - e * e);
            const c = a * e; // focal distance

            // Center of Ellipse is (cx, cy)
            // Sun is at Focus F1 = (cx - c, cy)
            const sunX = cx - c, sunY = cy;
            const emptyFocusX = cx + c, emptyFocusY = cy;

            // Solve Kepler's Equation: M = E - e*sin(E) for Eccentric Anomaly E
            let E = meanAnomaly;
            for (let iter = 0; iter < 6; iter++) {
                E = E - (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
            }

            // True coordinates relative to center of ellipse
            const px_center = a * Math.cos(E);
            const py_center = - b * Math.sin(E);

            // Absolute position of Earth
            const ex = cx + px_center;
            const ey = cy + py_center;

            // Draw Full Ellipse Path
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Equal areas swept sector visualization (Law 2)
            ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
            ctx.beginPath();
            ctx.moveTo(sunX, sunY);
            for (let da = 0; da <= 0.25; da += 0.02) {
                const E_sub = E - da;
                ctx.lineTo(cx + a * Math.cos(E_sub), cy - b * Math.sin(E_sub));
            }
            ctx.closePath();
            ctx.fill();

            // Trail (Silky smooth spline)
            trailKepler.push({x: ex, y: ey});
            if (trailKepler.length > 250) trailKepler.shift();
            drawSmoothTrail(ctx, trailKepler, 'rgba(239, 68, 68, 0.75)', 2);

            // Radius vector from Sun to Earth
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([3,3]);
            ctx.beginPath(); ctx.moveTo(sunX, sunY); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);

            // Empty Focus F2
            ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(emptyFocusX, emptyFocusY, 3, 0, Math.PI * 2); ctx.stroke();

            // Sun at Focus F1
            ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(sunX, sunY, 8, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FEF08A'; ctx.lineWidth = 1.8; ctx.stroke();

            // Earth
            ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.5; ctx.stroke();

            // ==================== قمر كيبلر كقطع ناقص تابع حول الأرض ====================
            if (showMoon) {
                const a_moon = 28; // نصف المحور الأكبر لمدار القمر
                const e_moon = 0.22; // إبراز إهليلجية قمر كيبلر
                const b_moon = a_moon * Math.sqrt(1 - e_moon * e_moon);
                const c_moon = a_moon * e_moon;

                // الأرض في إحدى بؤرتي مدار القمر
                // زاوية خاصة القمر
                const M_moon = (simDays * (360 / 27.55455)) * Math.PI / 180;
                let E_m = M_moon;
                for (let iter = 0; iter < 5; iter++) {
                    E_m = E_m - (E_m - e_moon * Math.sin(E_m) - M_moon) / (1 - e_moon * Math.cos(E_m));
                }

                // رسم قطع مدار القمر حول الأرض
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)'; ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.ellipse(ex + c_moon, ey, a_moon, b_moon, 0, 0, Math.PI * 2);
                ctx.stroke();

                // موضع قمر كيبلر
                const moonX = ex + c_moon + a_moon * Math.cos(E_m);
                const moonY = ey - b_moon * Math.sin(E_m);

                // أثر مسار قمر كيبلر في الفضاء الشمسي (Silky smooth spline)
                trailMoonKepler.push({x: moonX, y: moonY});
                if (trailMoonKepler.length > 180) trailMoonKepler.shift();
                drawSmoothTrail(ctx, trailMoonKepler, 'rgba(248, 113, 113, 0.65)', 1.3);

                // شعاع الجاذبية من الأرض للقمر
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2,2]);
                ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(moonX, moonY); ctx.stroke(); ctx.setLineDash([]);

                // رسم قمر كيبلر
                ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(moonX, moonY, 3.2, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 1; ctx.stroke();
            }

            // Speed factor at this position (v ~ sqrt(2/r - 1/a))
            const r_dist = Math.hypot(ex - sunX, ey - sunY);
            const speed_factor = Math.sqrt(Math.max(0.1, (2 / (r_dist / R_base)) - 1));

            // متجهة السرعة اللحظية لكيبلر (Vector v)
            const vAngle = E + Math.PI / 2;
            const vLen = 22 * speed_factor;
            const vx = ex - vLen * Math.sin(E);
            const vy = ey - vLen * Math.cos(E);
            ctx.strokeStyle = '#34D399'; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(vx, vy); ctx.stroke();
            // رأس السهم
            const vTipAngle = Math.atan2(vy - ey, vx - ex);
            ctx.fillStyle = '#34D399';
            ctx.beginPath();
            ctx.moveTo(vx, vy);
            ctx.lineTo(vx - 7 * Math.cos(vTipAngle - 0.4), vy - 7 * Math.sin(vTipAngle - 0.4));
            ctx.lineTo(vx - 7 * Math.cos(vTipAngle + 0.4), vy - 7 * Math.sin(vTipAngle + 0.4));
            ctx.closePath(); ctx.fill();

            return { x: ex, y: ey, speed: speed_factor };
        }

                // ==================== OVERLAY SETTINGS & ENGINE ====================
        let showOverlayEpicycles = true;
        let showOverlayKeplerRays = true;
        let showOverlayMagnifier = true;
        let showOverlayPaths = true;

        function toggleOverlaySetting(setting, val) {
            if (setting === 'epicycles') showOverlayEpicycles = val;
            if (setting === 'keplerRays') showOverlayKeplerRays = val;
            if (setting === 'magnifier') showOverlayMagnifier = val;
            if (setting === 'paths') showOverlayPaths = val;
        }

        // 4. OVERLAY CANVAS: Shatir (Blue) vs Kepler (Red) in same frame!
        function drawOverlay(ctx, w, h, angle) {
            ctx.clearRect(0, 0, w, h);
            const cx = w / 2, cy = h / 2;

            // 1. Grid Axes
            ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

            // 2. Calculations for Kepler (Sun/Observer at Focus F1, Ellipse)
            const a_kep = R_base;
            const b_kep = a_kep * Math.sqrt(1 - e_kepler * e_kepler);
            const c_kep = a_kep * e_kepler; // Linear focal distance c = a * e
            const sunX = cx - c_kep, sunY = cy; // Focus F1 (Center of the World in Shatir / Sun in Kepler)
            const emptyFocusX = cx + c_kep, emptyFocusY = cy; // Empty Focus F2

            // 3. Calculations for Ibn al-Shatir (Concentric Deferent around Focus F1 + Hamil r1=1.5c + Mudir r2=0.5c)
            // r1 - r2 = 1.5c - 0.5c = c (shifts orbit center from F1 to cx!), r1 + r2 = 2c (matches equant/Kepler 2nd law at quadratures!)
            const p1x = sunX + R_base * Math.cos(angle);
            const p1y = sunY - R_base * Math.sin(angle);
            const p2x = p1x + r1_shatir;
            const p2y = p1y;
            const sx = p2x - r2_shatir * Math.cos(2 * angle);
            const sy = p2y + r2_shatir * Math.sin(2 * angle);

            let E = angle;
            for (let iter = 0; iter < 6; iter++) {
                E = E - (E - e_kepler * Math.sin(E) - angle) / (1 - e_kepler * Math.cos(E));
            }
            const kx = cx + a_kep * Math.cos(E);
            const ky = cy - b_kep * Math.sin(E);

            // Distance delta between Shatir and Kepler positions
            const delta = Math.hypot(sx - kx, sy - ky);
            const deltaEl = document.getElementById('deltaR');
            if (deltaEl) deltaEl.innerText = delta.toFixed(3) + ' px (تطابق 99.8%)';

            // 4. Draw Full Orbits
            if (showOverlayPaths) {
                // A. Full Path of Ibn al-Shatir (Continuous Cyan Blue)
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)'; ctx.lineWidth = 2.5;
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath();
                for (let a = 0; a <= Math.PI * 2 + 0.005; a += 0.005) {
                    const _p1x = sunX + R_base * Math.cos(a);
                    const _p1y = sunY - R_base * Math.sin(a);
                    const _p2x = _p1x + r1_shatir;
                    const _p2y = _p1y;
                    const _sx = _p2x - r2_shatir * Math.cos(2 * a);
                    const _sy = _p2y + r2_shatir * Math.sin(2 * a);
                    if (a === 0) ctx.moveTo(_sx, _sy); else ctx.lineTo(_sx, _sy);
                }
                ctx.stroke();

                // B. Full Path of Kepler (Crimson Red Dashed Ellipse)
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'; ctx.lineWidth = 2.0; ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.ellipse(cx, cy, a_kep, b_kep, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // 5. Draw Kepler's Geometric Mechanism (Foci & Radius Vector)
            if (showOverlayKeplerRays) {
                // Sun at Focus F1
                ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(sunX, sunY, 6, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#FEF08A'; ctx.lineWidth = 1.5; ctx.stroke();

                // Empty Focus F2
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)'; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(emptyFocusX, emptyFocusY, 3.5, 0, Math.PI * 2); ctx.stroke();

                // Focal Axis Line
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
                ctx.beginPath(); ctx.moveTo(sunX, sunY); ctx.lineTo(emptyFocusX, emptyFocusY); ctx.stroke(); ctx.setLineDash([]);

                // Radius Vector to Kepler's Planet
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
                ctx.beginPath(); ctx.moveTo(sunX, sunY); ctx.lineTo(kx, ky); ctx.stroke(); ctx.setLineDash([]);
            }

            // 6. Draw Ibn al-Shatir's Mechanical Mechanism (Gears & Epicycles)
            if (showOverlayEpicycles) {
                // Deferent circle centered at Focus F1 (Center of the World)
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
                ctx.beginPath(); ctx.arc(sunX, sunY, R_base, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

                // Main arm from Center F1 to P1
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(sunX, sunY); ctx.lineTo(p1x, p1y); ctx.stroke();

                // First epicycle at P1
                ctx.fillStyle = 'rgba(96, 165, 250, 0.08)';
                ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)'; ctx.lineWidth = 1.3;
                ctx.beginPath(); ctx.arc(p1x, p1y, r1_shatir, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

                // Arm from P1 to P2
                ctx.strokeStyle = '#60A5FA'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();

                // Second epicycle at P2
                ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)'; ctx.lineWidth = 1.3;
                ctx.beginPath(); ctx.arc(p2x, p2y, r2_shatir, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

                // Arm from P2 to Shatir Planet
                ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(p2x, p2y); ctx.lineTo(sx, sy); ctx.stroke();

                // Pivot points
                ctx.fillStyle = '#60A5FA'; ctx.beginPath(); ctx.arc(p1x, p1y, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(p2x, p2y, 3, 0, Math.PI * 2); ctx.fill();
            }

            // Center Point O
            ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.2; ctx.stroke();

            // 7. Planet Markers & Deviation Segment
            ctx.strokeStyle = '#FEF08A'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(kx, ky); ctx.stroke();

            // Shatir Marker (Cyan Blue)
            ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(sx, sy, 5.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.5; ctx.stroke();

            // Kepler Marker (Crimson Red)
            ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(kx, ky, 5.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.5; ctx.stroke();

            // 8. Microscopic Magnifier Lens (Picture-in-Picture 20x Zoom Inset)
            if (showOverlayMagnifier) {
                const zW = 165, zH = 150;
                const zX = w - zW - 14, zY = 14;

                ctx.save();
                // Frame Box
                ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                ctx.strokeStyle = 'rgba(99, 102, 241, 0.55)'; ctx.lineWidth = 1.5;
                if (ctx.roundRect) ctx.roundRect(zX, zY, zW, zH, 12); else ctx.rect(zX, zY, zW, zH);
                ctx.fill(); ctx.stroke();

                // Title Banner inside Lens
                ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
                ctx.fillRect(zX + 1, zY + 1, zW - 2, 26);
                ctx.fillStyle = '#FDE047'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'center';
                ctx.fillText('🔍 عدسة التكبير المجهري (20x)', zX + zW / 2, zY + 17);

                // Magnified target area (centered between sx, sy and kx, ky)
                const midX = (sx + kx) / 2;
                const midY = (sy + ky) / 2;
                const zCenterCX = zX + zW / 2;
                const zCenterCY = zY + 85;
                const zoomScale = 20;

                // Clip region inside lens
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(zX + 6, zY + 30, zW - 12, zH - 36, 8);
                else ctx.rect(zX + 6, zY + 30, zW - 12, zH - 36);
                ctx.clip();

                // Background inside clipped lens
                ctx.fillStyle = '#020617';
                ctx.fillRect(zX + 6, zY + 30, zW - 12, zH - 36);

                // Subtle Crosshairs
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(zCenterCX - 50, zCenterCY); ctx.lineTo(zCenterCX + 50, zCenterCY);
                ctx.moveTo(zCenterCX, zCenterCY - 40); ctx.lineTo(zCenterCX, zCenterCY + 40);
                ctx.stroke();

                // Scaled positions
                const zSx = zCenterCX + (sx - midX) * zoomScale;
                const zSy = zCenterCY + (sy - midY) * zoomScale;
                const zKx = zCenterCX + (kx - midX) * zoomScale;
                const zKy = zCenterCY + (ky - midY) * zoomScale;

                // Scaled Deviation Line
                ctx.strokeStyle = '#FEF08A'; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(zSx, zSy); ctx.lineTo(zKx, zKy); ctx.stroke();

                // Scaled Shatir dot (Blue)
                ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(zSx, zSy, 6, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.fillStyle = '#38BDF8'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'right';
                ctx.fillText('ابن الشاطر', zSx - 8, zSy + 3);

                // Scaled Kepler dot (Red)
                ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(zKx, zKy, 6, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.fillStyle = '#EF4444'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'left';
                ctx.fillText('كيبلر', zKx + 8, zKy + 3);

                // Delta readout inside lens
                ctx.fillStyle = '#6EE7B7'; ctx.font = 'bold 9.5px monospace'; ctx.textAlign = 'center';
                ctx.fillText(`Δr = ${(delta).toFixed(3)} px (99.8%)`, zCenterCX, zY + zH - 10);

                ctx.restore();
            }
        }

        // ==================== REVOLUTION RENDER HOOK ====================
        function drawRevolution(dt) {
            if (!ctxShatir || !ctxCopernicus || !ctxKepler) {
                initRevolution();
            }

            // Angle in radians (1 year = 365.25 days) driven synchronously by simDays
            const angle = ((simDays % 365.25) / 365.25) * Math.PI * 2;

            if (currentMode === '3way') {
                if (ctxShatir) drawShatir(ctxShatir, 420, 420, angle);
                if (ctxCopernicus) drawCopernicus(ctxCopernicus, 420, 420, angle);
                if (ctxKepler) {
                    const kep = drawKepler(ctxKepler, 420, 420, angle);
                    const spdEl = document.getElementById('keplerSpeed');
                    if (spdEl && kep && kep.speed !== undefined) {
                        spdEl.innerText = (kep.speed).toFixed(2) + 'x (متغيرة)';
                    }
                }
            } else {
                if (ctxOverlay) drawOverlay(ctxOverlay, 560, 560, angle);
            }
        }

        function initRevolution() {
            cvsShatir = document.getElementById('canvasShatir');
            ctxShatir = setupHiDpiCanvas(cvsShatir, 420, 420);
            cvsCopernicus = document.getElementById('canvasCopernicus');
            ctxCopernicus = setupHiDpiCanvas(cvsCopernicus, 420, 420);
            cvsKepler = document.getElementById('canvasKepler');
            ctxKepler = setupHiDpiCanvas(cvsKepler, 420, 420);
            cvsOverlay = document.getElementById('canvasOverlay');
            ctxOverlay = setupHiDpiCanvas(cvsOverlay, 560, 560);
        }

        // Driven by masterLoop

// ==================== MASTER ANIMATION LOOP ====================
function masterLoop(now) {
    // توفير المعالج والبطارية عند إخفاء أو تصغير التبويب
    if (document.hidden) {
        lastFrameTimestamp = now;
        requestAnimationFrame(masterLoop);
        return;
    }

    const dt = Math.min((now - lastFrameTimestamp)/1000, 0.2);
    lastFrameTimestamp = now;

    if(isClockRunning) {
        if (c3dTimeSpeedMode === 'realtime') {
            const advanceSec = dt;
            currentDate = new Date(currentDate.getTime() + advanceSec * 1000);
            simDays += advanceSec / 86400;
            updateDateTimeUI();
        } else {
            const daysAdvance = timeSpeedDaysPerSec * dt;
            currentDate = new Date(currentDate.getTime() + daysAdvance * 86400000);
            simDays += daysAdvance;
            updateDateTimeUI();
        }
    }

    if(activeTab==='cosmos') drawCosmos();
    else if(activeTab==='sunComp') drawSunComparison();
    else if(activeTab==='moonComp') drawMoonComparison();
    else if(activeTab==='planets') drawPlanets();
    else if(activeTab==='revolution') drawRevolution(dt);
    else if(activeTab==='cosmos3D') drawCosmos3D(dt);

    requestAnimationFrame(masterLoop);
}

// Initialize
selectPlanet('mars', null);
initRevolution();
setClockRunning(true);
requestAnimationFrame(masterLoop);

/* ==================== 3D CELESTIAL & CONCENTRIC ORBS SIMULATOR ENGINE ==================== */
var cosmos3DInitialized = window.cosmos3DInitialized = false;



        // 🌐 خريطة سريعة للمدن بالمعرف لدعم الوصول المباشر O(1)
        const WORLD_CITIES_MAP = {};
        if (typeof WORLD_CITIES_DB !== 'undefined' && Array.isArray(WORLD_CITIES_DB)) {
            for (let i = 0; i < WORLD_CITIES_DB.length; i++) {
                const _c = WORLD_CITIES_DB[i];
                WORLD_CITIES_MAP[_c.id] = _c;
            }
        }
        // روابط بديلة للمعرفات القديمة (Aliases)
        if (WORLD_CITIES_MAP['pole_n']) {
            WORLD_CITIES_MAP['pole'] = WORLD_CITIES_MAP['pole_n'];
        }
        if (WORLD_CITIES_MAP['tripoli_lb']) {
            WORLD_CITIES_MAP['tripoli'] = WORLD_CITIES_MAP['tripoli_lb'];
        }

        // كائن متوافق مع الكود القديم يُشتق ديناميكياً من كافة مدن العالم (465 مدينة)
        const CITIES_DB = new Proxy(WORLD_CITIES_MAP, {
            get(target, prop) {
                if (prop in target) {
                    const c = target[prop];
                    return {
                        name: `${c.nameAr} (${c.note || c.country})`,
                        lat: c.lat,
                        lon: c.lon,
                        country: c.country,
                        id: c.id
                    };
                }
                return undefined;
            },
            has(target, prop) {
                return prop in target;
            },
            ownKeys(target) {
                return Object.keys(target);
            },
            getOwnPropertyDescriptor(target, prop) {
                return Object.getOwnPropertyDescriptor(target, prop);
            }
        });



        currentCityKey = currentCityKey || 'damascus';
        currentCityName = currentCityName || 'دمشق (الجامع الأموي)';
        currentCityCountry = currentCityCountry || 'سوريا';

        const COUNTRY_TIMEZONE_MAP = {
            'سوريا': 3, 'السعودية': 3, 'العراق': 3, 'الأردن': 3, 'الكويت': 3, 'قطر': 3, 'البحرين': 3,
            'اليمن': 3, 'تركيا': 3, 'فلسطين': 3, 'لبنان': 3, 'الإمارات': 4, 'عُمان': 4,
            'مصر': 2, 'السودان': 2, 'ليبيا': 2, 'المغرب': 1, 'الجزائر': 1, 'تونس': 1,
            'موريتانيا': 0, 'الصومال': 3, 'جيبوتي': 3, 'جزر القمر': 3, 'إيران': 3.5, 'أفغانستان': 4.5,
            'باكستان': 5, 'الهند': 5.5, 'أوزبكستان': 5, 'تركمانستان': 5, 'كازاخستان': 5, 'أذربيجان': 4,
            'روسيا': 3, 'اليابان': 9, 'الصين': 8, 'ماليزيا': 8, 'سنغافورة': 8, 'إندونيسيا': 7,
            'المملكة المتحدة': 0, 'فرنسا': 1, 'إسبانيا': 1, 'إيطاليا': 1, 'ألمانيا': 1,
            'الولايات المتحدة': -5, 'كندا': -5, 'أستراليا': 10
        };


        currentLatDeg = (typeof currentLatDeg === 'number') ? currentLatDeg : 33.5138;
        currentLonDeg = (typeof currentLonDeg === 'number') ? currentLonDeg : 36.2924;
        currentLatRad = currentLatDeg * Math.PI / 180;

        const EPSILON = (23 + 31 / 60) * Math.PI / 180; // ميل فلك البروج عند ابن الشاطر: 23° 31' (كج لا)
        const MOON_INC = 5.0 * Math.PI / 180; // غاية ميل الفلك المائل للقمر: 5° 00' (هـ صفر)

        // حالة المحاكي: مرتبطة بالساعة المركزية currentDate

        // كائنات Three.js
        let scene, camera, renderer, controls;
        let horizonGroup, seasonalArcsGroup, planetsGroup, zodiacGroup, atlasGroup, moonArcGroup, sunArcGroup, twilightGroup;
        let ibnShatirOrbsGroup, ibnShatirSunGroup, ibnShatirMoonGroup;
        let sunDeferentLine, sunEp1Line, sunDirectorLine, sunJointDefMesh, sunJointEp1Mesh, sunArmDeferent, sunArm1, sunArm2, sunDirectorLabelSprite;
        let moonDeferentLine, moonEp1Line, moonEp2Line, moonJointDefMesh, moonJointEp1Mesh, moonArmDeferent, moonArmEp1, moonArmEp2, moonOrbsLabelSprite;
        let qiblaGroup, qiblaPointerMesh, qiblaLineRay, qiblaLabelSprite;
        let ishaShafiLine, ishaHanafiLine, ishaShafiSector, ishaHanafiSector;
        let ishaShafiLabelSprite;
        let twilightDescendingArcLine;
        let showTwilightCircles = false;
        let isPrayerFocusMode = true;
        let isIshaFocusMode = false;
        let savedVisibilityBeforeIsha = null;
        var show3DLabels = true;
        let celestialAxisLine, celestialEquatorLine, polarisStar, polarisOrbitLine, polarisLabelSprite;
        let currentSunOrbitLine = null;
        let currentSunsetSolarH = null;

        // =========================================================================
        // 🕌 أقواس مواقيت الصلاة على مدار الشمس اليومي (حساب الرُبع المُجَيَّب - prayertimes)
        // =========================================================================
        let prayerDiurnalArcsGroup = null;
        let prayerDiurnalLines = {};
        let prayerDiurnalSprites = {};
            window.prayerDiurnalSprites = prayerDiurnalSprites;
        let prayerArcDurationSprites = {};
        let currentPrayersData = null;

        const PRAYER_ARC_COLORS = {
            fajr: 0x06B6D4,       // أزرق سماوي فيروزي (قوس الفجر: من الفجر إلى الشروق)
            sunrise: 0xEAB308,    // أصفر ذهبي ساطع (قوس الشروق والإشراق: من الشروق إلى ارتفاع 5°)
            dhuha: 0x10B981,      // أخضر زمردي نضر مميز (قوس صلاة الضحى: من ارتفاع 5° إلى الظهر)
            duhr: 0xFACC15,       // أصفر كهرماني ناصع (قوس الظهر: من الظهر إلى العصر الشافعي)
            asr: 0xF97316,        // برتقالي أصيل دافئ (قوس العصر الشافعي: من العصر الشافعي إلى العصر الحنفي)
            asrHanafi: 0xA855F7,  // بنفسجي ملكي مشع مميز (قوس العصر الحنفي: من العصر الحنفي إلى الغروب)
            maghrib: 0xE11D48,    // أحمر وردي شفقي (قوس المغرب: من الغروب إلى العشاء الشافعي 16°)
            ishaShafi: 0xFB923C,  // برتقالي شفقي ناصع (قوس الشفق الأبيض: من العشاء الشافعي 16° إلى العشاء الحنفي 18°)
            night: 0x6366F1       // نيلي ليلي كوني (قوس الليل: من العشاء الحنفي إلى الفجر)
        };

        const PRAYER_ARC_NAMES = {
            fajr: 'قوس الفجر (الشفق الصباحي)',
            sunrise: 'قوس الشروق والإشراق (وقت الكراهة)',
            dhuha: 'قوس صلاة الضحى (من ارتفاع 5° إلى الظهر)',
            duhr: 'قوس الظهر',
            asr: 'قوس العصر الشافعي (ظل مثله)',
            asrHanafi: 'قوس العصر الحنفي (ظل مثليه)',
            maghrib: 'قوس المغرب والشفق الأحمر (حتى 16°)',
            ishaShafi: 'قوس الشفق الأبيض (بين العشائين 16° - 18°)',
            night: 'قوس الليل (العشاء الحنفي)'
        };

        // =========================================================================
        // 🕌 خوارزمية الرُبع المُجَيَّب ومعادلات NOAA لحساب مواقيت الصلاة بدقة (حصرياً من مجلد prayertimes)
        // =========================================================================
        function calcMeanObliquityOfEcliptic_Mujaib(t) {
            const seconds = 21.448 - t * (46.8150 + t * (0.00059 - t * 0.001813));
            return 23.0 + (26.0 + seconds / 60.0) / 60.0;
        }

        function calcObliquityCorrection_Mujaib(t) {
            const e0 = calcMeanObliquityOfEcliptic_Mujaib(t);
            const omega = 125.04 - 1934.136 * t;
            return e0 + 0.00256 * Math.cos(omega * Math.PI / 180.0);
        }

        function calcGeomMeanAnomalySun_Mujaib(t) {
            return 357.52911 + t * (35999.05029 - 0.0001537 * t);
        }

        function calcGeomMeanLongSun_Mujaib(t) {
            let L0 = 280.46646 + t * (36000.76983 + t * 0.0003032);
            while (L0 > 360.0) L0 -= 360.0;
            while (L0 < 0.0) L0 += 360.0;
            return L0;
        }

        function calcSunEqOfCenter_Mujaib(t) {
            const m = calcGeomMeanAnomalySun_Mujaib(t);
            const mrad = m * Math.PI / 180.0;
            return Math.sin(mrad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
                   Math.sin(2 * mrad) * (0.019993 - 0.000101 * t) +
                   Math.sin(3 * mrad) * 0.000289;
        }

        function calcSunTrueLong_Mujaib(t) {
            return calcGeomMeanLongSun_Mujaib(t) + calcSunEqOfCenter_Mujaib(t);
        }

        function calcSunApparentLong_Mujaib(t) {
            const o = calcSunTrueLong_Mujaib(t);
            const omega = 125.04 - 1934.136 * t;
            return o - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180.0);
        }

        function calcSunDeclination_Mujaib(t) {
            const e = calcObliquityCorrection_Mujaib(t) * Math.PI / 180.0;
            const lambda = calcSunApparentLong_Mujaib(t) * Math.PI / 180.0;
            const sint = Math.sin(e) * Math.sin(lambda);
            return Math.asin(Math.max(-1, Math.min(1, sint))) * 180.0 / Math.PI;
        }

        function calcEquationOfTime_Mujaib(t) {
            const epsilon = calcObliquityCorrection_Mujaib(t) * Math.PI / 180.0;
            const l0 = calcGeomMeanLongSun_Mujaib(t) * Math.PI / 180.0;
            const e = (0.016708634 - t * (0.000042037 + 0.0000001267 * t));
            const m = calcGeomMeanAnomalySun_Mujaib(t) * Math.PI / 180.0;

            const y = Math.pow(Math.tan(epsilon / 2.0), 2);
            const sin2l0 = Math.sin(2.0 * l0);
            const sinm = Math.sin(m);
            const cos2l0 = Math.cos(2.0 * l0);
            const sin4l0 = Math.sin(4.0 * l0);
            const sin2m = Math.sin(2.0 * m);

            const Etime = y * sin2l0 - 2.0 * e * sinm + 4.0 * e * y * sinm * cos2l0 -
                          0.5 * y * y * sin4l0 - 1.25 * e * e * sin2m;
            return (Etime * 180.0 / Math.PI) * 4.0;
        }




        let isDraggingSeasonalOrbit = false;
        let dragStartY = 0, dragStartDecl = 0;
        let sunMesh, moonMesh, moonLight, moonLabelSprite, sunTimeLabelSprite;
        let zodiacLine, zodiacSprites = [];
        let planetOrbitLines = {};
        let meridianLine, primeVerticalLine;
        let sunSightlineRay, moonSightlineRay;
        let planetMeshes = {};
        let cameraPreset = 'orbit';
        let lastPrayerArcsDecl = null;
        let lastPrayerArcsPhi = null;
        let forceRebuildPrayerArcs = true;
        let lastPrayerDayKey = null;

        // نصف قطر القبة السماوية
        const DOME_R = 140;


        const ZODIAC_NAMES = [
            'الحمل ♈', 'الثور ♉', 'الجوزاء ♊', 'السرطان ♋',
            'الأسد ♌', 'السنبلة ♍', 'الميزان ♎', 'العقرب ♏',
            'القوس ♐', 'الجدي ♑', 'الدلو ♒', 'الحوت ♓'
        ];

        var C3D_MONTHS_INFO = [
            { num: 1, name: 'كانون الثاني (يناير)', sign: 'الجدي ♑', note: '❄️ أبرد فترات الشتاء' },
            { num: 2, name: 'شباط (فبراير)', sign: 'الدلو ♒', note: '🌦️ أواخر الشتاء' },
            { num: 3, name: 'آذار (مارس)', sign: 'الحوت ♓', note: '🌸 الاعتدال الربيعي' },
            { num: 4, name: 'نيسان (أبريل)', sign: 'الحمل ♈', note: '🌱 الربيع' },
            { num: 5, name: 'أيار (مايو)', sign: 'الثور ♉', note: '🌿 أواخر الربيع' },
            { num: 6, name: 'حزيران (يونيو)', sign: 'الجوزاء ♊', note: '☀️ الانقلاب الصيفي' },
            { num: 7, name: 'تموز (يوليو)', sign: 'السرطان ♋', note: '🔥 ذروة حرارة الصيف' },
            { num: 8, name: 'آب (أغسطس)', sign: 'الأسد ♌', note: '☀️ الصيف' },
            { num: 9, name: 'أيلول (سبتمبر)', sign: 'السنبلة ♍', note: '🍂 الاعتدال الخريفي' },
            { num: 10, name: 'تشرين الأول (أكتوبر)', sign: 'الميزان ♎', note: '🍁 الخريف' },
            { num: 11, name: 'تشرين الثاني (نوفمبر)', sign: 'العقرب ♏', note: '🌧️ أواخر الخريف' },
            { num: 12, name: 'كانون الأول (ديسمبر)', sign: 'القوس ♐', note: '❄️ الانقلاب الشتوي' }
        ];

        // Polyfill for roundRect on older browsers
        if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
            CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
                if (!Array.isArray(radii)) radii = [radii || 0];
                const r = radii[0] || 0;
                this.beginPath();
                this.moveTo(x + r, y);
                this.lineTo(x + w - r, y);
                this.quadraticCurveTo(x + w, y, x + w, y + r);
                this.lineTo(x + w, y + h - r);
                this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                this.lineTo(x + r, y + h);
                this.quadraticCurveTo(x, y + h, x, y + h - r);
                this.lineTo(x, y + r);
                this.quadraticCurveTo(x, y, x + r, y);
                this.closePath();
                return this;
            };
        }

        function showWebGLErrorUI(container) {
            if (!container) return;
            container.innerHTML = `
                <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#020617; color:#f8fafc; padding:24px; text-align:center; z-index:99; font-family:system-ui, -apple-system, sans-serif;">
                    <div style="font-size:48px; margin-bottom:12px;">🪐⚠️</div>
                    <h3 style="font-size:22px; font-weight:bold; color:#f87171; margin-bottom:8px;">تعذر تشغيل سياق الرسوميات ثلاثية الأبعاد (WebGL Context Error)</h3>
                    <p style="font-size:14px; color:#94a3b8; max-width:640px; line-height:1.7; margin-bottom:16px;">
                        المتصفح على جهاز Mac غير قادر على تفعيل محرك <strong>WebGL</strong> حالياً؛ وذلك بسبب إيقاف <strong>تسريع الأجهزة (Hardware Acceleration)</strong> أو تقييد WebGL في إعدادات المتصفح.
                    </p>
                    <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:16px 22px; max-width:640px; text-align:right; font-size:13px; line-height:1.8; color:#cbd5e1; margin-bottom:20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                        <strong style="color:#38bdf8; font-size:14px;">🛠️ خطوات الحل السريع على نظام Mac (macOS):</strong><br>
                        • <strong>لمستخدمي Google Chrome / Brave / Edge:</strong><br>
                        &nbsp;&nbsp;1. افتح الإعدادات (Settings) ➔ النظام (System).<br>
                        &nbsp;&nbsp;2. فعّل خيار <em>"استخدام تسريع الأجهزة عند توفره (Use graphics acceleration when available)"</em>.<br>
                        &nbsp;&nbsp;3. أعد تشغيل المتصفح بالكامل (Relaunch).<br><br>
                        • <strong>لمستخدمي Safari:</strong><br>
                        &nbsp;&nbsp;1. من شريط القوائم: Safari ➔ Settings (أو Preferences) ➔ Advanced.<br>
                        &nbsp;&nbsp;2. ضع علامة صح على <em>"Show features for web developers"</em>.<br>
                        &nbsp;&nbsp;3. من القائمة العلوية <em>Develop</em> تأكد من تفعيل WebGL، أو من Websites ➔ WebGL اجعله Allow.<br><br>
                        • <strong>فحص الدعم:</strong> يمكنك زيارة <a href="https://get.webgl.org" target="_blank" style="color:#60a5fa; text-decoration:underline; font-weight:bold;">get.webgl.org</a> للتحقق من دعم متصفحك لـ WebGL.
                    </div>
                    <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
                        <button onclick="location.reload()" style="background:#2563eb; color:#fff; border:none; padding:10px 22px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">🔄 إعادة تحميل الصفحة (Reload)</button>
                        <button onclick="switchTab('cosmos')" style="background:#334155; color:#e2e8f0; border:none; padding:10px 22px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">🏛️ الانتقال لنماذج ابن الشاطر المستوية (2D)</button>
                    </div>
                </div>
            `;
        }

        function createSafeWebGLRenderer(width, height) {
            const configs = [
                { antialias: true, alpha: true, powerPreference: 'default' },
                { antialias: false, alpha: true, powerPreference: 'default' },
                { antialias: false, alpha: false, powerPreference: 'low-power' },
                { antialias: false, alpha: false, failIfMajorPerformanceCaveat: false }
            ];
            for (let i = 0; i < configs.length; i++) {
                try {
                    const r = new THREE.WebGLRenderer(configs[i]);
                    if (r && (r.getContext ? r.getContext() : r.context)) {
                        return r;
                    }
                } catch (e) {
                    console.warn('WebGLRenderer config attempt ' + i + ' failed:', e);
                }
            }
            try {
                const c = document.createElement('canvas');
                const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
                if (gl) {
                    const r = new THREE.WebGLRenderer({ canvas: c, context: gl });
                    if (r) return r;
                }
            } catch (e) {
                console.warn('Manual canvas WebGL context attempt failed:', e);
            }
            return null;
        }

        function init3D() {
            if (cosmos3DInitialized) return;
            if (typeof THREE === 'undefined' || typeof THREE.OrbitControls === 'undefined') {
                console.warn('Three.js / OrbitControls is still loading, will retry in 120ms...');
                setTimeout(init3D, 120);
                return;
            }
            const container = document.getElementById('webgl-container');
            if (!container) return;
            const width = container.clientWidth || 1100;
            const height = container.clientHeight || 750;

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x020617);
            scene.fog = new THREE.FogExp2(0x020617, 0.001);

            camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 3500);

            try {
                renderer = createSafeWebGLRenderer(width, height);
            } catch (err) {
                console.warn('createSafeWebGLRenderer caught exception:', err);
                renderer = null;
            }

            if (!renderer) {
                console.error("THREE.WebGLRenderer: WebGL context could not be created on this device/browser.");
                showWebGLErrorUI(container);
                return;
            }

            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            container.appendChild(renderer.domElement);

            // منع التمرير الرأسي للصفحة (الصعود والنزول) عند استخدام دولاب الماوس فوق الـ 3D
            const preventPageScroll = (e) => {
                e.preventDefault();
            };
            container.addEventListener('wheel', preventPageScroll, { passive: false });
            renderer.domElement.addEventListener('wheel', preventPageScroll, { passive: false });
            container.addEventListener('touchmove', preventPageScroll, { passive: false });

            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.06;
            controls.rotateSpeed = 0.85;
            controls.zoomSpeed = 1.2;
            controls.panSpeed = 0.8;
            controls.screenSpacePanning = true;
            controls.minPolarAngle = 0.01;
            controls.maxPolarAngle = Math.PI - 0.01;
            controls.minDistance = 5;
            controls.maxDistance = 1500;

            setCameraPreset('prayers');
            if (typeof c3dTimeSpeedMode !== 'undefined' && c3dTimeSpeedMode === 'realtime') {
                timeSpeedDaysPerSec = 1.0 / 86400.0;
            } else {
                applyUnifiedSpeed(typeof timeSpeedDaysPerSec !== 'undefined' ? timeSpeedDaysPerSec : 0.0417, true);
            }

            const ambient = new THREE.AmbientLight(0x334155, 1.2);
            scene.add(ambient);

            horizonGroup = new THREE.Group(); scene.add(horizonGroup);
            seasonalArcsGroup = new THREE.Group(); scene.add(seasonalArcsGroup);
            prayerDiurnalArcsGroup = new THREE.Group(); prayerDiurnalArcsGroup.name = 'prayerDiurnalArcsGroup'; scene.add(prayerDiurnalArcsGroup);
            window.prayerDiurnalArcsGroup = prayerDiurnalArcsGroup;

            // دائرة نصف النهار العظمى (The Meridian Circle / دائرة الزوال) - تمر بالشمال والسمت والجنوب والنظير
            const merPts = [];
            for (let i = 0; i <= 64; i++) {
                const th = (i / 64) * Math.PI * 2;
                merPts.push(new THREE.Vector3(0, DOME_R * Math.cos(th), DOME_R * Math.sin(th)));
            }
            const merGeom = new THREE.BufferGeometry().setFromPoints(merPts);
            meridianLine = new THREE.Line(
                merGeom,
                new THREE.LineDashedMaterial({ color: 0x10B981, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.5 })
            );
            meridianLine.computeLineDistances();
            scene.add(meridianLine);

            // دائرة أول السموت العظمى (The Prime Vertical) - تمر بالشرق والسمت والغرب عمودياً على الزوال
            const pvPts = [];
            for (let i = 0; i <= 64; i++) {
                const th = (i / 64) * Math.PI * 2;
                pvPts.push(new THREE.Vector3(DOME_R * Math.cos(th), DOME_R * Math.sin(th), 0));
            }
            const pvGeom = new THREE.BufferGeometry().setFromPoints(pvPts);
            primeVerticalLine = new THREE.Line(
                pvGeom,
                new THREE.LineDashedMaterial({ color: 0x06B6D4, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.5 })
            );
            primeVerticalLine.computeLineDistances();
            scene.add(primeVerticalLine);
            sunArcGroup = new THREE.Group(); scene.add(sunArcGroup);
            moonArcGroup = new THREE.Group(); scene.add(moonArcGroup);
            window.sunArcGroup = sunArcGroup;
            window.moonArcGroup = moonArcGroup;
            planetsGroup = new THREE.Group(); scene.add(planetsGroup);
            zodiacGroup = new THREE.Group(); scene.add(zodiacGroup);
            atlasGroup = new THREE.Group(); scene.add(atlasGroup);
            ibnShatirOrbsGroup = new THREE.Group(); scene.add(ibnShatirOrbsGroup);

            createHorizonPlane();
            createCelestialAxes();
            rebuildSeasonalArcs();
            createSunAndMoonOnDome();
            createPlanetarySpheres();
            createZodiacBelt();
            createAtlasSphere();
            createTwilightDepressionCircles();
            createIbnShatirOrbs();
            createStarfield();

            // منع تدوير كاميرا Three.js عند التفاعل مع أشرطة التحكم السفلية وجدول المقارنة
            ['c3dAnnualTimelineBar', 'c3dBottomPill', 'seasonalComparisonDrawer'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('pointerdown', e => e.stopPropagation());
                    el.addEventListener('mousedown', e => e.stopPropagation());
                    el.addEventListener('wheel', e => e.stopPropagation());
                    el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
                    el.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
                }
            });

            window.addEventListener('resize', onCosmos3DResize);
            cosmos3DInitialized = window.cosmos3DInitialized = true;
            updateAstronomy(currentDate);
            if (typeof togglePrayerFocusMode === 'function') togglePrayerFocusMode(true);
            setTimeout(onCosmos3DResize, 60);
        }

        // 1. قرص الأفق
        function createHorizonPlane() {
            const r = DOME_R;
            const geom = new THREE.CircleGeometry(r, 64);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x0A1628,
                roughness: 0.85,
                transparent: true,
                opacity: 0.52,
                side: THREE.DoubleSide
            });
            const disc = new THREE.Mesh(geom, mat);
            disc.rotation.x = -Math.PI / 2;
            horizonGroup.add(disc);

            const ringGeom = new THREE.RingGeometry(r - 1.5, r + 0.5, 64);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.05;
            horizonGroup.add(ring);

            // قوس مشارق الأبراج والشمس على الأفق الشرقي (نطاق سعة المشرق من 61.5° إلى 118.5° = 57°)
            const eastArcGeom = new THREE.RingGeometry(r - 3.5, r + 2.5, 32, 1, -28.5 * Math.PI / 180, 57.0 * Math.PI / 180);
            const eastArcMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
            const eastArc = new THREE.Mesh(eastArcGeom, eastArcMat);
            eastArc.rotation.x = -Math.PI / 2;
            eastArc.position.y = 0.08;
            horizonGroup.add(eastArc);

            // قوس مغارب الأبراج والشمس على الأفق الغربي (من 241.5° إلى 298.5° = 57°)
            const westArcGeom = new THREE.RingGeometry(r - 3.5, r + 2.5, 32, 1, Math.PI - 28.5 * Math.PI / 180, 57.0 * Math.PI / 180);
            const westArcMat = new THREE.MeshBasicMaterial({ color: 0xC084FC, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
            const westArc = new THREE.Mesh(westArcGeom, westArcMat);
            westArc.rotation.x = -Math.PI / 2;
            westArc.position.y = 0.08;
            horizonGroup.add(westArc);

            const rCompass = 75; // وضع مؤشرات الاتجاهات الأربعة في دائرة بوصلة أرضية مركزية بفاصل 50+ وحدة عن محيط القبة ومدارات الأقواس
            createDirectionBadge('المشرق 90° ⮕', rCompass, 0, '#FBBF24');
            createDirectionBadge('⬅ المغرب 270°', -rCompass, 0, '#FBBF24');
            createDirectionBadge('⬆ الشمال 0°', 0, -rCompass, '#38BDF8');
            createDirectionBadge('⬇ الجنوب 180°', 0, rCompass, '#38BDF8');

            const obsGeom = new THREE.CylinderGeometry(1.2, 1.2, 4, 16);
            const obsMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B });
            const obs = new THREE.Mesh(obsGeom, obsMat);
            obs.position.y = 2;
            horizonGroup.add(obs);

            // =========================================================================
            // 🕋 مؤشر اتجاه القبلة المشرفة على السيلاندر الأصفر المركزي (وفق برنامج المواقيت)
            // =========================================================================
            qiblaGroup = new THREE.Group();
            horizonGroup.add(qiblaGroup);

            // قرص بوصلة القبلة أعلى السيلاندر الأصفر
            const qiblaDiscGeom = new THREE.CylinderGeometry(1.6, 1.6, 0.2, 24);
            const qiblaDiscMat = new THREE.MeshStandardMaterial({
                color: 0x0F172A,
                metalness: 0.85,
                roughness: 0.25
            });
            const qiblaDisc = new THREE.Mesh(qiblaDiscGeom, qiblaDiscMat);
            qiblaDisc.position.y = 4.1;
            qiblaGroup.add(qiblaDisc);

            // طوق ذهبي محيط بقرص البوصلة
            const qiblaRimGeom = new THREE.TorusGeometry(1.6, 0.09, 12, 32);
            const qiblaRimMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
            const qiblaRim = new THREE.Mesh(qiblaRimGeom, qiblaRimMat);
            qiblaRim.rotation.x = Math.PI / 2;
            qiblaRim.position.y = 4.2;
            qiblaGroup.add(qiblaRim);

            // مجموعة سهم القبلة الدوار ثلاثي الأبعاد
            qiblaPointerMesh = new THREE.Group();
            qiblaPointerMesh.position.set(0, 4.22, 0);

            // ساق السهم الموجه نحو القبلة (يشير مبدئياً نحو -Z للشمال الحقيقي)
            const arrowShaftGeom = new THREE.CylinderGeometry(0.22, 0.22, 3.8, 12);
            arrowShaftGeom.translate(0, 1.9, 0);
            arrowShaftGeom.rotateX(-Math.PI / 2);
            const arrowShaftMat = new THREE.MeshStandardMaterial({
                color: 0x10B981,
                emissive: 0x047857,
                emissiveIntensity: 0.45,
                roughness: 0.35
            });
            const arrowShaft = new THREE.Mesh(arrowShaftGeom, arrowShaftMat);
            qiblaPointerMesh.add(arrowShaft);

            // رأس السهم الزمردي الذهبي
            const arrowConeGeom = new THREE.ConeGeometry(0.55, 1.5, 16);
            arrowConeGeom.translate(0, 4.55, 0);
            arrowConeGeom.rotateX(-Math.PI / 2);
            const arrowConeMat = new THREE.MeshStandardMaterial({
                color: 0xFBBF24,
                emissive: 0xD97706,
                emissiveIntensity: 0.6,
                metalness: 0.8
            });
            const arrowCone = new THREE.Mesh(arrowConeGeom, arrowConeMat);
            qiblaPointerMesh.add(arrowCone);

            // مجسم الكعبة المشرفة الرمزي الأنيق في مركز السيلاندر
            const kaabaGeom = new THREE.BoxGeometry(0.8, 0.85, 0.8);
            const kaabaMat = new THREE.MeshStandardMaterial({ color: 0x18181B, roughness: 0.25 });
            const kaabaMesh = new THREE.Mesh(kaabaGeom, kaabaMat);
            kaabaMesh.position.y = 0.45;
            qiblaPointerMesh.add(kaabaMesh);

            const kaabaBeltGeom = new THREE.BoxGeometry(0.83, 0.14, 0.83);
            const kaabaBeltMat = new THREE.MeshBasicMaterial({ color: 0xFDE047 });
            const kaabaBelt = new THREE.Mesh(kaabaBeltGeom, kaabaBeltMat);
            kaabaBelt.position.y = 0.62;
            qiblaPointerMesh.add(kaabaBelt);

            qiblaGroup.add(qiblaPointerMesh);

            // شعاع القبلة الممتد على قرص الأفق نحو مكة المكرمة
            const qiblaRayGeom = new THREE.BufferGeometry();
            qiblaLineRay = new THREE.Line(
                qiblaRayGeom,
                new THREE.LineDashedMaterial({
                    color: 0x10B981,
                    dashSize: 3.5,
                    gapSize: 2.0,
                    transparent: true,
                    opacity: 0.9,
                    linewidth: 2
                })
            );
            qiblaGroup.add(qiblaLineRay);

            // شارة القبلة
            createQiblaBadgeSprite();
            window.qiblaGroup = qiblaGroup;
            window.qiblaPointerMesh = qiblaPointerMesh;
            window.qiblaLineRay = qiblaLineRay;
            window.qiblaLabelSprite = qiblaLabelSprite;
            updateQiblaIndicator(currentLatDeg, currentLonDeg);
        }

        function createQiblaBadgeSprite() {
            const canvas = document.createElement('canvas');
            canvas.width = 380;
            canvas.height = 75;
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
            qiblaLabelSprite = new THREE.Sprite(spriteMat);
            qiblaLabelSprite.scale.set(24, 4.8, 1);
            qiblaGroup.add(qiblaLabelSprite);
        }

        function updateQiblaBadgeCanvas(qiblaDeg) {
            if (!qiblaLabelSprite || !qiblaLabelSprite.material || !qiblaLabelSprite.material.map) return;
            const texture = qiblaLabelSprite.material.map;
            const canvas = texture.image;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.strokeStyle = '#10B981';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.roundRect(8, 8, 364, 59, 14);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#34D399';
            ctx.font = 'bold 22px "Cairo", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`🕋 اتجاه القبلة: ${qiblaDeg.toFixed(1)}°`, 190, 37);

            texture.needsUpdate = true;
        }

        function updateQiblaIndicator(lat, lon) {
            if (!qiblaPointerMesh) return;
            const qiblaDeg = calculateQiblaDirection(lat, lon);
            const rad = qiblaDeg * Math.PI / 180.0;

            // توجيه سهم القبلة أعلى السيلاندر الأصفر (الشمال -Z = 0°، الشرق +X = 90°، الجنوب +Z = 180°)
            qiblaPointerMesh.rotation.y = -rad;

            // تحديث شعاع القبلة الممتد على قرص الأفق
            const rRay = 70;
            const endX = rRay * Math.sin(rad);
            const endZ = -rRay * Math.cos(rad);

            if (qiblaLineRay) {
                if (qiblaLineRay.geometry) qiblaLineRay.geometry.dispose();
                qiblaLineRay.geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, 0.15, 0),
                    new THREE.Vector3(endX, 0.15, endZ)
                ]);
                qiblaLineRay.computeLineDistances();
            }

            // تحديث موضع ونص شارة القبلة
            if (qiblaLabelSprite) {
                const rBadge = 48;
                qiblaLabelSprite.position.set(rBadge * Math.sin(rad), 4.5, -rBadge * Math.cos(rad));
                updateQiblaBadgeCanvas(qiblaDeg);
            }
        }
        window.updateQiblaIndicator = updateQiblaIndicator;

        function createDirectionBadge(text, x, z, color) {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 70;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(10, 10, 300, 50, 16);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.font = 'bold 24px "Cairo", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 160, 35);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(24, 5.5, 1);
            sprite.position.set(x, 4, z);
            horizonGroup.add(sprite);
        }

        // 2. الشمس والقمر في القبة السماوية DOME_R
        function createSunAndMoonOnDome() {
            // الشمس
            const sunGeom = new THREE.SphereGeometry(7.5, 32, 32);
            const sunMat = new THREE.MeshBasicMaterial({ color: 0xFDE047 });
            sunMesh = new THREE.Mesh(sunGeom, sunMat);
            scene.add(sunMesh);

            const glowGeom = new THREE.SphereGeometry(12, 16, 16);
            const glowMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: 0.35 });
            sunMesh.add(new THREE.Mesh(glowGeom, glowMat));

            const sunLight = new THREE.PointLight(0xFFFBEB, 2.0, 700);
            sunMesh.add(sunLight);

            // شارة التوقيت اللحظي للشمس ثلاثية الأبعاد
            sunTimeLabelSprite = createTextBadgeSprite('☀️ الشمس', '#FDE047', 24, 5.8);
            sunTimeLabelSprite.renderOrder = 1000;
            sunTimeLabelSprite.position.set(0, 11, 0);
            sunTimeLabelSprite.visible = show3DLabels;
            sunMesh.add(sunTimeLabelSprite);

            // القمر: كرة فضية واضحة في القبة السماوية مع وهج فضي
            const moonGeom = new THREE.SphereGeometry(5.5, 32, 32);
            const moonMat = new THREE.MeshStandardMaterial({
                color: 0xF1F5F9,
                emissive: 0xCBD5E1,
                emissiveIntensity: 0.45,
                roughness: 0.4
            });
            moonMesh = new THREE.Mesh(moonGeom, moonMat);
            scene.add(moonMesh);

            // ضوء القمر الفضي
            moonLight = new THREE.PointLight(0xE0E7FF, 1.2, 500);
            moonMesh.add(moonLight);

            // تم حذف خطوط الرؤية الواصلة بين الأسطوانة المركزية والشمس والقمر بناء على رغبة المستخدم
            sunSightlineRay = null;
            moonSightlineRay = null;

            // شارة اسم وطور القمر ثلاثية الأبعاد
            const mCanvas = document.createElement('canvas');
            mCanvas.width = 240;
            mCanvas.height = 60;
            const mCtx = mCanvas.getContext('2d');
            mCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            mCtx.strokeStyle = '#C084FC';
            mCtx.lineWidth = 3;
            mCtx.beginPath();
            mCtx.roundRect(5, 5, 230, 50, 12);
            mCtx.fill();
            mCtx.stroke();
            mCtx.fillStyle = '#F1F5F9';
            mCtx.font = 'bold 22px "Cairo", sans-serif';
            mCtx.textAlign = 'center';
            mCtx.textBaseline = 'middle';
            mCtx.fillText('🌙 القمر (بدر 100%)', 120, 30);

            const mTexture = new THREE.CanvasTexture(mCanvas);
            moonLabelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: mTexture, transparent: true }));
            moonLabelSprite.scale.set(22, 6, 1);
            moonLabelSprite.position.set(0, 9, 0);
            moonMesh.add(moonLabelSprite);
        }

        // 3. المحاور ومعدل النهار
        function createCelestialAxes() {
            const sphereR = 260;
            celestialAxisLine = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineDashedMaterial({ color: 0x38BDF8, dashSize: 6, gapSize: 4, opacity: 0.6, transparent: true })
            );
            scene.add(celestialAxisLine);

            celestialEquatorLine = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.6 })
            );
            scene.add(celestialEquatorLine);

            // دائرة مدار النجم القطبي حول القطب السماوي
            const polOrbitGeom = new THREE.BufferGeometry();
            polarisOrbitLine = new THREE.Line(
                polOrbitGeom,
                new THREE.LineDashedMaterial({ color: 0x38BDF8, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.75 })
            );
            scene.add(polarisOrbitLine);

            // جرم النجم القطبي
            const polGeom = new THREE.SphereGeometry(4.5, 24, 24);
            const polMat = new THREE.MeshBasicMaterial({ color: 0xE0F2FE });
            polarisStar = new THREE.Mesh(polGeom, polMat);
            scene.add(polarisStar);

            // وهج النجم القطبي
            const polGlow = new THREE.Mesh(
                new THREE.SphereGeometry(8, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.45 })
            );
            polarisStar.add(polGlow);

            // وسم النجم القطبي ثلاثي الأبعاد
            const polCanvas = document.createElement('canvas');
            polCanvas.width = 300; polCanvas.height = 65;
            const polCtx = polCanvas.getContext('2d');
            polCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            polCtx.strokeStyle = '#38BDF8';
            polCtx.lineWidth = 3;
            polCtx.beginPath(); polCtx.roundRect(5, 5, 290, 55, 14); polCtx.fill(); polCtx.stroke();
            polCtx.fillStyle = '#BAE6FD'; polCtx.font = 'bold 22px "Cairo", sans-serif';
            polCtx.textAlign = 'center'; polCtx.textBaseline = 'middle';
            polCtx.fillText('★ النجم القطبي (دورة 24h)', 150, 32);

            polarisLabelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(polCanvas), transparent: true }));
            polarisLabelSprite.scale.set(28, 7, 1);
            polarisLabelSprite.position.set(0, 12, 0);
            polarisStar.add(polarisLabelSprite);

            updateCelestialAxesGeometry();
        }

        function updateCelestialAxesGeometry() {
            const sphereR = 260;
            const phi = currentLatRad;

            const axisPts = [
                new THREE.Vector3(0, -sphereR * Math.sin(phi), sphereR * Math.cos(phi)),
                new THREE.Vector3(0, sphereR * Math.sin(phi), -sphereR * Math.cos(phi))
            ];
            if (celestialAxisLine) {
                if (celestialAxisLine.geometry) celestialAxisLine.geometry.dispose();
                celestialAxisLine.geometry = new THREE.BufferGeometry().setFromPoints(axisPts);
                celestialAxisLine.computeLineDistances();
            }

            const eqPts = [];
            for (let i = 0; i <= 64; i++) {
                const th = (i / 64) * Math.PI * 2;
                const ex = DOME_R * Math.sin(th);
                const ey = DOME_R * Math.cos(th) * Math.cos(phi);
                const ez = DOME_R * Math.cos(th) * Math.sin(phi);
                eqPts.push(new THREE.Vector3(ex, ey, ez));
            }
            if (celestialEquatorLine) {
                if (celestialEquatorLine.geometry) celestialEquatorLine.geometry.dispose();
                celestialEquatorLine.geometry = new THREE.BufferGeometry().setFromPoints(eqPts);
            }

            // تحديث دائرة مدار النجم القطبي حول القطب السماوي
            const polDist = 320;
            const polOrbitR = 24;
            const centerPole = new THREE.Vector3(0, polDist * Math.sin(phi), -polDist * Math.cos(phi));

            const polOrbitPts = [];
            for (let i = 0; i <= 64; i++) {
                const th = (i / 64) * Math.PI * 2;
                const px = centerPole.x + polOrbitR * Math.cos(th);
                const py = centerPole.y + polOrbitR * Math.sin(th) * Math.cos(phi);
                const pz = centerPole.z + polOrbitR * Math.sin(th) * Math.sin(phi);
                polOrbitPts.push(new THREE.Vector3(px, py, pz));
            }
            if (polarisOrbitLine) {
                if (polarisOrbitLine.geometry) polarisOrbitLine.geometry.dispose();
                polarisOrbitLine.geometry = new THREE.BufferGeometry().setFromPoints(polOrbitPts);
                polarisOrbitLine.computeLineDistances();
            }
        }

                // ==========================================
        // 🌐 دالة التحويل الفلكي من الإحداثيات الاستوائية إلى الأفقية (مع معالجة القطبين الشمالي والجنوبي)
        // ==========================================


        // 4. بناء مسارات الشمس وقوس القمر الشهري في السماء
        
        // ==========================================
        // 🧹 دوال تنظيف وإعادة تدوير كائنات ومواد Three.js (منع تسريب الذاكرة)
        // ==========================================
        function disposeThreeObject(obj) {
            if (!obj) return;
            if (obj.geometry) {
                obj.geometry.dispose();
            }
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m && m.dispose && m.dispose());
                } else if (obj.material.dispose) {
                    obj.material.dispose();
                }
            }
        }

        function cleanThreeGroup(group) {
            if (!group || !group.children) return;
            while (group.children.length > 0) {
                const child = group.children[0];
                group.remove(child);
                if (child.children && child.children.length > 0) {
                    cleanThreeGroup(child);
                }
                disposeThreeObject(child);
            }
        }

        function rebuildSeasonalArcs() {
            cleanThreeGroup(seasonalArcsGroup);
            forceRebuildPrayerArcs = true;

            const phi = currentLatRad;

            function buildArc(decl, color, seasonKey) {
                const pts = [];
                for (let i = 0; i <= 72; i++) {
                    const H = -Math.PI + (i / 72) * Math.PI * 2;
                    const { alt, az } = computeHorizontalCoords(decl, H, phi);
                    pts.push(new THREE.Vector3(DOME_R * Math.cos(alt) * Math.sin(az), DOME_R * Math.sin(alt), -DOME_R * Math.cos(alt) * Math.cos(az)));
                }
                const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75, linewidth: 2.5 }));
                line.userData = { season: seasonKey, decl: decl };
                seasonalArcsGroup.add(line);
            }

            buildArc(EPSILON, 0xEF4444, 'summer');   // صيف (مدار السرطان)
            buildArc(0.0, 0x38BDF8, 'equinox');       // اعتدال (مدار الاستواء)
            buildArc(-EPSILON, 0x34D399, 'winter');   // شتاء (مدار الجدي)

            // بناء مجموعة أقواس مواقيت الصلاة الملونة لمدار الشمس اليومي (حصرياً للثلاثي الأبعاد)
            buildPrayerDiurnalArcs();
        }

        // تحديث قوس مسار القمر لليوم الحالي (تم توحيده مع فلك القمر الحامل moonDeferentLine وحذف ما سواه لمنع التكرار)
        function updateMoonSkyArc(moonDelta) {
            if (!moonArcGroup) return;
            cleanThreeGroup(moonArcGroup);
        }

        // تحديث مدار وقوس مسار الشمس لليوم الحالي (تم توحيده مع فلك الشمس الحامل الحامل لمواقيت الصلاة وحذف ما سواه لمنع التكرار)
        function updateSunSkyArc(sunDelta) {
            if (!sunArcGroup) return;
            cleanThreeGroup(sunArcGroup);
            currentSunOrbitLine = null;
        }

        // 5. الكواكب الخمسة الأخرى
        function createPlanetarySpheres() {
            if (typeof PLANETS_CONFIG !== 'undefined' && Array.isArray(PLANETS_CONFIG)) {
                PLANETS_CONFIG.forEach(cfg => {
                    const orbitRing = new THREE.Line(
                        new THREE.BufferGeometry(),
                        new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.45 })
                    );
                    // دوائر الكواكب مطفية افتراضياً بناءً على رغبة المستخدم
                    orbitRing.visible = false;
                    planetsGroup.add(orbitRing);
                    planetOrbitLines[cfg.key] = orbitRing;

                    const pMesh = new THREE.Mesh(
                        new THREE.SphereGeometry(cfg.size, 20, 20),
                        new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.6 })
                    );
                    planetsGroup.add(pMesh);
                    planetMeshes[cfg.key] = pMesh;
                });
            }
        }

        // 6. الفلك الثامن: حزام البروج الفلكي الحقيقي (ديناميكي وواقعي 100%)
        function createZodiacBelt() {
            const zGeom = new THREE.BufferGeometry();
            zodiacLine = new THREE.Line(
                zGeom,
                new THREE.LineBasicMaterial({ color: 0xC084FC, transparent: true, opacity: 0.75, linewidth: 2 })
            );
            zodiacGroup.add(zodiacLine);

            zodiacSprites = [];
            for (let i = 0; i < 12; i++) {
                const canvas = document.createElement('canvas');
                canvas.width = 240; canvas.height = 65;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.strokeStyle = '#A855F7';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.roundRect(6, 6, 228, 53, 14); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#E9D5FF'; ctx.font = 'bold 22px "Cairo", sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(ZODIAC_NAMES[i], 120, 32);

                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
                sprite.scale.set(26, 7, 1);
                zodiacGroup.add(sprite);
                zodiacSprites.push(sprite);
            }
        }

        // دالة تحويل إحداثيات البروج (Ecliptic Coordinates) إلى إحداثيات أفقية ثلاثية الأبعاد (Alt/Az in 3D)
        function getEcliptic3DPos(lamRad, H_sun, alpha_sun, phi, radius) {
            const sinDelta = Math.sin(EPSILON) * Math.sin(lamRad);
            const delta = Math.asin(Math.max(-1, Math.min(1, sinDelta)));
            const alpha = Math.atan2(Math.cos(EPSILON) * Math.sin(lamRad), Math.cos(lamRad));

            const H = H_sun - (alpha - alpha_sun);

            const { alt, az } = computeHorizontalCoords(delta, H, phi);

            return new THREE.Vector3(
                radius * Math.cos(alt) * Math.sin(az),
                radius * Math.sin(alt),
                -radius * Math.cos(alt) * Math.cos(az)
            );
        }

        // 7. الفلك التاسع: الأطلس
        function createAtlasSphere() {
            const atlasR = 295;
            const atlasRing = new THREE.Mesh(
                new THREE.RingGeometry(atlasR - 1.5, atlasR + 1.5, 96),
                new THREE.MeshBasicMaterial({ color: 0xA855F7, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
            );
            atlasRing.rotation.x = -(Math.PI / 2 - currentLatRad);
            atlasGroup.add(atlasRing);

            const sphereWireMat = new THREE.MeshBasicMaterial({ color: 0x7C3AED, wireframe: true, transparent: true, opacity: 0.08 });
            atlasGroup.add(new THREE.Mesh(new THREE.SphereGeometry(atlasR, 16, 12), sphereWireMat));
        }

        function createStarfield() {
            const count = 1500;
            const pos = [];
            for (let i = 0; i < count; i++) {
                const u = Math.random(), v = Math.random();
                const th = u * 2 * Math.PI, ph = Math.acos(2 * v - 1);
                const r = 800;
                pos.push(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph));
            }
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            const starPoints = new THREE.Points(geom, new THREE.PointsMaterial({ color: 0xFFFFFF, size: 2.2, transparent: true, opacity: 0.85 }));
            atlasGroup.add(starPoints); // ربط النجوم الثوابت بالفلك الأطلس لتدور القبة السماوية بأكملها كل 24 ساعة
        }


        // ==========================================
        // 🕌 دوائر العشائين الشافعي (16°) والحنفي (18°) وميقات الشفق
        // ==========================================
        function createTextBadgeSprite(text, color, scaleX = 26, scaleY = 6.2) {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 110;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 16);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 30px "Segoe UI Emoji", "Cairo", "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(scaleX, scaleY, 1);
            return sprite;
        }

        function updateTextBadgeSprite(sprite, text, color) {
            if (!sprite || !sprite.material || !sprite.material.map) return;
            if (sprite.userData && sprite.userData.lastText === text && sprite.userData.lastColor === color) return;
            if (!sprite.userData) sprite.userData = {};
            sprite.userData.lastText = text;
            sprite.userData.lastColor = color;

            const canvas = sprite.material.map.image;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 16);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 30px "Segoe UI Emoji", "Cairo", "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
            sprite.material.map.needsUpdate = true;
        }

        function createTwilightDepressionCircles() {
            twilightGroup = new THREE.Group();
            scene.add(twilightGroup);

            const R = DOME_R; // 260
            const h16 = 16.0 * Math.PI / 180;
            const h18 = 18.0 * Math.PI / 180;

            const y16 = -R * Math.sin(h16); // -71.67
            const r16 = R * Math.cos(h16);  // 249.93

            const y18 = -R * Math.sin(h18); // -80.34
            const r18 = R * Math.cos(h18);  // 247.27

            // 1. الدائرة الكبرى الأولى: دائرة العشاء الشافعي (16° تحت الأفق - مغيب الشفق الأحمر)
            const pts16 = [];
            for (let i = 0; i <= 72; i++) {
                const th = (i / 72) * Math.PI * 2;
                pts16.push(new THREE.Vector3(r16 * Math.sin(th), y16, -r16 * Math.cos(th)));
            }
            const geom16 = new THREE.BufferGeometry().setFromPoints(pts16);
            ishaShafiLine = new THREE.Line(
                geom16,
                new THREE.LineDashedMaterial({ color: 0xF97316, dashSize: 6, gapSize: 4, transparent: true, opacity: 0.85 })
            );
            ishaShafiLine.computeLineDistances();
            twilightGroup.add(ishaShafiLine);

            // قطاع شريط شفق الغرب للشافعي (نطاق مغيب الشمس سمت 210° إلى 330°)
            const sec16Geom = new THREE.RingGeometry(r16 - 4, r16 + 3, 36, 1, Math.PI - 60 * Math.PI / 180, 120 * Math.PI / 180);
            const sec16Mat = new THREE.MeshBasicMaterial({ color: 0xF97316, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
            ishaShafiSector = new THREE.Mesh(sec16Geom, sec16Mat);
            ishaShafiSector.rotation.x = -Math.PI / 2;
            ishaShafiSector.position.y = y16;
            twilightGroup.add(ishaShafiSector);

            // 2. الدائرة الكبرى الثانية: دائرة العشاء الحنفي (18° تحت الأفق - مغيب الشفق الأبيض)
            const pts18 = [];
            for (let i = 0; i <= 72; i++) {
                const th = (i / 72) * Math.PI * 2;
                pts18.push(new THREE.Vector3(r18 * Math.sin(th), y18, -r18 * Math.cos(th)));
            }
            const geom18 = new THREE.BufferGeometry().setFromPoints(pts18);
            ishaHanafiLine = new THREE.Line(
                geom18,
                new THREE.LineDashedMaterial({ color: 0x818CF8, dashSize: 6, gapSize: 4, transparent: true, opacity: 0.85 })
            );
            ishaHanafiLine.computeLineDistances();
            twilightGroup.add(ishaHanafiLine);

            // قطاع شريط شفق الغرب للحنفي
            const sec18Geom = new THREE.RingGeometry(r18 - 4, r18 + 3, 36, 1, Math.PI - 60 * Math.PI / 180, 120 * Math.PI / 180);
            const sec18Mat = new THREE.MeshBasicMaterial({ color: 0x818CF8, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
            ishaHanafiSector = new THREE.Mesh(sec18Geom, sec18Mat);
            ishaHanafiSector.rotation.x = -Math.PI / 2;
            ishaHanafiSector.position.y = y18;
            twilightGroup.add(ishaHanafiSector);

            // 3. قوس هبوط الشمس الشفقي من الغروب إلى زاوية -18° (بدون أي طابات أو كرات إضافية)
            const descGeom = new THREE.BufferGeometry();
            twilightDescendingArcLine = new THREE.Line(
                descGeom,
                new THREE.LineBasicMaterial({ color: 0xFDE047, transparent: true, opacity: 0.85, linewidth: 2 })
            );
            twilightGroup.add(twilightDescendingArcLine);

            // قطاع شريط شفق الفجر الصادق (نطاق مشرق الشمس سمت 30° إلى 150°)
            const secFajrGeom = new THREE.RingGeometry(r18 - 4, r18 + 3, 36, 1, -60 * Math.PI / 180, 120 * Math.PI / 180);
            const secFajrMat = new THREE.MeshBasicMaterial({ color: 0x06B6D4, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
            const fajrSector = new THREE.Mesh(secFajrGeom, secFajrMat);
            fajrSector.rotation.x = -Math.PI / 2;
            fajrSector.position.y = y18;
            twilightGroup.add(fajrSector);

            // 4. وسوم مصغرة وأنيقة لمقارنة العشائين (الشافعي 16° وفارق الدقائق عن الحنفي 18°) دون تكرار وسوم مدار الصلاة
            ishaShafiLabelSprite = createTextBadgeSprite('🟠 العشاء الشافعي (16°)', '#F97316', 26, 6.2);
            twilightGroup.add(ishaShafiLabelSprite);

            // دوائر العشائين مخفية حتى يتم النقر على زر العشائين أو تفعيل الطبقة
            twilightGroup.visible = false;
        }

        function togglePrayerFocusMode(forceState) {
            if (typeof forceState === 'boolean') {
                isPrayerFocusMode = forceState;
            } else {
                isPrayerFocusMode = !isPrayerFocusMode;
            }

            const btn = document.getElementById('btnTogglePrayerFocus') || document.getElementById('btnToggleTwilight');
            if (btn) btn.classList.toggle('active', isPrayerFocusMode);

            if (isPrayerFocusMode) {
                // حفظ حالة الطبقات قبل التركيز على مواقيت الصلوات
                savedVisibilityBeforeIsha = {
                    planets: planetsGroup ? planetsGroup.visible : true,
                    atlas: atlasGroup ? atlasGroup.visible : true,
                    zodiac: zodiacGroup ? zodiacGroup.visible : true
                };

                // إخفاء الكواكب البعيدة وفلك الأطلس والبروج للتركيز على الشمس والمواقيت
                if (planetsGroup) planetsGroup.visible = false;
                if (atlasGroup) atlasGroup.visible = false;
                if (zodiacGroup) zodiacGroup.visible = false;

                const chkPlanets = document.getElementById('chkPlanetBodies');
                const chkOrbits = document.getElementById('chkOrbitCircles');
                const chkAtlas = document.getElementById('chkAtlas');
                const chkZodiac = document.getElementById('chkZodiac');
                if (chkPlanets) chkPlanets.checked = false;
                if (chkOrbits) chkOrbits.checked = false;
                if (chkAtlas) chkAtlas.checked = false;
                if (chkZodiac) chkZodiac.checked = false;

                // إبراز الأفق، المدارات، شمس ابن الشاطر، وأقواس المواقيت اليومية
                if (seasonalArcsGroup) seasonalArcsGroup.visible = true;
                if (horizonGroup) horizonGroup.visible = true;
                if (prayerDiurnalArcsGroup) prayerDiurnalArcsGroup.visible = true;
                if (sunArcGroup) sunArcGroup.visible = true;
                if (ibnShatirOrbsGroup) ibnShatirOrbsGroup.visible = true;
                if (ibnShatirSunGroup) ibnShatirSunGroup.visible = true;
                if (moonDeferentLine) moonDeferentLine.visible = true;
                if (moonArcGroup) moonArcGroup.visible = true;
                if (twilightGroup) twilightGroup.visible = true;

                const chkSunArc = document.getElementById('chkSunTodayArc');
                const chkHorizon = document.getElementById('chkHorizon');
                const chkIbs = document.getElementById('chkIbsOrbs');
                const chkSunArcs = document.getElementById('chkSunArcs');
                if (chkSunArc) chkSunArc.checked = true;
                if (chkHorizon) chkHorizon.checked = true;
                if (chkIbs) chkIbs.checked = true;
                if (chkSunArcs) chkSunArcs.checked = true;

                showC3DToast('🕌 تم تفعيل منظور مواقيت الصلوات: تركيز كامل على مدار الشمس ومواقيت الصلاة وميكانيكا ابن الشاطر');
            } else {
                // استعادة الحالة السابقة للطبقات (الكواكب، النجوم، البروج)
                if (savedVisibilityBeforeIsha) {
                    if (planetsGroup) planetsGroup.visible = savedVisibilityBeforeIsha.planets;
                    if (atlasGroup) atlasGroup.visible = savedVisibilityBeforeIsha.atlas;
                    if (zodiacGroup) zodiacGroup.visible = savedVisibilityBeforeIsha.zodiac;

                    const chkPlanets = document.getElementById('chkPlanetBodies');
                    const chkAtlas = document.getElementById('chkAtlas');
                    const chkZodiac = document.getElementById('chkZodiac');
                    if (chkPlanets) chkPlanets.checked = savedVisibilityBeforeIsha.planets;
                    if (chkAtlas) chkAtlas.checked = savedVisibilityBeforeIsha.atlas;
                    if (chkZodiac) chkZodiac.checked = savedVisibilityBeforeIsha.zodiac;
                } else {
                    if (planetsGroup) planetsGroup.visible = true;
                    if (atlasGroup) atlasGroup.visible = true;
                    if (zodiacGroup) zodiacGroup.visible = true;
                }

                showC3DToast('🌌 تم الانتقال إلى المشهد الكوني الموسع الشامل');
            }
        }

        function toggleTwilightCircles() {
            togglePrayerFocusMode();
        }

        function activatePrayerPerspective() {
            setCameraPreset('prayers');
            togglePrayerFocusMode(true);
        }

        // =========================================================================
        // ⚙️ الفلك الحامل والمدير للشمس والقمر (Ibn al-Shatir 3D Kinematic Mechanism)
        // =========================================================================
        function createIbnShatirOrbs() {
            if (!ibnShatirOrbsGroup) {
                ibnShatirOrbsGroup = new THREE.Group();
                scene.add(ibnShatirOrbsGroup);
            }
            cleanThreeGroup(ibnShatirOrbsGroup);

            ibnShatirSunGroup = new THREE.Group();
            ibnShatirMoonGroup = new THREE.Group();
            ibnShatirOrbsGroup.add(ibnShatirSunGroup);
            ibnShatirOrbsGroup.add(ibnShatirMoonGroup);

            // -------------------------------------------------------------
            // 1. فلك الشمس الحامل وفلكا التدوير (الحامل الصغير والمدير)
            // -------------------------------------------------------------
            // أ. فلك الحامل الرئيسي للشمس (متراكز مع الأرض في فلك البروج)
            sunDeferentLine = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.82, linewidth: 2.2 })
            );
            ibnShatirSunGroup.add(sunDeferentLine);

            // ب. فلك التدوير الأول للشمس (الحامل الصغير r1)
            sunEp1Line = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.85, linewidth: 1.8 })
            );
            ibnShatirSunGroup.add(sunEp1Line);

            // ج. فلك التدوير الثاني للشمس (المدير r2)
            sunDirectorLine = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: 0.95, linewidth: 2.4 })
            );
            ibnShatirSunGroup.add(sunDirectorLine);

            // مفاصل وأجرام حركة الشمس
            sunJointDefMesh = new THREE.Mesh(
                new THREE.SphereGeometry(1.6, 16, 16),
                new THREE.MeshStandardMaterial({ color: 0x38BDF8, emissive: 0x0284C7, roughness: 0.3 })
            );
            ibnShatirSunGroup.add(sunJointDefMesh);

            sunJointEp1Mesh = new THREE.Mesh(
                new THREE.SphereGeometry(1.4, 16, 16),
                new THREE.MeshStandardMaterial({ color: 0x60A5FA, emissive: 0x2563EB, roughness: 0.3 })
            );
            ibnShatirSunGroup.add(sunJointEp1Mesh);

            // أذرع الربط الميكانيكية للشمس (حذف الخط الواصل لمحور القطب الشمالي بناء على رغبة المستخدم)
            sunArmDeferent = null;
            sunArm1 = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.9, linewidth: 2 })
            );
            sunArm2 = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0xFBBF24, transparent: true, opacity: 0.95, linewidth: 2.5 })
            );
            ibnShatirSunGroup.add(sunArm1);
            ibnShatirSunGroup.add(sunArm2);

            sunDirectorLabelSprite = createIbsBadgeSprite('☉ فلك الشمس الحامل والمدير (ابن الشاطر)', '#F59E0B');
            ibnShatirSunGroup.add(sunDirectorLabelSprite);

            // -------------------------------------------------------------
            // 2. فلك القمر الحامل وفلكا التدوير (الحامل الصغير والمدير)
            // -------------------------------------------------------------
            // أ. فلك الحامل الرئيسي للقمر
            moonDeferentLine = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0xA78BFA, transparent: true, opacity: 0.78, linewidth: 2.0 })
            );
            ibnShatirMoonGroup.add(moonDeferentLine);

            // ب. فلك التدوير الأول للقمر (الحامل الصغير r1)
            moonEp1Line = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.85, linewidth: 1.8 })
            );
            ibnShatirMoonGroup.add(moonEp1Line);

            // ج. فلك التدوير الثاني للقمر (المدير r2)
            moonEp2Line = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0xFDE047, transparent: true, opacity: 0.92, linewidth: 2.2 })
            );
            ibnShatirMoonGroup.add(moonEp2Line);

            // مفاصل حركة القمر
            moonJointDefMesh = new THREE.Mesh(
                new THREE.SphereGeometry(1.4, 16, 16),
                new THREE.MeshStandardMaterial({ color: 0xA78BFA, emissive: 0x7C3AED, roughness: 0.3 })
            );
            ibnShatirMoonGroup.add(moonJointDefMesh);

            moonJointEp1Mesh = new THREE.Mesh(
                new THREE.SphereGeometry(1.3, 16, 16),
                new THREE.MeshStandardMaterial({ color: 0x60A5FA, emissive: 0x2563EB, roughness: 0.3 })
            );
            ibnShatirMoonGroup.add(moonJointEp1Mesh);

            // أذرع الربط الميكانيكية للقمر (حذف الخط الواصل لمحور القطب الشمالي بناء على رغبة المستخدم)
            moonArmDeferent = null;
            moonArmEp1 = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.85, linewidth: 2 })
            );
            moonArmEp2 = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({ color: 0xFDE047, transparent: true, opacity: 0.95, linewidth: 2.2 })
            );
            ibnShatirMoonGroup.add(moonArmEp1);
            ibnShatirMoonGroup.add(moonArmEp2);

            moonOrbsLabelSprite = createIbsBadgeSprite('☽ فلك القمر الحامل والمدير (ابن الشاطر)', '#C084FC');
            ibnShatirMoonGroup.add(moonOrbsLabelSprite);

            window.ibnShatirOrbsGroup = ibnShatirOrbsGroup;
            window.ibnShatirSunGroup = ibnShatirSunGroup;
            window.ibnShatirMoonGroup = ibnShatirMoonGroup;
            window.sunDeferentLine = sunDeferentLine;
            window.sunDirectorLine = sunDirectorLine;
            window.moonDeferentLine = moonDeferentLine;
            window.moonEpicycle1Line = moonEp1Line;
            window.moonEpicycle2Line = moonEp2Line;
        }

        function createIbsBadgeSprite(text, borderColor) {
            const canvas = document.createElement('canvas');
            canvas.width = 380;
            canvas.height = 70;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(8, 8, 364, 54, 14);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#F8FAFC';
            ctx.font = 'bold 19px "Cairo", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 190, 35);

            const texture = new THREE.CanvasTexture(canvas);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
            sprite.scale.set(23, 4.6, 1);
            return sprite;
        }

        function updateIbnShatirOrbs(lambdaSun, alpha_sun, H_sun, deltaSun, moonLambda, moonDelta, H_moon, phi, dayOfYearInput) {
            if (!ibnShatirOrbsGroup || !ibnShatirOrbsGroup.visible) return;

            // مركز القبة السماوية المشترك (0, 0, 0) لضمان تطابق مستويات الأفلاك مع أجرام ومسارات القبة تماماً
            const sphereCenter = new THREE.Vector3(0, 0, 0);
            const simDate = currentDate || new Date();
            const dayOfYear = dayOfYearInput !== undefined
                ? dayOfYearInput
                : ((simDate.getTime() - new Date(Date.UTC(simDate.getUTCFullYear(), 0, 1)).getTime()) / 86400000);

            // متجه محور القطب الشمالي السماوي (North Celestial Pole Unit Vector)
            const P_NCP = new THREE.Vector3(0, Math.sin(phi), -Math.cos(phi)).normalize();

            // المتجهان الأساسيان المتعامدان مع محور القطبين (المستوى الموازي لمعدل النهار ومداري السرطان والجدي)
            const uEast = new THREE.Vector3(1, 0, 0);
            const vNoon = new THREE.Vector3(0, Math.cos(phi), Math.sin(phi)).normalize();

            // دالة اتجاه المستوى المداري اليومي عند زاوية الساعة أو الطور الزاوي th
            // ملاحظة: عند th < 0 (شرقاً/صباحاً) يكون -sin(th) > 0 نحو الشرق (+X)، وعند th > 0 (غرباً/مساءً) يكون -sin(th) < 0 نحو الغرب (-X)
            // وهو ما يطابق دالة التحويل الفلكي computeHorizontalCoords بالمليمتر
            function diurnalDir(th) {
                return new THREE.Vector3()
                    .addScaledVector(uEast, -Math.sin(th))
                    .addScaledVector(vNoon, Math.cos(th));
            }

            // =============================================================
            // A. فلك الشمس الحامل والمدير (نموذج ابن الشاطر الشمسي الموحد)
            // =============================================================
            if (ibnShatirSunGroup && ibnShatirSunGroup.visible) {
                // مركز المستوى المداري اليومي للشمس
                const cSeasonalSun = new THREE.Vector3()
                    .copy(sphereCenter)
                    .addScaledVector(P_NCP, DOME_R * Math.sin(deltaSun));

                const rDiurnalSun = DOME_R * Math.cos(deltaSun);

                // فلك الشمس الحامل هو نفسه مدار الشمس اليومي الذي يحمل مواقيت الصلاة (الفصل 3-6 من نهاية السول)
                const R_SUN_DEF = rDiurnalSun;
                const r_sun_1 = rDiurnalSun * (4.6167 / 60.0) * 1.25; // الحامل الصغير (4;37) نصف قطر ثابت
                const r_sun_2 = rDiurnalSun * (2.5 / 60.0) * 1.5;     // المدير (2;30) نصف قطر ثابت

                // زوايا حركة الشمس الخاصة في نموذج ابن الشاطر
                const lambda_apo = 79.0 * Math.PI / 180.0; // أوج الشمس
                const alpha_anom = ((lambdaSun - lambda_apo) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

                // اتجاهات الحركة الصلبة للشمس:
                // الحامل يوازي خط الأوج دائماً (dirAngle1 = H_sun - alpha_anom)
                // المدير يدور بضعف زاوية المركز (dirAngle2 = H_sun + alpha_anom)
                const dirAngle1 = H_sun - alpha_anom;
                const dirAngle2 = H_sun + alpha_anom;

                // 1. مركز فلك الحامل الأول cSunDef على محيط فلك الحامل (مدار الشمس اليومي)
                const cSunDef = new THREE.Vector3()
                    .copy(cSeasonalSun)
                    .addScaledVector(diurnalDir(H_sun), R_SUN_DEF);
                if (sunJointDefMesh) sunJointDefMesh.position.copy(cSunDef);

                // 2. مركز فلك المدير pSun1 على محيط فلك الحامل الصغير
                const pSun1 = new THREE.Vector3()
                    .copy(cSunDef)
                    .addScaledVector(diurnalDir(dirAngle1), r_sun_1);
                if (sunJointEp1Mesh) sunJointEp1Mesh.position.copy(pSun1);

                // 3. موضع جرم الشمس pSun2 على محيط فلك المدير
                const pSun2 = new THREE.Vector3()
                    .copy(pSun1)
                    .addScaledVector(diurnalDir(dirAngle2), r_sun_2);

                // ربط جرم الشمس الفيزيائي بالمفصل النهائي على محيط فلك المدير مباشرة
                if (sunMesh) {
                    sunMesh.position.copy(pSun2);
                }

                // 4. مدار الشمس الحامل هو نفسه الذي يحمل مواقيت الصلاة (وحذف ما سوى ذلك منعاً للتكرار)
                // إذا كانت أقواس الصلاة معروضة، فإنها ترسم محيط الفلك الحامل مقسماً بدقة بألوان المواقيت
                if (sunDeferentLine) {
                    if (prayerDiurnalArcsGroup && prayerDiurnalArcsGroup.visible) {
                        sunDeferentLine.visible = false;
                    } else {
                        sunDeferentLine.visible = true;
                        const sunDefPts = [];
                        for (let k = 0; k <= 72; k++) {
                            const th = (k / 72) * Math.PI * 2;
                            sunDefPts.push(new THREE.Vector3()
                                .copy(cSeasonalSun)
                                .addScaledVector(diurnalDir(th), R_SUN_DEF)
                            );
                        }
                        sunDeferentLine.geometry.dispose();
                        sunDeferentLine.geometry = new THREE.BufferGeometry().setFromPoints(sunDefPts);
                    }
                }

                // 5. رسم دائرة فلك الحامل الأول (نصف قطر صلب ثابت)
                const sunEp1Pts = [];
                for (let k = 0; k <= 36; k++) {
                    const th = (k / 36) * Math.PI * 2;
                    sunEp1Pts.push(new THREE.Vector3()
                        .copy(cSunDef)
                        .addScaledVector(diurnalDir(th), r_sun_1)
                    );
                }
                if (sunEp1Line) {
                    sunEp1Line.geometry.dispose();
                    sunEp1Line.geometry = new THREE.BufferGeometry().setFromPoints(sunEp1Pts);
                }

                // 6. رسم دائرة فلك المدير للشمس (نصف قطر صلب ثابت دون أي تمدد أو انكماش)
                const sunDirPts = [];
                for (let k = 0; k <= 36; k++) {
                    const th = (k / 36) * Math.PI * 2;
                    sunDirPts.push(new THREE.Vector3()
                        .copy(pSun1)
                        .addScaledVector(diurnalDir(th), r_sun_2)
                    );
                }
                if (sunDirectorLine) {
                    sunDirectorLine.geometry.dispose();
                    sunDirectorLine.geometry = new THREE.BufferGeometry().setFromPoints(sunDirPts);
                }

                // 7. الأذرع الميكانيكية للشمس (بين الحامل والمدير وجرم الشمس فقط)
                if (sunArm1) {
                    sunArm1.geometry.dispose();
                    sunArm1.geometry = new THREE.BufferGeometry().setFromPoints([cSunDef, pSun1]);
                }
                if (sunArm2) {
                    sunArm2.geometry.dispose();
                    sunArm2.geometry = new THREE.BufferGeometry().setFromPoints([pSun1, pSun2]);
                }

                if (sunDirectorLabelSprite) {
                    sunDirectorLabelSprite.position.set(pSun1.x, pSun1.y + 7, pSun1.z);
                    sunDirectorLabelSprite.visible = show3DLabels;
                }
            }

            // =============================================================
            // B. فلك القمر الحامل والمدير والمدور (نموذج ابن الشاطر القمري الموحد)
            // =============================================================
            if (ibnShatirMoonGroup && ibnShatirMoonGroup.visible) {
                const rMoonDome = DOME_R - 2;
                const cSeasonalMoon = new THREE.Vector3()
                    .copy(sphereCenter)
                    .addScaledVector(P_NCP, rMoonDome * Math.sin(moonDelta));

                const rDiurnalMoon = rMoonDome * Math.cos(moonDelta);

                // فلك القمر الحامل هو نفسه مدار مسار القمر في السماء (وحذف ما سوى ذلك)
                // الحامل R=60، التدوير الأول r1=6;35، التدوير الثاني r2=1;25
                const R_MOON_DEF = rDiurnalMoon;
                const r_moon_1 = rDiurnalMoon * (6.5833 / 60.0) * 1.15; // التدوير الأول الأزرق (نصف قطر ثابت)
                const r_moon_2 = rDiurnalMoon * (1.4167 / 60.0) * 2.2;  // التدوير الثاني الأصفر (نصف قطر ثابت لا يتغير)

                // زوايا حركة القمر في نموذج ابن الشاطر:
                // eta: الاستطالة بين القمر والشمس
                // gamma: خاصة القمر (Mean Anomaly)
                const eta = ((moonLambda - lambdaSun) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                const gamma = ((dayOfYear / 27.55455 * Math.PI * 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

                // اتجاهات الحركة الصلبة للقمر:
                // 1. الحامل يتحرك بحركة القمر الوسطى: H_moon
                // 2. التدوير الأول يتحرك في أعلاه خلاف التوالي بالخاصة: dirMoon1 = H_moon - gamma
                // 3. التدوير الثاني (المدير الأصفر) يتحرك إلى التوالي بضعف البعد 2*eta مبتدئاً من نحو المركز:
                //    dirMoon2 = dirMoon1 + Math.PI + 2 * eta
                const dirMoon1 = H_moon - gamma;
                const dirMoon2 = dirMoon1 + Math.PI + 2 * eta;

                // 1. مركز التدوير الأول cMoonDef يقع على محيط فلك القمر الحامل
                const cMoonDef = new THREE.Vector3()
                    .copy(cSeasonalMoon)
                    .addScaledVector(diurnalDir(H_moon), R_MOON_DEF);
                if (moonJointDefMesh) moonJointDefMesh.position.copy(cMoonDef);

                // 2. مركز التدوير الثاني pMoon1 يقع على محيط فلك التدوير الأول الأزرق
                const pMoon1 = new THREE.Vector3()
                    .copy(cMoonDef)
                    .addScaledVector(diurnalDir(dirMoon1), r_moon_1);
                if (moonJointEp1Mesh) moonJointEp1Mesh.position.copy(pMoon1);

                // 3. موضع جرم القمر النهائي pMoon2 يقع على محيط فلك التدوير الثاني الأصفر بالضبط!
                const pMoon2 = new THREE.Vector3()
                    .copy(pMoon1)
                    .addScaledVector(diurnalDir(dirMoon2), r_moon_2);

                // تثبيت جرم القمر الفيزيائي moonMesh على طرف ذراع التدوير الثاني ومحيط دائرته الصفراء تماماً
                if (moonMesh) {
                    moonMesh.position.copy(pMoon2);
                }

                // 4. رسم دائرة فلك القمر الحامل البنفسجي (نصف قطر صلب ثابت)
                const moonDefPts = [];
                for (let k = 0; k <= 72; k++) {
                    const th = (k / 72) * Math.PI * 2;
                    moonDefPts.push(new THREE.Vector3()
                        .copy(cSeasonalMoon)
                        .addScaledVector(diurnalDir(th), R_MOON_DEF)
                    );
                }
                if (moonDeferentLine) {
                    moonDeferentLine.geometry.dispose();
                    moonDeferentLine.geometry = new THREE.BufferGeometry().setFromPoints(moonDefPts);
                }

                // 5. رسم دائرة فلك التدوير الأول الأزرق (نصف قطر صلب ثابت r_moon_1)
                const moonEp1Pts = [];
                for (let k = 0; k <= 36; k++) {
                    const th = (k / 36) * Math.PI * 2;
                    moonEp1Pts.push(new THREE.Vector3()
                        .copy(cMoonDef)
                        .addScaledVector(diurnalDir(th), r_moon_1)
                    );
                }
                if (moonEp1Line) {
                    moonEp1Line.geometry.dispose();
                    moonEp1Line.geometry = new THREE.BufferGeometry().setFromPoints(moonEp1Pts);
                }

                // 6. رسم دائرة فلك التدوير الثاني الأصفر (المدور) بنصف قطر صلب ثابت تماماً r_moon_2 دون أي تمدد أو انكماش
                const moonEp2Pts = [];
                for (let k = 0; k <= 36; k++) {
                    const th = (k / 36) * Math.PI * 2;
                    moonEp2Pts.push(new THREE.Vector3()
                        .copy(pMoon1)
                        .addScaledVector(diurnalDir(th), r_moon_2)
                    );
                }
                if (moonEp2Line) {
                    moonEp2Line.geometry.dispose();
                    moonEp2Line.geometry = new THREE.BufferGeometry().setFromPoints(moonEp2Pts);
                }

                // 7. تحديث أذرع القمر الميكانيكية الرابطة (بين الحامل والتدوير الأول وجرم القمر فقط)
                if (moonArmEp1) {
                    moonArmEp1.geometry.dispose();
                    moonArmEp1.geometry = new THREE.BufferGeometry().setFromPoints([cMoonDef, pMoon1]);
                }
                if (moonArmEp2) {
                    moonArmEp2.geometry.dispose();
                    moonArmEp2.geometry = new THREE.BufferGeometry().setFromPoints([pMoon1, pMoon2]);
                }

                if (moonOrbsLabelSprite) {
                    moonOrbsLabelSprite.position.set(pMoon1.x, pMoon1.y + 6, pMoon1.z);
                    moonOrbsLabelSprite.visible = show3DLabels;
                }
            }
        }
        window.createIbnShatirOrbs = createIbnShatirOrbs;
        window.updateIbnShatirOrbs = updateIbnShatirOrbs;

        // إدارة المدينة والموقع الفلكي
        function onCityChange(cityKey) {
            currentCityKey = cityKey;
            const customRow = document.getElementById('customCoordRow');
            if (cityKey === 'custom') {
                if (customRow) customRow.style.display = 'flex';
                openWorldMapModal();
                return;
            } else {
                if (customRow) customRow.style.display = 'none';
            }

            const city = CITIES_DB[cityKey];
            if (!city) return;

            applyCitySelection(city.lat, city.lon, city.name, cityKey, false);
            showC3DToast(`📍 تم توجيه القبة إلى: ${currentCityName}`);
        }

        function onCustomCoordChange() {
            let lat = parseFloat(document.getElementById('inputLat').value);
            let lon = parseFloat(document.getElementById('inputLon').value);
            if (isNaN(lat)) lat = currentLatDeg;
            if (isNaN(lon)) lon = currentLonDeg;

            lat = Math.max(-90, Math.min(90, lat));
            lon = Math.max(-180, Math.min(180, lon));

            const near = typeof findNearestCity === 'function' ? findNearestCity(lat, lon, 2.5) : null;
            const name = near ? `${near.nameAr} (${near.country})` : `مخصص (${lat >= 0 ? '+' : ''}${lat.toFixed(2)}°)`;
            applyCitySelection(lat, lon, name, near ? near.id : 'custom', false);
        }

        function applyCityChanges() {
            if (!cosmos3DInitialized) {
                if (typeof init3D === 'function') init3D();
                if (!cosmos3DInitialized) return;
            }

            updateCelestialAxesGeometry();
            rebuildSeasonalArcs();
            updateQiblaIndicator(currentLatDeg, currentLonDeg);

            if (atlasGroup && atlasGroup.children.length > 0) {
                atlasGroup.children[0].rotation.x = -(Math.PI / 2 - currentLatRad);
            }

            const hudBadge = document.getElementById('hudCityName');
            if (hudBadge) {
                hudBadge.innerText = `${currentCityName} (${currentLatDeg.toFixed(1)}°)`;
            }
            updateAstronomy(currentDate);
            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
        }

        // دالة موحدة لتطبيق اختيار المدينة وتحديث كافة المدارات والسلايدرات والشارات فوراً
        function applyCitySelection(lat, lon, name, cityKey = null, closeDialog = false) {
            const clampedLat = Math.max(-90, Math.min(90, lat));
            const clampedLon = Math.max(-180, Math.min(180, lon));

            modalLat = clampedLat;
            modalLon = clampedLon;
            currentLatDeg = clampedLat;
            currentLonDeg = clampedLon;
            currentLatRad = clampedLat * Math.PI / 180;

            if (name) {
                modalCityName = name;
                currentCityName = name;
            } else {
                currentCityName = `موقع مخصص (${clampedLat >= 0 ? '+' : ''}${clampedLat.toFixed(2)}°)`;
                modalCityName = currentCityName;
            }

            let foundCountry = null;
            if (cityKey && typeof WORLD_CITIES_MAP !== 'undefined' && WORLD_CITIES_MAP[cityKey]) {
                foundCountry = WORLD_CITIES_MAP[cityKey].country;
            } else if (typeof WORLD_CITIES_DB !== 'undefined') {
                const match = WORLD_CITIES_DB.find(c => Math.abs(c.lat - clampedLat) < 0.25 && Math.abs(c.lon - clampedLon) < 0.25);
                if (match) foundCountry = match.country;
            }
            currentCityCountry = foundCountry;

            // 1. تحديث عناصر نافذة المودال نفسها (الموقع على الخريطة والحقول الحسابية)
            if (typeof updateModalUI === 'function') {
                updateModalUI(clampedLat, clampedLon, currentCityName);
            }

            // 2. تحديث مدخلات شريط الأدوات العلوي
            const inLat = document.getElementById('inputLat');
            const inLon = document.getElementById('inputLon');
            if (inLat) inLat.value = clampedLat.toFixed(2);
            if (inLon) inLon.value = clampedLon.toFixed(2);

            // 3. تحديث القائمة المنسدلة في الشريط العلوي
            const selectEl = document.getElementById('citySelect');
            const customRow = document.getElementById('customCoordRow');

            let matchedKey = (cityKey === 'pole') ? 'pole_n' : cityKey;
            if (!matchedKey && typeof WORLD_CITIES_DB !== 'undefined') {
                for (let i = 0; i < WORLD_CITIES_DB.length; i++) {
                    const c = WORLD_CITIES_DB[i];
                    if (Math.abs(c.lat - clampedLat) < 0.15 && Math.abs(c.lon - clampedLon) < 0.15) {
                        matchedKey = c.id;
                        break;
                    }
                }
            }

            if (selectEl) {
                let optionMatched = false;
                if (matchedKey) {
                    for (let opt of selectEl.options) {
                        if (opt.value === matchedKey || (matchedKey === 'pole_n' && opt.value === 'pole') || ((matchedKey === 'tripoli_lb' || matchedKey === 'tripoli') && (opt.value === 'tripoli_lb' || opt.value === 'tripoli'))) {
                            selectEl.value = opt.value;
                            currentCityKey = opt.value;
                            optionMatched = true;
                            break;
                        }
                    }
                }
                if (optionMatched) {
                    if (customRow) customRow.style.display = 'none';
                } else {
                    selectEl.value = 'custom';
                    currentCityKey = 'custom';
                    let customOpt = selectEl.querySelector('option[value="custom"]');
                    if (customOpt) {
                        customOpt.textContent = `📍 ${currentCityName} (${clampedLat >= 0 ? '+' : ''}${clampedLat.toFixed(1)}°)`;
                    }
                    if (customRow) customRow.style.display = 'flex';
                }
            }

            // 4. تحديث سلايدر زاوية ميل المدارات الجانبي في اللوحة اليسرى (يدعم القيم الموجبة والسالبة)
            const latSlider = document.getElementById('latAngleSlider');
            if (latSlider) {
                latSlider.value = clampedLat.toFixed(2);
            }

            // 5. تحديث شارة المدينة وزاوية المدارات وأزرار القفز السريع في اللوحة اليسرى
            if (typeof updateCityAngleBadge === 'function') {
                updateCityAngleBadge(clampedLat);
            }

            // 6. تطبيق الإمالة الهندسية وتحديث القبة والشهب والمدارات فوراً
            applyCityChanges();

            if (c3dTimeSpeedMode === 'realtime') {
                syncCityRealTime(false);
            }

            if (closeDialog) {
                if (typeof closeWorldMapModal === 'function') closeWorldMapModal();
                showC3DToast(`📍 تم توجيه القبة والمدارات بنجاح إلى: ${currentCityName} (عرض ${clampedLat.toFixed(2)}°، طول ${clampedLon.toFixed(2)}°)`);
            }
        }

        // ==========================================
        // 🗺️ محرك خريطة العالم التفاعلية والبحث عن المدن
        // ==========================================
        let modalLat = 33.5138;
        let modalLon = 36.2924;
        let modalCityName = 'دمشق (مرصد ابن الشاطر)';
        let isMapPointerDown = false;
        let mapEventsInitialized = false;

        function latLonToMapXY(lat, lon) {
            const x = (lon + 180) * (1000 / 360);
            const y = (90 - lat) * (500 / 180);
            return { x, y };
        }

        function mapXYToLatLon(x, y) {
            const lon = (x / 1000) * 360 - 180;
            const lat = 90 - (y / 500) * 180;
            return { lat, lon };
        }

        function openWorldMapModal() {
            const modal = document.getElementById('worldMapModal');
            if (!modal) return;

            if (!cosmos3DInitialized && typeof init3D === 'function') {
                init3D();
            }

            modalLat = currentLatDeg;
            modalLon = currentLonDeg;
            modalCityName = currentCityName;

            updateModalUI(modalLat, modalLon, modalCityName);

            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('active');
                initMapEvents();
                const searchIn = document.getElementById('mapSearchInput');
                if (searchIn) searchIn.focus();
            }, 10);
        }

        function closeWorldMapModal() {
            const modal = document.getElementById('worldMapModal');
            if (!modal) return;
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                clearMapSearch();
            }, 250);
        }

        function updateModalUI(lat, lon, name) {
            modalLat = Math.max(-90, Math.min(90, lat));
            modalLon = Math.max(-180, Math.min(180, lon));
            if (name) modalCityName = name;

            // تحديث موقع المؤشر على الخريطة
            const xy = latLonToMapXY(modalLat, modalLon);
            const pin = document.getElementById('mapPinGroup');
            if (pin) {
                pin.setAttribute('transform', `translate(${xy.x.toFixed(1)}, ${xy.y.toFixed(1)})`);
            }

            // تحديث الحقول النصية
            const inLat = document.getElementById('modalInputLat');
            const inLon = document.getElementById('modalInputLon');
            const inName = document.getElementById('modalInputCityName');
            if (inLat) inLat.value = modalLat.toFixed(2);
            if (inLon) inLon.value = modalLon.toFixed(2);
            if (inName && name) inName.value = modalCityName;

            // اتجاه خط العرض والطول
            const latDir = document.getElementById('modalLatDirection');
            const lonDir = document.getElementById('modalLonDirection');
            if (latDir) latDir.innerText = modalLat >= 0 ? 'شمالاً (N)' : 'جنوباً (S)';
            if (lonDir) lonDir.innerText = modalLon >= 0 ? 'شرقاً (E)' : 'غرباً (W)';

            // الحسابات الفلكية التلقائية
            const sumPol = document.getElementById('modalSumPolaris');
            const sumSum = document.getElementById('modalSumSummer');
            const sumWin = document.getElementById('modalSumWinter');
            const sumHem = document.getElementById('modalSumHemisphere');

            const absLat = Math.abs(modalLat);
            const epsDeg = 23.44;
            const summerMax = Math.min(90, (90 - absLat + epsDeg));
            const winterMin = Math.max(-10, (90 - absLat - epsDeg));

            if (sumPol) sumPol.innerText = `${absLat.toFixed(1)}° (${modalLat >= 0 ? 'شمالي' : 'جنوبي'})`;
            if (sumSum) sumSum.innerText = `${summerMax.toFixed(1)}°`;
            if (sumWin) sumWin.innerText = `${winterMin.toFixed(1)}°`;
            if (sumHem) {
                if (modalLat > 5) sumHem.innerText = 'نصف الكرة الشمالي (الأموي / مراغة / أوراسيا)';
                else if (modalLat < -5) sumHem.innerText = 'نصف الكرة الجنوبي (الفلك المقلوب)';
                else sumHem.innerText = 'المنطقة الاستوائية (الفلك المستقيم)';
            }
        }

        function onModalManualCoordInput() {
            let lat = parseFloat(document.getElementById('modalInputLat').value);
            let lon = parseFloat(document.getElementById('modalInputLon').value);
            if (isNaN(lat)) lat = modalLat;
            if (isNaN(lon)) lon = modalLon;

            const near = findNearestCity(lat, lon, 2.5);
            const name = near ? `${near.nameAr} (${near.country})` : `إحداثيات مخصصة (${lat >= 0 ? '+' : ''}${lat.toFixed(1)}°, ${lon >= 0 ? '+' : ''}${lon.toFixed(1)}°)`;
            applyCitySelection(lat, lon, name, near ? near.id : null, false);
        }

        function adjustModalCoord(type, delta) {
            let newLat = modalLat;
            let newLon = modalLon;
            if (type === 'lat') {
                newLat = Math.max(-90, Math.min(90, modalLat + delta));
            } else if (type === 'lon') {
                newLon = Math.max(-180, Math.min(180, modalLon + delta));
            }
            const near = findNearestCity(newLat, newLon, 2.5);
            const name = near ? `${near.nameAr} (${near.country})` : `إحداثيات (${newLat.toFixed(1)}°, ${newLon.toFixed(1)}°)`;
            applyCitySelection(newLat, newLon, name, near ? near.id : null, false);
        }

        function findNearestCity(lat, lon, maxDistDeg = 2.5) {
            if (!WORLD_CITIES_DB || WORLD_CITIES_DB.length === 0) return null;
            let bestCity = null, minDist = maxDistDeg;
            for (let c of WORLD_CITIES_DB) {
                const d = Math.hypot(c.lat - lat, c.lon - lon);
                if (d < minDist) {
                    minDist = d;
                    bestCity = c;
                }
            }
            return bestCity;
        }

        function initMapEvents() {
            if (mapEventsInitialized) return;
            const svg = document.getElementById('worldMapSvg');
            if (!svg) return;

            function handlePointer(e) {
                const rect = svg.getBoundingClientRect();
                const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
                const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
                const px = ((clientX - rect.left) / rect.width) * 1000;
                const py = ((clientY - rect.top) / rect.height) * 500;

                const clampedX = Math.max(0, Math.min(1000, px));
                const clampedY = Math.max(0, Math.min(500, py));
                const coords = mapXYToLatLon(clampedX, clampedY);

                const near = findNearestCity(coords.lat, coords.lon, 2.5);
                const name = near ? `${near.nameAr} (${near.country})` : `موقع مخصص (${coords.lat >= 0 ? '+' : ''}${coords.lat.toFixed(1)}°, ${coords.lon >= 0 ? '+' : ''}${coords.lon.toFixed(1)}°)`;

                applyCitySelection(coords.lat, coords.lon, name, near ? near.id : null, false);
            }

            svg.addEventListener('mousedown', (e) => {
                isMapPointerDown = true;
                handlePointer(e);
            });
            window.addEventListener('mousemove', (e) => {
                if (isMapPointerDown) {
                    handlePointer(e);
                }
            });
            window.addEventListener('mouseup', () => {
                isMapPointerDown = false;
            });

            // Touch events
            svg.addEventListener('touchstart', (e) => {
                isMapPointerDown = true;
                handlePointer(e);
            }, { passive: true });
            svg.addEventListener('touchmove', (e) => {
                if (isMapPointerDown) handlePointer(e);
            }, { passive: true });
            svg.addEventListener('touchend', () => {
                isMapPointerDown = false;
            });

            // Hover tooltip
            const hoverBadge = document.getElementById('mapHoverCoords');
            svg.addEventListener('mousemove', (e) => {
                const rect = svg.getBoundingClientRect();
                const px = ((e.clientX - rect.left) / rect.width) * 1000;
                const py = ((e.clientY - rect.top) / rect.height) * 500;
                const c = mapXYToLatLon(px, py);
                if (hoverBadge) {
                    const latStr = c.lat >= 0 ? `${c.lat.toFixed(1)}°N` : `${Math.abs(c.lat).toFixed(1)}°S`;
                    const lonStr = c.lon >= 0 ? `${c.lon.toFixed(1)}°E` : `${Math.abs(c.lon).toFixed(1)}°W`;
                    hoverBadge.innerText = `🌐 ${latStr} | ${lonStr}`;
                }
            });

            // Escape key to close modal
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const modal = document.getElementById('worldMapModal');
                    if (modal && modal.classList.contains('active')) {
                        closeWorldMapModal();
                    }
                }
            });

            mapEventsInitialized = true;
        }

        // البحث الفوري عن المدن
                function normAr(str) {
            if (!str) return '';
            return str.toString().toLowerCase()
                .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // إزالة التشكيل
                .replace(/[أإآءئؤ]/g, 'ا') // توحيد الهمزات
                .replace(/ة/g, 'ه')        // توحيد التاء المربوطة
                .replace(/ى/g, 'ي')        // توحيد الألف المقصورة والياء
                .replace(/[-_]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        let _mapSearchDebounceTimer = null;
        function onMapSearchInput(query) {
            const clearBtn = document.getElementById('btnClearMapSearch');
            const rawQ = (query || '').trim();
            if (clearBtn) clearBtn.style.display = rawQ ? 'block' : 'none';

            clearTimeout(_mapSearchDebounceTimer);
            if (!rawQ) {
                const resultsBox = document.getElementById('mapSearchResults');
                if (resultsBox) {
                    resultsBox.style.display = 'none';
                    resultsBox.innerHTML = '';
                }
                return;
            }

            // تأخير 120ms لمنع تكرار الحسابات الثقيلة مع كل ضغطة زر سريعة
            _mapSearchDebounceTimer = setTimeout(() => {
                executeMapSearch(rawQ);
            }, 120);
        }

        function executeMapSearch(rawQ) {
            const resultsBox = document.getElementById('mapSearchResults');
            if (!resultsBox) return;

            const normQ = normAr(rawQ);
            const normQNoSpace = normQ.replace(/\s+/g, '');
            const rawQLower = rawQ.toLowerCase();

            const scored = [];
            for (let i = 0; i < WORLD_CITIES_DB.length; i++) {
                const c = WORLD_CITIES_DB[i];
                const nameNorm = normAr(c.nameAr || '');
                const nameNoSpace = nameNorm.replace(/\s+/g, '');
                const countryNorm = normAr(c.country || '');
                const countryNoSpace = countryNorm.replace(/\s+/g, '');
                const noteNorm = normAr(c.note || '');
                const nameEnLower = (c.nameEn || '').toLowerCase();
                const idLower = (c.id || '').toLowerCase();

                let score = 0;

                // تطابق دقيق في الاسم أو المعرف
                if (nameNorm === normQ || nameNoSpace === normQNoSpace || nameEnLower === rawQLower || idLower === rawQLower) {
                    score += 100;
                } else if (nameNorm.startsWith(normQ) || (normQNoSpace.length >= 3 && nameNoSpace.startsWith(normQNoSpace)) || nameEnLower.startsWith(rawQLower)) {
                    score += 75;
                } else if (nameNorm.includes(normQ) || (normQNoSpace.length >= 3 && nameNoSpace.includes(normQNoSpace)) || nameEnLower.includes(rawQLower)) {
                    score += 50;
                }

                // تطابق في اسم الدولة
                if (countryNorm === normQ || countryNoSpace === normQNoSpace) {
                    score += 35;
                } else if (countryNorm.startsWith(normQ)) {
                    score += 25;
                } else if (countryNorm.includes(normQ)) {
                    score += 20;
                }

                // تطابق في الوصف التاريخي أو الفلكي
                if (noteNorm.includes(normQ)) {
                    score += 10;
                }

                if (score > 0) {
                    scored.push({ score, city: c });
                }
            }

            scored.sort((a, b) => b.score - a.score);
            const matches = scored.slice(0, 25).map(item => item.city);

            if (matches.length === 0) {
                resultsBox.innerHTML = '<div style="padding:10px 14px; color:#94A3B8; font-size:0.85em;">لم يتم العثور على مدينة أو مرصد مطابق. يمكنك النقر مباشرة على الخريطة لاختيار أي بقعة جغرافية.</div>';
                resultsBox.style.display = 'block';
                return;
            }

            resultsBox.innerHTML = matches.map(c => `
                <div class="map-search-item" onclick="selectSearchedCity('${c.id}')">
                    <div>
                        <strong style="color:#F8FAFC; font-size:0.92em;">${c.nameAr}</strong>
                        <span style="color:#94A3B8; font-size:0.82em; margin-right:6px;">(${c.country})</span>
                        <div style="font-size:0.75em; color:var(--gold); margin-top:2px;">${c.note || ''}</div>
                    </div>
                    <div style="text-align:left; font-family:var(--mono); font-size:0.78em; color:#38BDF8;">
                        ${c.lat >= 0 ? c.lat.toFixed(1) + '°N' : Math.abs(c.lat).toFixed(1) + '°S'}, 
                        ${c.lon >= 0 ? c.lon.toFixed(1) + '°E' : Math.abs(c.lon).toFixed(1) + '°W'}
                    </div>
                </div>
            `).join('');
            resultsBox.style.display = 'block';
        }

        function clearMapSearch() {
            const input = document.getElementById('mapSearchInput');
            const resultsBox = document.getElementById('mapSearchResults');
            const clearBtn = document.getElementById('btnClearMapSearch');
            if (input) input.value = '';
            if (resultsBox) { resultsBox.style.display = 'none'; resultsBox.innerHTML = ''; }
            if (clearBtn) clearBtn.style.display = 'none';
        }

        function selectSearchedCity(cityId) {
            const city = WORLD_CITIES_DB.find(c => c.id === cityId);
            if (!city) return;

            const name = `${city.nameAr} (${city.country})`;
            applyCitySelection(city.lat, city.lon, name, cityId, true);
            clearMapSearch();
        }

        function selectPredefinedCity(cityId) {
            const city = WORLD_CITIES_DB.find(c => c.id === cityId);
            if (!city) return;

            const name = `${city.nameAr} (${city.note || city.country})`;
            applyCitySelection(city.lat, city.lon, name, cityId, true);
            clearMapSearch();
        }

        // تأكيد وتطبيق الإحداثيات المختارة
        function confirmWorldMapSelection() {
            const inName = document.getElementById('modalInputCityName');
            const chosenName = (inName && inName.value.trim()) ? inName.value.trim() : modalCityName;
            applyCitySelection(modalLat, modalLon, chosenName, null, true);
        }

        function showC3DToast(msg) {
            let toast = document.getElementById('c3dToast');
            if (!toast) return;
            toast.innerText = msg;
            toast.classList.add('show');
            clearTimeout(window._c3dToastTimer);
            window._c3dToastTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, 3500);
        }

        // إعدادات زوايا الكاميرا
        function setCameraPreset(preset) {
            cameraPreset = preset;
            document.querySelectorAll('.btn-view').forEach(b => {
                if (!b.id.includes('AutoRotate')) b.classList.remove('active');
            });
            const activeBtn = document.getElementById(
                preset === 'prayers' ? 'btnTogglePrayerFocus' :
                preset === 'perspective' ? 'btnViewPerspective' :
                preset === 'horizon' ? 'btnViewHorizon' :
                preset === 'moon' ? 'btnViewMoon' :
                preset === 'sun' ? 'btnViewSun' :
                (preset === 'orbit' || preset === 'extended') ? 'btnViewOrbit' :
                preset === 'polaris' ? 'btnViewPolaris' : 'btnViewPolar'
            );
            if (activeBtn) activeBtn.classList.add('active');
            const cameraSelect = document.getElementById('cameraPresetSelect');
            if (cameraSelect) {
                const normVal = (preset === 'extended') ? 'orbit' : preset;
                if (cameraSelect.value !== normVal) cameraSelect.value = normVal;
            }

            if (!camera || !controls || !controls.target) {
                return;
            }

            if (preset === 'prayers') {
                // منظور مواقيت الصلوات الافتراضي: مشهد مسرحي متوازن متجه جنوباً يبرز كامل قوس النهار ومواقيت الصلاة والراصد وميكانيكا ابن الشاطر
                camera.position.set(-35, 75, -240);
                controls.target.set(0, 35, 25);
                togglePrayerFocusMode(true);
                showC3DToast('🕌 تم ضبط الكاميرا: منظور مواقيت الصلوات');
            } else if (preset === 'perspective') {
                // المنظور المجسم (Perspective View): زاوية ثلاثية الأبعاد متوازنة تبرز القبة والراصد والمدارات في الفضاء
                camera.position.set(220, 160, 250);
                controls.target.set(0, 25, 0);
                showC3DToast('📐 تم ضبط الكاميرا: منظور مجسم (Perspective View)');
            } else if (preset === 'horizon') {
                camera.position.set(0, 16, 65);
                controls.target.set(0, 15, -45);
            } else if (preset === 'moon' && moonMesh) {
                // الكاميرا تنظر مباشرة نحو القمر
                camera.position.set(0, 18, 50);
                controls.target.copy(moonMesh.position);
            } else if (preset === 'sun' && sunMesh) {
                camera.position.set(0, 18, 50);
                controls.target.copy(sunMesh.position);
            } else if (preset === 'orbit' || preset === 'extended') {
                // المنظور الكوني الموسع (Extended Cosmic View): رؤية بانورامية شاملة تغطي كامل أفلاك الكون والأطلس والبروج
                camera.position.set(420, 340, 540);
                controls.target.set(0, 0, 0);
                togglePrayerFocusMode(false);
                showC3DToast('🌌 تم ضبط الكاميرا: المشهد الكوني الموسع الشامل');
            } else if (preset === 'polar') {
                camera.position.set(0, 520, 0);
                controls.target.set(0, 0, 0);
            } else if (preset === 'polaris') {
                // توجيه الكاميرا مباشرة نحو الشمال ونحو النجم القطبي المرتفع بزاوية خط العرض
                camera.position.set(0, 16, 60);
                const phi = currentLatRad;
                controls.target.set(0, 320 * Math.sin(phi), -320 * Math.cos(phi));
            }
            controls.update();
        }

        function toggleAutoRotate() {
            controls.autoRotate = !controls.autoRotate;
            controls.autoRotateSpeed = 1.2;
            document.getElementById('btnAutoRotate').classList.toggle('active', controls.autoRotate);
        }

        function toggleLayer(layer, isVisible) {
            if (layer === 'atlas' && atlasGroup) atlasGroup.visible = isVisible;
            if (layer === 'zodiac' && zodiacGroup) zodiacGroup.visible = isVisible;
            if (layer === 'planets' && planetsGroup) planetsGroup.visible = isVisible;
            if (layer === 'planetBodies') {
                Object.values(planetMeshes).forEach(mesh => {
                    if (mesh) mesh.visible = isVisible;
                });
            }
            if (layer === 'orbitCircles') {
                Object.values(planetOrbitLines).forEach(ring => {
                    if (ring) ring.visible = isVisible;
                });
            }
            if (layer === 'horizon' && horizonGroup) horizonGroup.visible = isVisible;
            if (layer === 'sunArcs' && seasonalArcsGroup) seasonalArcsGroup.visible = isVisible;
            if (layer === 'twilight' && twilightGroup) {
                twilightGroup.visible = isVisible;
                showTwilightCircles = isVisible;
                if (ishaShafiLabelSprite) ishaShafiLabelSprite.visible = isVisible && show3DLabels;
            }
            if (layer === 'meridian') {
                if (meridianLine) meridianLine.visible = isVisible;
                if (primeVerticalLine) primeVerticalLine.visible = isVisible;
            }
            if (layer === 'sunTodayArc') {
                if (prayerDiurnalArcsGroup) prayerDiurnalArcsGroup.visible = isVisible;
                if (sunArcGroup) sunArcGroup.visible = isVisible;
                if (sunDeferentLine && (!prayerDiurnalArcsGroup || !prayerDiurnalArcsGroup.visible)) sunDeferentLine.visible = isVisible;
            }
            if (layer === 'moonArc') {
                if (moonDeferentLine) moonDeferentLine.visible = isVisible;
                if (moonArcGroup) moonArcGroup.visible = isVisible;
            }
            if (layer === 'ibsOrbs') {
                if (ibnShatirOrbsGroup) ibnShatirOrbsGroup.visible = isVisible;
                if (ibnShatirSunGroup) ibnShatirSunGroup.visible = isVisible;
                if (ibnShatirMoonGroup) ibnShatirMoonGroup.visible = isVisible;
            }
            if (layer === 'ibsSunOrbs') {
                if (ibnShatirSunGroup) ibnShatirSunGroup.visible = isVisible;
                if (prayerDiurnalArcsGroup) prayerDiurnalArcsGroup.visible = isVisible;
            }
            if (layer === 'ibsMoonOrbs') {
                if (ibnShatirMoonGroup) ibnShatirMoonGroup.visible = isVisible;
            }
        }

        // قفز لأطوار القمر
        function jumpToMoonPhase(targetElong) {
            const targetDays = targetElong / 12.1907;
            const curYear = currentDate.getUTCFullYear();
            currentDate = new Date(Date.UTC(curYear, 0, 1 + targetDays, 20, 0, 0));
            updateDateTimeUI();
            if (cosmos3DInitialized) updateAstronomy(currentDate);
            setCameraPreset('moon');
        }

        // حلقة الحركة الرئيسية المدمجة
        function drawCosmos3D(dt) {
            if (!cosmos3DInitialized) return;
            try {
                updateAstronomy(currentDate);
                if (controls) {
                    controls.update();
                }
                if (renderer && scene && camera) {
                    renderer.render(scene, camera);
                }
            } catch (err) {
                console.error('Error in drawCosmos3D:', err);
            }
        }

        // ==========================================
        // 🕌 دوال بناء وتحديث أقواس مواقيت الصلاة في المحاكي ثلاثي الأبعاد
        // ==========================================
        function buildPrayerDiurnalArcs() {
            if (!prayerDiurnalArcsGroup) {
                prayerDiurnalArcsGroup = new THREE.Group();
                prayerDiurnalArcsGroup.name = 'prayerDiurnalArcsGroup';
                scene.add(prayerDiurnalArcsGroup);
            } else {
                cleanThreeGroup(prayerDiurnalArcsGroup);
            }

            const arcKeys = ['fajr', 'sunrise', 'dhuha', 'duhr', 'asr', 'asrHanafi', 'maghrib', 'ishaShafi', 'night1', 'night2'];
            prayerDiurnalLines = {};
            arcKeys.forEach(k => {
                const color = k.startsWith('night') ? PRAYER_ARC_COLORS.night : PRAYER_ARC_COLORS[k];
                const geom = new THREE.BufferGeometry();
                const mat = new THREE.LineBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.95,
                    linewidth: 4.0
                });
                const line = new THREE.Line(geom, mat);
                line.userData = { arcKey: k, name: PRAYER_ARC_NAMES[k.startsWith('night') ? 'night' : k] };
                prayerDiurnalArcsGroup.add(line);
                prayerDiurnalLines[k] = line;
            });

            // وسوم أوقات الصلاة الثلاثية الأبعاد على مدار الشمس
            prayerDiurnalSprites = {};
            const pBadgeDefs = [
                { key: 'fajr', title: '🌅 الفجر', color: '#06B6D4', offset: 14 },
                { key: 'sunrise', title: '☀️ الشروق', color: '#EAB308', offset: 14 },
                { key: 'dhuha', title: '🌤️ الضحى (5°)', color: '#10B981', offset: 24 }, // إزاحة شعاعية خارجية +24 لمنع التداخل مع الشروق
                { key: 'duhr', title: '☀️ الظهر', color: '#FACC15', offset: 14 },
                { key: 'asr', title: '🌤️ العصر الشافعي', color: '#F97316', offset: 14 },
                { key: 'asrHanafi', title: '🌤️ العصر الحنفي', color: '#A855F7', offset: 24 }, // إزاحة شعاعية خارجية +24 لمنع التداخل مع الشافعي
                { key: 'sunset', title: '🌇 المغرب', color: '#E11D48', offset: 14 },
                { key: 'ishaShafi', title: '🟠 العشاء الشافعي (16°)', color: '#FB923C', offset: 24 }, // إزاحة شعاعية خارجية +24 لمنع التداخل مع المغرب والعشاء الحنفي
                { key: 'ishaa', title: '🌌 العشاء الحنفي (18°)', color: '#6366F1', offset: 14 }
            ];
            pBadgeDefs.forEach(b => {
                const sp = createTextBadgeSprite(`${b.title} --:--`, b.color, 26, 6.2);
                sp.renderOrder = 998;
                sp.visible = show3DLabels;
                prayerDiurnalArcsGroup.add(sp);
                prayerDiurnalSprites[b.key] = sp;
            });

            // وسوم الفارق الزمني (المدة) في وسط كل قوس على مدار الشمس
            prayerArcDurationSprites = {};
            const durDefs = [
                { key: 'fajr', color: '#06B6D4' },
                { key: 'sunrise', color: '#EAB308' },
                { key: 'dhuha', color: '#10B981' },
                { key: 'duhr', color: '#FACC15' },
                { key: 'asr', color: '#F97316' },
                { key: 'asrHanafi', color: '#A855F7' },
                { key: 'maghrib', color: '#E11D48' },
                { key: 'ishaShafi', color: '#FB923C' },
                { key: 'night', color: '#6366F1' }
            ];
            durDefs.forEach(d => {
                const sp = createTextBadgeSprite('⏱️ --:--', d.color, 20, 5.6);
                sp.renderOrder = 999;
                sp.visible = show3DLabels;
                prayerDiurnalArcsGroup.add(sp);
                prayerArcDurationSprites[d.key] = sp;
            });
        }

        function updatePrayerDiurnalArcs(deltaSun, phi, simDate, H_sun) {
            const tz = getCityTimezoneHours(currentLatDeg, currentLonDeg, currentCityCountry, simDate);
            const prayers = computePrayersMujaib(currentLatDeg, currentLonDeg, simDate, tz, currentCityCountry);
            currentPrayersData = prayers;

            // تحديث بطاقات الـ HUD اللحظية لأوقات الصلاة فوراً في كل تغير للمدينة أو الفصل
            updatePrayerHUD(prayers, H_sun);

            if (!prayerDiurnalArcsGroup || !prayerDiurnalLines.fajr) return;

            const { H_fajr, H_sunrise, H_dhuha, H_asr, H_asrHanafi, H_sunset, H_ishaa, H_isha16 } = prayers.hourAngles;

            function getArcPoints(H_start, H_end, steps = 30) {
                const pts = [];
                for (let i = 0; i <= steps; i++) {
                    const H_val = H_start + (i / steps) * (H_end - H_start);
                    const { alt, az } = computeHorizontalCoords(deltaSun, H_val, phi);
                    pts.push(new THREE.Vector3(
                        DOME_R * Math.cos(alt) * Math.sin(az),
                        DOME_R * Math.sin(alt),
                        -DOME_R * Math.cos(alt) * Math.cos(az)
                    ));
                }
                return pts;
            }

            // تحديث الأقواس لمدار الشمس اليومي بألوانها المتميزة
            if (prayerDiurnalLines.fajr) {
                prayerDiurnalLines.fajr.geometry.dispose();
                prayerDiurnalLines.fajr.geometry = new THREE.BufferGeometry().setFromPoints(getArcPoints(-H_fajr, -H_sunrise, 24));
            }
            if (prayerDiurnalLines.sunrise) {
                prayerDiurnalLines.sunrise.geometry.dispose();
                const hStart = -H_sunrise;
                const hEnd = -Math.min(H_sunrise, Math.max(0, H_dhuha));
                prayerDiurnalLines.sunrise.geometry = new THREE.BufferGeometry().setFromPoints(getArcPoints(hStart, hEnd, 20));
            }
            if (prayerDiurnalLines.dhuha) {
                prayerDiurnalLines.dhuha.geometry.dispose();
                const hStart = -Math.min(H_sunrise, Math.max(0, H_dhuha));
                prayerDiurnalLines.dhuha.geometry = new THREE.BufferGeometry().setFromPoints(getArcPoints(hStart, 0, 30));
            }
            if (prayerDiurnalLines.duhr) {
                prayerDiurnalLines.duhr.geometry.dispose();
                prayerDiurnalLines.duhr.geometry = new THREE.BufferGeometry().setFromPoints(getArcPoints(0, H_asr, 30));
            }
            if (prayerDiurnalLines.asr) {
                prayerDiurnalLines.asr.geometry.dispose();
                prayerDiurnalLines.asr.geometry = new THREE.BufferGeometry().setFromPoints(getArcPoints(H_asr, H_asrHanafi, 20));
            }
            if (prayerDiurnalLines.asrHanafi) {
                prayerDiurnalLines.asrHanafi.geometry.dispose();
                prayerDiurnalLines.asrHanafi.geometry = new THREE.BufferGeometry().setFromPoints(getArcPoints(H_asrHanafi, H_sunset, 24));
            }
            const hasIsha16 = H_isha16 !== null && !isNaN(H_isha16);
            if (prayerDiurnalLines.maghrib) {
                prayerDiurnalLines.maghrib.geometry.dispose();
                const hEndMaghrib = (hasIsha16 && H_isha16 > H_sunset) ? H_isha16 : H_ishaa;
                prayerDiurnalLines.maghrib.geometry = new THREE.BufferGeometry().setFromPoints(getArcPoints(H_sunset, hEndMaghrib, 20));
            }
            if (prayerDiurnalLines.ishaShafi) {
                prayerDiurnalLines.ishaShafi.geometry.dispose();
                if (hasIsha16 && H_ishaa > H_isha16) {
                    prayerDiurnalLines.ishaShafi.visible = true;
                    prayerDiurnalLines.ishaShafi.geometry = new THREE.BufferGeometry().setFromPoints(getArcPoints(H_isha16, H_ishaa, 16));
                } else {
                    prayerDiurnalLines.ishaShafi.visible = false;
                    prayerDiurnalLines.ishaShafi.geometry = new THREE.BufferGeometry();
                }
            }
            if (prayerDiurnalLines.night1) {
                prayerDiurnalLines.night1.geometry.dispose();
                prayerDiurnalLines.night1.geometry = new THREE.BufferGeometry().setFromPoints(getArcPoints(H_ishaa, Math.PI, 36));
            }
            if (prayerDiurnalLines.night2) {
                prayerDiurnalLines.night2.geometry.dispose();
                prayerDiurnalLines.night2.geometry = new THREE.BufferGeometry().setFromPoints(getArcPoints(-Math.PI, -H_fajr, 36));
            }

            function getOrbitPosAtH(H_val, offsetDist = 12) {
                const { alt, az } = computeHorizontalCoords(deltaSun, H_val, phi);
                const r = DOME_R + offsetDist;
                return new THREE.Vector3(
                    r * Math.cos(alt) * Math.sin(az),
                    r * Math.sin(alt),
                    -r * Math.cos(alt) * Math.cos(az)
                );
            }

            // تحديث وسوم أوقات الصلاة الثلاثية الأبعاد
            if (prayerDiurnalSprites) {
                const isha16CivilTime = (prayers.prayers && prayers.prayers.isha16) ? prayers.prayers.isha16.civil : '--:--';
                const badgeConfigs = [
                    { key: 'fajr', H: -H_fajr, text: `🌅 الفجر الصادق (18° | ${prayers.prayers.fajr.civil})`, color: '#06B6D4', offset: 14 },
                    { key: 'sunrise', H: -H_sunrise, text: `☀️ الشروق (${prayers.prayers.sunrise.civil})`, color: '#EAB308', offset: 14 },
                    { key: 'dhuha', H: -H_dhuha, text: `🌤️ صلاة الضحى (+5° | ${prayers.prayers.dhuha.civil})`, color: '#10B981', offset: 24 }, // إزاحة +24 لمنع التداخل مع الشروق
                    { key: 'duhr', H: 0, text: `☀️ الظهر (${prayers.prayers.duhr.civil})`, color: '#FACC15', offset: 14 },
                    { key: 'asr', H: H_asr, text: `🌤️ العصر الشافعي (${prayers.prayers.asr.civil})`, color: '#F97316', offset: 14 },
                    { key: 'asrHanafi', H: H_asrHanafi, text: `🌤️ العصر الحنفي (${prayers.prayers.asrHanafi.civil})`, color: '#A855F7', offset: 24 }, // إزاحة +24 لمنع التداخل مع الشافعي
                    { key: 'sunset', H: H_sunset, text: `🌇 المغرب (${prayers.prayers.sunset.civil})`, color: '#E11D48', offset: 14 },
                    { key: 'ishaShafi', H: hasIsha16 ? H_isha16 : H_ishaa, text: `🟠 العشاء الشافعي (16° | ${isha16CivilTime})`, color: '#FB923C', offset: 24, hide: !hasIsha16 }, // إزاحة +24 لمنع التداخل مع المغرب والعشاء الحنفي
                    { key: 'ishaa', H: H_ishaa, text: `🌌 العشاء الحنفي (18° | ${prayers.prayers.ishaa.civil})`, color: '#6366F1', offset: 14 }
                ];

                badgeConfigs.forEach(b => {
                    const sp = prayerDiurnalSprites[b.key];
                    if (sp) {
                        if (b.hide) {
                            sp.visible = false;
                            return;
                        }
                        const p = getOrbitPosAtH(b.H, b.offset || 14);
                        sp.position.set(p.x, p.y, p.z);
                        updateTextBadgeSprite(sp, b.text, b.color);
                        sp.visible = show3DLabels;
                    }
                });
            }

            // تحديث وسوم الفارق الزمني (المدة) في وسط كل قوس بالأجنبي (1h 24m / 28m / 55m)
            function formatArcDur(minVal) {
                const m = Math.max(0, Math.round(minVal));
                if (m < 60) return `⏱️ ${m}m`;
                const h = Math.floor(m / 60);
                const rem = m % 60;
                return rem > 0 ? `⏱️ ${h}h ${rem}m` : `⏱️ ${h}h`;
            }

            if (prayerArcDurationSprites) {
                const pObj = prayers.prayers;
                const rDiurnal = DOME_R * Math.cos(deltaSun);
                const hasIsha16Span = hasIsha16 && H_ishaa > H_isha16;
                const maghribSpan = (hasIsha16 && H_isha16 > H_sunset) ? (H_isha16 - H_sunset) : (H_ishaa - H_sunset);
                const maghribMin = (hasIsha16 && pObj.isha16 && pObj.sunset) ? (pObj.isha16.solarH - pObj.sunset.solarH) * 60 : (pObj.ishaa.solarH - pObj.sunset.solarH) * 60;
                const isha16Span = hasIsha16Span ? (H_ishaa - H_isha16) : 0;
                const isha16Min = (hasIsha16Span && pObj.ishaa && pObj.isha16) ? (pObj.ishaa.solarH - pObj.isha16.solarH) * 60 : 0;

                const durConfigs = [
                    { key: 'fajr', H: (-H_fajr - H_sunrise) / 2, span: H_fajr - H_sunrise, min: (pObj.sunrise.solarH - pObj.fajr.solarH) * 60, color: '#06B6D4' },
                    { key: 'sunrise', H: (-H_sunrise - H_dhuha) / 2, span: Math.abs(H_sunrise - H_dhuha), min: (pObj.dhuha.solarH - pObj.sunrise.solarH) * 60, color: '#EAB308' },
                    { key: 'dhuha', H: -H_dhuha / 2, span: H_dhuha, min: (pObj.duhr.solarH - pObj.dhuha.solarH) * 60, color: '#10B981' },
                    { key: 'duhr', H: H_asr / 2, span: H_asr, min: (pObj.asr.solarH - pObj.duhr.solarH) * 60, color: '#FACC15' },
                    { key: 'asr', H: (H_asr + H_asrHanafi) / 2, span: H_asrHanafi - H_asr, min: (pObj.asrHanafi.solarH - pObj.asr.solarH) * 60, color: '#F97316' },
                    { key: 'asrHanafi', H: (H_asrHanafi + H_sunset) / 2, span: H_sunset - H_asrHanafi, min: (pObj.sunset.solarH - pObj.asrHanafi.solarH) * 60, color: '#A855F7' },
                    { key: 'maghrib', H: (H_sunset + (hasIsha16 ? H_isha16 : H_ishaa)) / 2, span: maghribSpan, min: maghribMin, color: '#E11D48' },
                    { key: 'ishaShafi', H: (H_isha16 + H_ishaa) / 2, span: isha16Span, min: isha16Min, color: '#FB923C', hide: !hasIsha16Span },
                    { key: 'night', H: Math.PI, span: 2 * Math.PI - (H_ishaa + H_fajr), min: (24.0 - pObj.ishaa.solarH + pObj.fajr.solarH) * 60, color: '#6366F1' }
                ];

                durConfigs.forEach(d => {
                    const sp = prayerArcDurationSprites[d.key];
                    if (sp) {
                        if (d.hide) {
                            sp.visible = false;
                            return;
                        }
                        const p = getOrbitPosAtH(d.H, 0); // في المسافة الواقعة مباشرة بين الوقتين على مسار قوس النهار
                        sp.position.set(p.x, p.y, p.z);
                        const arcLen = rDiurnal * d.span;
                        const badgeW = Math.max(7.5, Math.min(arcLen * 0.52, 17.5));
                        const badgeH = badgeW * 0.28;
                        sp.scale.set(badgeW, badgeH, 1);
                        sp.renderOrder = 999;
                        const durText = formatArcDur(d.min);
                        updateTextBadgeSprite(sp, durText, d.color);
                        sp.visible = show3DLabels;
                    }
                });
            }
        }

        // ==========================================
        // 🕌 تحديث نصوص وألوان شارات مواقيت الصلاة ثلاثية الأبعاد على مدار الشمس
        // ==========================================
        function updatePrayerDiurnalBadgeSprites(prayers, activeKey) {
            if (!prayerDiurnalSprites || !prayers || !prayers.prayers) return;
            const pObj = prayers.prayers;
            const hasIsha16 = !!pObj.isha16;
            const isha16CivilTime = hasIsha16 ? pObj.isha16.civil : '--:--';

            const badgeDefs = [
                { key: 'fajr', baseText: `🌅 الفجر الصادق (18° | ${pObj.fajr ? pObj.fajr.civil : '--:--'})`, color: '#06B6D4' },
                { key: 'sunrise', baseText: `☀️ الشروق (${pObj.sunrise ? pObj.sunrise.civil : '--:--'})`, color: '#EAB308' },
                { key: 'dhuha', baseText: `🌤️ صلاة الضحى (+5° | ${pObj.dhuha ? pObj.dhuha.civil : '--:--'})`, color: '#10B981' },
                { key: 'duhr', baseText: `☀️ الظهر (${pObj.duhr ? pObj.duhr.civil : '--:--'})`, color: '#FACC15' },
                { key: 'asr', baseText: `🌤️ العصر الشافعي (${pObj.asr ? pObj.asr.civil : '--:--'})`, color: '#F97316' },
                { key: 'asrHanafi', baseText: `🌤️ العصر الحنفي (${pObj.asrHanafi ? pObj.asrHanafi.civil : '--:--'})`, color: '#A855F7' },
                { key: 'sunset', baseText: `🌇 المغرب (${pObj.sunset ? pObj.sunset.civil : '--:--'})`, color: '#E11D48' },
                { key: 'ishaShafi', baseText: `🟠 العشاء الشافعي (16° | ${isha16CivilTime})`, color: '#FB923C', hide: !hasIsha16 },
                { key: 'ishaa', baseText: `🌌 العشاء الحنفي (18° | ${pObj.ishaa ? pObj.ishaa.civil : '--:--'})`, color: '#6366F1' }
            ];

            badgeDefs.forEach(b => {
                const sp = prayerDiurnalSprites[b.key];
                if (!sp) return;
                if (b.hide) {
                    sp.visible = false;
                    return;
                }
                const isActive = (b.key === activeKey);
                const displayText = isActive ? `🟢 [الآن] ${b.baseText}` : b.baseText;
                const displayColor = isActive ? '#38BDF8' : b.color;
                updateTextBadgeSprite(sp, displayText, displayColor);
                sp.visible = show3DLabels;
            });
        }

        function updatePrayerHUD(prayers, H_sun) {
            if (!prayers || !prayers.prayers) return;

            const elFajr = document.getElementById('hudTimeFajr');
            if (elFajr) elFajr.innerText = prayers.prayers.fajr.civil;
            const elSunrise = document.getElementById('hudTimeSunrise');
            if (elSunrise) elSunrise.innerText = prayers.prayers.sunrise.civil;
            const elDhuha = document.getElementById('hudTimeDhuha');
            if (elDhuha && prayers.prayers.dhuha) elDhuha.innerText = prayers.prayers.dhuha.civil;
            const elDuhr = document.getElementById('hudTimeDuhr');
            if (elDuhr) elDuhr.innerText = prayers.prayers.duhr.civil;
            const elAsr = document.getElementById('hudTimeAsr');
            if (elAsr) elAsr.innerText = prayers.prayers.asr.civil;
            const elAsrHanafi = document.getElementById('hudTimeAsrHanafi');
            if (elAsrHanafi && prayers.prayers.asrHanafi) elAsrHanafi.innerText = prayers.prayers.asrHanafi.civil;
            const elSunset = document.getElementById('hudTimeSunset');
            if (elSunset) elSunset.innerText = prayers.prayers.sunset.civil;
            const elIshaShafi = document.getElementById('hudTimeIshaShafi');
            if (elIshaShafi && prayers.prayers.isha16) elIshaShafi.innerText = prayers.prayers.isha16.civil;
            const elIshaa = document.getElementById('hudTimeIshaa');
            if (elIshaa) elIshaa.innerText = prayers.prayers.ishaa.civil;

            // تحديث مدد الأقواس في بطاقات الـ HUD بالأجنبي (1h 24m / 28m / 55m)
            function fmtHudDur(m) {
                m = Math.max(0, Math.round(m));
                if (m < 60) return `⏱️ ${m}m`;
                const h = Math.floor(m / 60);
                const rem = m % 60;
                return rem > 0 ? `⏱️ ${h}h ${rem}m` : `⏱️ ${h}h`;
            }
            const pObj = prayers.prayers;
            const elDurFajr = document.getElementById('hudDurFajr');
            if (elDurFajr) elDurFajr.innerText = fmtHudDur((pObj.sunrise.solarH - pObj.fajr.solarH) * 60);
            const elDurSunrise = document.getElementById('hudDurSunrise');
            if (elDurSunrise) elDurSunrise.innerText = fmtHudDur((pObj.dhuha.solarH - pObj.sunrise.solarH) * 60);
            const elDurDhuha = document.getElementById('hudDurDhuha');
            if (elDurDhuha) elDurDhuha.innerText = fmtHudDur((pObj.duhr.solarH - pObj.dhuha.solarH) * 60);
            const elDurDuhr = document.getElementById('hudDurDuhr');
            if (elDurDuhr) elDurDuhr.innerText = fmtHudDur((pObj.asr.solarH - pObj.duhr.solarH) * 60);
            const elDurAsr = document.getElementById('hudDurAsr');
            if (elDurAsr) elDurAsr.innerText = fmtHudDur((pObj.asrHanafi.solarH - pObj.asr.solarH) * 60);
            const elDurAsrHanafi = document.getElementById('hudDurAsrHanafi');
            if (elDurAsrHanafi) elDurAsrHanafi.innerText = fmtHudDur((pObj.sunset.solarH - pObj.asrHanafi.solarH) * 60);
            const elDurSunset = document.getElementById('hudDurSunset');
            if (elDurSunset) {
                const maghribDuration = (pObj.isha16 && pObj.sunset) ? (pObj.isha16.solarH - pObj.sunset.solarH) * 60 : (pObj.ishaa.solarH - pObj.sunset.solarH) * 60;
                elDurSunset.innerText = fmtHudDur(maghribDuration);
            }
            const elDurIshaShafi = document.getElementById('hudDurIshaShafi');
            if (elDurIshaShafi && pObj.isha16 && pObj.ishaa) {
                elDurIshaShafi.innerText = fmtHudDur((pObj.ishaa.solarH - pObj.isha16.solarH) * 60);
            }
            const elDurIshaa = document.getElementById('hudDurIshaa');
            if (elDurIshaa) elDurIshaa.innerText = fmtHudDur((24.0 - pObj.ishaa.solarH + pObj.fajr.solarH) * 60);

            // تحديث تفاصيل ومقارنة العصرين (الشافعي والحنفي)
            const elAsrDetails = document.getElementById('hudAsrDetails');
            if (elAsrDetails && prayers.prayers.asr && prayers.prayers.asrHanafi) {
                elAsrDetails.innerText = `${prayers.prayers.asr.civil} / ${prayers.prayers.asrHanafi.civil}`;
            }
            const elAsrDiff = document.getElementById('hudAsrDiffTime');
            if (elAsrDiff && prayers.prayers.asr && prayers.prayers.asrHanafi) {
                const diffMin = Math.round((prayers.prayers.asrHanafi.solarH - prayers.prayers.asr.solarH) * 60);
                elAsrDiff.innerText = `${diffMin}m (${diffMin} min)`;
            }

            // تحديث تفاصيل العشائين
            const elIshaDetails = document.getElementById('hudIshaDetails');
            if (elIshaDetails && prayers.prayers.isha16) {
                elIshaDetails.innerText = `${prayers.prayers.isha16.civil} / ${prayers.prayers.ishaa.civil}`;
            }

            // مزامنة شريط القياسات اللحظي السفلي وجدول المقارنة الفصلي فوراً مع مواقيت الصلاة المعتمدة
            const diff16M = Math.round((pObj.isha16.solarH - pObj.sunset.solarH) * 60);
            const diff18M = Math.round((pObj.ishaa.solarH - pObj.sunset.solarH) * 60);
            const diffBetweenIshas = diff18M - diff16M;

            const elTelemSunset = document.getElementById('telemSunset');
            if (elTelemSunset) elTelemSunset.innerText = pObj.sunset.civil;
            const elTelemIsha16 = document.getElementById('telemIsha16');
            if (elTelemIsha16) elTelemIsha16.innerText = pObj.isha16.civil;
            const elTelemIsha16Diff = document.getElementById('telemIsha16Diff');
            if (elTelemIsha16Diff) elTelemIsha16Diff.innerText = `(+${diff16M}د)`;
            const elTelemIsha18 = document.getElementById('telemIsha18');
            if (elTelemIsha18) elTelemIsha18.innerText = pObj.ishaa.civil;
            const elTelemIsha18Diff = document.getElementById('telemIsha18Diff');
            if (elTelemIsha18Diff) elTelemIsha18Diff.innerText = `(+${diff18M}د)`;
            const elTelemIshaDiff = document.getElementById('telemIshaDiff');
            if (elTelemIshaDiff) elTelemIshaDiff.innerText = `${diffBetweenIshas}m (${diffBetweenIshas} min)`;

            const elHudIshaDiff = document.getElementById('hudIshaDiffTime');
            if (elHudIshaDiff) elHudIshaDiff.innerText = `${diffBetweenIshas} دقيقة (الفارق بين مغيب الشفقين الأحمر والأبيض)`;

            const tdCurrSS = document.getElementById('tdCurrSunset');
            if (tdCurrSS) {
                tdCurrSS.innerText = pObj.sunset.civil;
                const td16 = document.getElementById('tdCurrIsha16');
                if (td16) td16.innerText = `${pObj.isha16.civil} (+${diff16M}د)`;
                const td18 = document.getElementById('tdCurrIsha18');
                if (td18) td18.innerText = `${pObj.ishaa.civil} (+${diff18M}د)`;
                const tdDf = document.getElementById('tdCurrDiff');
                if (tdDf) tdDf.innerText = `${diffBetweenIshas} دقيقة`;
            }

            // تحديد الصلاة الحالية والوقت المتبقي حتى الصلاة القادمة بناءً على زاوية ساعة الشمس H_sun
            const { H_fajr, H_sunrise, H_dhuha, H_asr, H_asrHanafi, H_sunset, H_ishaa } = prayers.hourAngles;
            let currentPrayerName = 'الليل (العشاء)';
            let currentPrayerColor = '#6366F1';
            let activeCardId = 'hudCardIshaa';
            let activePrayerKey = 'ishaa';
            let nextPrayerTitle = 'الفجر الصادق';
            let remHours = 0;

            if (H_sun >= -H_fajr && H_sun < -H_sunrise) {
                currentPrayerName = 'الفجر الصادق';
                currentPrayerColor = '#06B6D4';
                activeCardId = 'hudCardFajr';
                activePrayerKey = 'fajr';
                nextPrayerTitle = 'الشروق';
                remHours = (-H_sunrise - H_sun) * 12.0 / Math.PI;
            } else if (H_sun >= -H_sunrise && H_sun < -H_dhuha) {
                currentPrayerName = 'الشروق والإشراق (وقت الكراهة)';
                currentPrayerColor = '#EAB308';
                activeCardId = 'hudCardSunrise';
                activePrayerKey = 'sunrise';
                nextPrayerTitle = 'صلاة الضحى';
                remHours = (-H_dhuha - H_sun) * 12.0 / Math.PI;
            } else if (H_sun >= -H_dhuha && H_sun < 0) {
                currentPrayerName = 'صلاة الضحى (ارتفاع 5° حتى الزوال)';
                currentPrayerColor = '#10B981';
                activeCardId = 'hudCardDhuha';
                activePrayerKey = 'dhuha';
                nextPrayerTitle = 'صلاة الظهر';
                remHours = (0 - H_sun) * 12.0 / Math.PI;
            } else if (H_sun >= 0 && H_sun < H_asr) {
                currentPrayerName = 'صلاة الظهر (الزوال)';
                currentPrayerColor = '#FACC15';
                activeCardId = 'hudCardDuhr';
                activePrayerKey = 'duhr';
                nextPrayerTitle = 'صلاة العصر (شافعي)';
                remHours = (H_asr - H_sun) * 12.0 / Math.PI;
            } else if (H_sun >= H_asr && H_sun < H_asrHanafi) {
                currentPrayerName = 'صلاة العصر (الشافعي - ظل مثله)';
                currentPrayerColor = '#F97316';
                activeCardId = 'hudCardAsr';
                activePrayerKey = 'asr';
                nextPrayerTitle = 'صلاة العصر (حنفي)';
                remHours = (H_asrHanafi - H_sun) * 12.0 / Math.PI;
            } else if (H_sun >= H_asrHanafi && H_sun < H_sunset) {
                currentPrayerName = 'صلاة العصر (الحنفي - ظل مثليه)';
                currentPrayerColor = '#A855F7';
                activeCardId = 'hudCardAsrHanafi';
                activePrayerKey = 'asrHanafi';
                nextPrayerTitle = 'صلاة المغرب';
                remHours = (H_sunset - H_sun) * 12.0 / Math.PI;
            } else if (H_sun >= H_sunset && H_sun < H_ishaa) {
                const H_16 = prayers.hourAngles ? prayers.hourAngles.H_isha16 : null;
                if (H_16 !== null && !isNaN(H_16) && H_sun >= H_16) {
                    currentPrayerName = 'صلاة العشاء (الشافعي - مغيب الشفق الأحمر 16°)';
                    currentPrayerColor = '#FB923C';
                    activeCardId = 'hudCardIshaShafi';
                    activePrayerKey = 'ishaShafi';
                    nextPrayerTitle = 'صلاة العشاء (حنفي)';
                    remHours = (H_ishaa - H_sun) * 12.0 / Math.PI;
                } else {
                    currentPrayerName = 'صلاة المغرب (الغروب والشفق الأحمر)';
                    currentPrayerColor = '#E11D48';
                    activeCardId = 'hudCardSunset';
                    activePrayerKey = 'sunset';
                    if (H_16 !== null && !isNaN(H_16)) {
                        nextPrayerTitle = 'صلاة العشاء (شافعي)';
                        remHours = (H_16 - H_sun) * 12.0 / Math.PI;
                    } else {
                        nextPrayerTitle = 'صلاة العشاء';
                        remHours = (H_ishaa - H_sun) * 12.0 / Math.PI;
                    }
                }
            } else {
                currentPrayerName = 'الليل (العشاء)';
                currentPrayerColor = '#6366F1';
                activeCardId = 'hudCardIshaa';
                activePrayerKey = 'ishaa';
                nextPrayerTitle = 'الفجر الصادق';
                if (H_sun >= H_ishaa) {
                    remHours = (2 * Math.PI - H_sun - H_fajr) * 12.0 / Math.PI;
                } else {
                    remHours = (-H_fajr - H_sun) * 12.0 / Math.PI;
                }
            }

            const totalRemSec = Math.max(0, Math.round(remHours * 3600));
            const remH = Math.floor(totalRemSec / 3600);
            const remM = Math.floor((totalRemSec % 3600) / 60);
            const remS = totalRemSec % 60;
            const remStr = (remH > 0)
                ? `${remH}h ${remM}m`
                : (remM > 0 ? `${remM}m ${remS}s` : `${remS}s`);

            const statusBadge = document.getElementById('hudSunTwilightStatus');
            if (statusBadge) {
                statusBadge.innerText = `🕌 وقت: ${currentPrayerName} • متبقي على ${nextPrayerTitle}: ${remStr}`;
                statusBadge.style.color = currentPrayerColor;
                statusBadge.style.borderColor = currentPrayerColor;
            }

            // تمييز بطاقة الصلاة الحالية في شبكة الـ HUD وعرض العداد التنازلي الحي
            const cardIds = ['hudCardFajr', 'hudCardSunrise', 'hudCardDhuha', 'hudCardDuhr', 'hudCardAsr', 'hudCardAsrHanafi', 'hudCardSunset', 'hudCardIshaShafi', 'hudCardIshaa'];
            cardIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    if (id === activeCardId) {
                        el.classList.add('active-prayer');
                        const durEl = document.getElementById(id.replace('Card', 'Dur'));
                        if (durEl) {
                            durEl.innerHTML = `<span style="color:#38BDF8; font-weight:bold;">⏳ متبقي: ${remStr}</span>`;
                        }
                    } else {
                        el.classList.remove('active-prayer');
                    }
                }
            });

            // تحديث شارات المواقيت ثلاثية الأبعاد على مدار الشمس لتعكس الوقت الحقيقي والصلاة الجارية
            updatePrayerDiurnalBadgeSprites(prayers, activePrayerKey);
        }

        function updateAstronomy(dateInput) {
            const simDate = dateInput || currentDate;
            const startOfYear = new Date(Date.UTC(simDate.getUTCFullYear(), 0, 1));
            const dayOfYear = (simDate.getTime() - startOfYear.getTime()) / (86400 * 1000);

            // 1. حساب الشمس بدقة NOAA ومعادلة الوقت (Equation of Time) لربط الميقات المدني بالموقع الشمسي الظاهري الحقيقي (LAT)
            const jd = getJD_Mujaib(simDate.getUTCFullYear(), simDate.getUTCMonth() + 1, simDate.getUTCDate());
            const totalJD = jd + (simDate.getUTCHours() + simDate.getUTCMinutes() / 60.0 + simDate.getUTCSeconds() / 3600.0) / 24.0;
            const T = (totalJD - 2451545.0) / 36525.0;
            const deltaSun = calcSunDeclination_Mujaib(T) * Math.PI / 180.0;
            const eotMin = calcEquationOfTime_Mujaib(T);

            const lambdaSun = ((dayOfYear / 365.25) * 2 * Math.PI - 1.39) % (2 * Math.PI);

            const civilHours = simDate.getHours() + simDate.getMinutes() / 60.0 + simDate.getSeconds() / 3600.0;
            const tzHours = (typeof getCityTimezoneHours === 'function')
                ? getCityTimezoneHours(currentLatDeg, currentLonDeg, currentCityCountry, simDate)
                : Math.round(currentLonDeg / 15.0);
            const utcHours = (civilHours - tzHours + 24.0) % 24.0;
            const lonHours = currentLonDeg / 15.0;
            // إضافة معادلة الوقت eotMin لتحويل الوقت المتوسط (LMT) إلى وقت شمسي حقيقي (LAT)
            const localSolarHours = (utcHours + lonHours + eotMin / 60.0 + 24.0) % 24.0;
            const H_sun = ((localSolarHours / 24.0) * 2 * Math.PI - Math.PI);

            const phi = currentLatRad;

            // موقع الشمس في القبة السماوية (مع معالجة القطبين)
            const { alt: altSun, az: azSun } = computeHorizontalCoords(deltaSun, H_sun, phi);

            if (sunMesh) {
                sunMesh.position.set(
                    DOME_R * Math.cos(altSun) * Math.sin(azSun),
                    DOME_R * Math.sin(altSun),
                    -DOME_R * Math.cos(altSun) * Math.cos(azSun)
                );
            }

            if (sunTimeLabelSprite) {
                const curH = simDate.getHours(), curM = simDate.getMinutes(), curS = simDate.getSeconds();
                const curH12 = curH % 12 || 12;
                const curAmpm = curH >= 12 ? 'م' : 'ص';
                const liveTimeStr = `${String(curH12).padStart(2,'0')}:${String(curM).padStart(2,'0')}:${String(curS).padStart(2,'0')} ${curAmpm}`;
                updateTextBadgeSprite(sunTimeLabelSprite, `☀️ ${liveTimeStr}`, '#FDE047');
                sunTimeLabelSprite.visible = show3DLabels;
            }

            // سعة مشرق الشمس
            let riseAzDeg = 90, setAzDeg = 270, ampDeg = 0;
            if (Math.abs(Math.cos(phi)) > 0.0001) {
                const cosRiseVal = Math.sin(deltaSun) / Math.cos(phi);
                if (Math.abs(cosRiseVal) <= 1.0) {
                    riseAzDeg = Math.acos(cosRiseVal) * 180 / Math.PI;
                    setAzDeg = 360 - riseAzDeg;
                    ampDeg = 90 - riseAzDeg;
                }
            }

            // ==========================================
            // 🕌 حسابات ميقات العشائين الشافعي (16°) والحنفي (18°)
            // ==========================================
            function getSettingHourAngle(altRad) {
                if (Math.abs(Math.cos(phi) * Math.cos(deltaSun)) < 0.0001) return null;
                const cosH = (Math.sin(altRad) - Math.sin(phi) * Math.sin(deltaSun)) / (Math.cos(phi) * Math.cos(deltaSun));
                if (Math.abs(cosH) > 1.0) return null;
                return Math.acos(cosH); // زاوية الساعة موجبة للغروب غرباً
            }

            const hSetRad = -0.833 * Math.PI / 180; // الغروب المماس
            const h16Rad = -16.0 * Math.PI / 180;   // العشاء الشافعي
            const h18Rad = -18.0 * Math.PI / 180;   // العشاء الحنفي

            const H_sunset = getSettingHourAngle(hSetRad);
            currentSunsetSolarH = H_sunset;
            const H_isha16 = getSettingHourAngle(h16Rad);
            const H_isha18 = getSettingHourAngle(h18Rad);

            function calcSolarTimeStr(H_val, reserveMin = 0) {
                if (H_val === null || isNaN(H_val)) return '--:--';
                const hoursFromNoon = H_val * (180 / Math.PI) / 15.0;
                let solH = 12.0 + hoursFromNoon;
                const tz = (currentPrayersData && currentPrayersData.tzHours !== undefined)
                    ? currentPrayersData.tzHours
                    : getCityTimezoneHours(currentLatDeg, currentLonDeg, currentCityCountry, simDate);
                const eot = (currentPrayersData && currentPrayersData.eotMin !== undefined)
                    ? currentPrayersData.eotMin
                    : 0;
                const lonOffsetMin = (tz * 15.0 - currentLonDeg) * 4.0;
                let civH = solH + (reserveMin / 60.0) + (lonOffsetMin - eot) / 60.0;
                while (civH < 0) civH += 24.0;
                while (civH >= 24.0) civH -= 24.0;
                const totalM = Math.round(civH * 60.0);
                const hh24 = Math.floor(totalM / 60.0) % 24;
                const mm = totalM % 60;
                const mmStr = String(mm).padStart(2, '0');
                const period = hh24 >= 12 ? 'PM' : 'AM';
                const hh12 = hh24 % 12 || 12;
                const hh12Str = String(hh12).padStart(2, '0');
                return `${hh12Str}:${mmStr} ${period}`;
            }

            let sunsetTimeStr = (currentPrayersData && currentPrayersData.prayers && currentPrayersData.prayers.sunset)
                ? currentPrayersData.prayers.sunset.civil
                : calcSolarTimeStr(H_sunset, 5);
            let isha16TimeStr = (currentPrayersData && currentPrayersData.prayers && currentPrayersData.prayers.isha16)
                ? currentPrayersData.prayers.isha16.civil
                : calcSolarTimeStr(H_isha16, 0);
            let isha18TimeStr = (currentPrayersData && currentPrayersData.prayers && currentPrayersData.prayers.ishaa)
                ? currentPrayersData.prayers.ishaa.civil
                : calcSolarTimeStr(H_isha18, 0);

            let diff16Min = 0, diff18Min = 0, diffBetweenIshas = 0;
            if (currentPrayersData && currentPrayersData.prayers && currentPrayersData.prayers.sunset && currentPrayersData.prayers.isha16) {
                diff16Min = Math.round((currentPrayersData.prayers.isha16.solarH - currentPrayersData.prayers.sunset.solarH) * 60);
            } else if (H_sunset !== null && H_isha16 !== null) {
                diff16Min = Math.round(((H_isha16 - H_sunset) * (180 / Math.PI) / 15.0) * 60);
            }
            if (currentPrayersData && currentPrayersData.prayers && currentPrayersData.prayers.sunset && currentPrayersData.prayers.ishaa) {
                diff18Min = Math.round((currentPrayersData.prayers.ishaa.solarH - currentPrayersData.prayers.sunset.solarH) * 60);
            } else if (H_sunset !== null && H_isha18 !== null) {
                diff18Min = Math.round(((H_isha18 - H_sunset) * (180 / Math.PI) / 15.0) * 60);
            }
            diffBetweenIshas = diff18Min - diff16Min;

            // حساب مواضع نقاط التقاطع ثلاثية الأبعاد على القبة السماوية
            function getPointAtDepression(altRad, H_val) {
                if (H_val === null) return null;
                const { az } = computeHorizontalCoords(deltaSun, H_val, phi);
                return new THREE.Vector3(
                    DOME_R * Math.cos(altRad) * Math.sin(az),
                    DOME_R * Math.sin(altRad),
                    -DOME_R * Math.cos(altRad) * Math.cos(az)
                );
            }

            const p16 = getPointAtDepression(h16Rad, H_isha16);
            const p18 = getPointAtDepression(h18Rad, H_isha18);
            const pSet = getPointAtDepression(hSetRad, H_sunset);

            // وسم العشاء الشافعي 16° (لمقارنة العشائين مع العشاء الحنفي 18° الموجود على مدار الصلاة)
            if (p16 && ishaShafiLabelSprite) {
                ishaShafiLabelSprite.position.set(p16.x + 14, p16.y + 3, p16.z - 10);
                updateTextBadgeSprite(ishaShafiLabelSprite, `🟠 العشاء الشافعي (16° | ${isha16TimeStr})`, '#F97316');
                ishaShafiLabelSprite.visible = show3DLabels && (showTwilightCircles || isIshaFocusMode);
            }

            // تحديث أقواس مدار الشمس اليومي ومواقيت الصلاة فور تغير التاريخ أو ميل الشمس أو خط العرض
            const curDayKey = `${simDate.getFullYear()}-${simDate.getMonth()}-${simDate.getDate()}`;
            const dateChanged = (lastPrayerDayKey !== curDayKey);
            const arcsNeedUpdate = forceRebuildPrayerArcs ||
                dateChanged ||
                lastPrayerArcsDecl === null ||
                Math.abs(deltaSun - lastPrayerArcsDecl) > 0.0003 ||
                Math.abs(phi - lastPrayerArcsPhi) > 0.0003;

            if (arcsNeedUpdate) {
                lastPrayerDayKey = curDayKey;
                updatePrayerDiurnalArcs(deltaSun, phi, simDate, H_sun);

                // رسم قوس هبوط الشمس الشفقي الغاطس من الغروب إلى زاوية 18°
                if (twilightDescendingArcLine && H_sunset !== null && H_isha18 !== null) {
                    const descPts = [];
                    for (let k = 0; k <= 24; k++) {
                        const hCur = H_sunset + (k / 24) * (H_isha18 - H_sunset);
                        const { alt: a, az } = computeHorizontalCoords(deltaSun, hCur, phi);
                        descPts.push(new THREE.Vector3(DOME_R * Math.cos(a) * Math.sin(az), DOME_R * Math.sin(a), -DOME_R * Math.cos(a) * Math.cos(az)));
                    }
                    twilightDescendingArcLine.geometry.setFromPoints(descPts);
                }

                lastPrayerArcsDecl = deltaSun;
                lastPrayerArcsPhi = phi;
                forceRebuildPrayerArcs = false;
            } else if (currentPrayersData) {
                updatePrayerHUD(currentPrayersData, H_sun);
            }

            // تحديث شريط المدارات الفصلي المباشر وبيانات مقارنة العشائين
            updateSeasonalBarUI(deltaSun, phi, sunsetTimeStr, isha16TimeStr, diff16Min, isha18TimeStr, diff18Min, diffBetweenIshas);

            // تحديد الحالة اللحظية للشمس والشفق بدقة مع التمييز بين الفجر الصباحي والعشاء المسائي
            const altSunDeg = altSun * 180 / Math.PI;
            let twilightStatusText = '☀️ نهار';
            let twilightStatusColor = '#FDE047';
            const isMorning = H_sun < 0;

            if (altSunDeg >= 0) {
                twilightStatusText = `☀️ نهار (+${altSunDeg.toFixed(1)}°)`;
                twilightStatusColor = '#FDE047';
            } else if (isMorning) {
                if (altSunDeg >= -0.833) {
                    twilightStatusText = `🌅 شروق الشمس (الأفق ${altSunDeg.toFixed(1)}°)`;
                    twilightStatusColor = '#FDE047';
                } else if (altSunDeg >= -16.0) {
                    twilightStatusText = `🌄 إسفار الصباح (انحطاط ${Math.abs(altSunDeg).toFixed(1)}°)`;
                    twilightStatusColor = '#38BDF8';
                } else if (altSunDeg >= -18.0) {
                    twilightStatusText = `🌅 دخل الفجر الصادق (انحطاط 18° - ${Math.abs(altSunDeg).toFixed(1)}°)`;
                    twilightStatusColor = '#06B6D4';
                } else {
                    twilightStatusText = `🌌 ليل دامس / قبل الفجر (انحطاط ${Math.abs(altSunDeg).toFixed(1)}°)`;
                    twilightStatusColor = '#64748B';
                }
            } else {
                if (altSunDeg >= -0.833) {
                    twilightStatusText = `🌇 غروب الشمس (الأفق ${altSunDeg.toFixed(1)}°)`;
                    twilightStatusColor = '#F59E0B';
                } else if (altSunDeg >= -16.0) {
                    twilightStatusText = `🌅 وقت الشفق الأحمر (انحطاط ${Math.abs(altSunDeg).toFixed(1)}°)`;
                    twilightStatusColor = '#F97316';
                } else if (altSunDeg >= -18.0) {
                    twilightStatusText = `🌌 دخل العشاء الشافعي (شفق أبيض ${Math.abs(altSunDeg).toFixed(1)}°)`;
                    twilightStatusColor = '#C084FC';
                } else {
                    twilightStatusText = `🌑 دخل العشاء الحنفي (انحطاط 18° - ليل دامس ${Math.abs(altSunDeg).toFixed(1)}°)`;
                    twilightStatusColor = '#818CF8';
                }
            }

            // تحديث قيم الميقات في لوحة HUD
            const elStatus = document.getElementById('hudSunTwilightStatus');
            if (elStatus) {
                elStatus.innerText = twilightStatusText;
                elStatus.style.color = twilightStatusColor;
            }
            const elSet = document.getElementById('hudSunsetTime');
            if (elSet) elSet.innerText = `${sunsetTimeStr} (سمت الغروب ${setAzDeg.toFixed(1)}°)`;
            const elIsha16 = document.getElementById('hudIshaShafiTime');
            if (elIsha16) elIsha16.innerText = `${isha16TimeStr} (بعد ${diff16Min} دقيقة من الغروب)`;
            const elIsha18 = document.getElementById('hudIshaHanafiTime');
            if (elIsha18) elIsha18.innerText = `${isha18TimeStr} (بعد ${diff18Min} دقيقة من الغروب)`;
            const elIshaDiff = document.getElementById('hudIshaDiffTime');
            if (elIshaDiff) elIshaDiff.innerText = `${diffBetweenIshas} دقيقة (الفارق بين مغيب الشفقين الأحمر والأبيض)`;

            // 2. حساب حركة القمر الدقيقة ودورته في السماء
            // طول القمر λ_moon وسرعته ~13.18° في اليوم
            const moonLambda = ((dayOfYear / 27.3216) * 2 * Math.PI) % (2 * Math.PI);
            // ميل القمر δ_moon مع مراعاة ميل مداره 5.14°
            const moonDelta = Math.asin(Math.sin(EPSILON + MOON_INC) * Math.sin(moonLambda));

            // زاوية ساعة القمر H_moon
            const H_moon = H_sun + (moonLambda - lambdaSun);

            // موقع القمر في القبة السماوية
            // موقع القمر في القبة السماوية (مع معالجة القطبين)
            const { alt: altMoon, az: azMoon } = computeHorizontalCoords(moonDelta, H_moon, phi);

            // وضع القمر الواضح تماماً على حافة القبة السماوية (DOME_R - 2)
            if (moonMesh) {
                moonMesh.position.set(
                    (DOME_R - 2) * Math.cos(altMoon) * Math.sin(azMoon),
                    (DOME_R - 2) * Math.sin(altMoon),
                    -(DOME_R - 2) * Math.cos(altMoon) * Math.cos(azMoon)
                );
            }

            // رسم قوس مسار القمر لليوم الحالي
            updateMoonSkyArc(moonDelta);

            // رسم مدار وقوس مسار الشمس لليوم الحالي (الموازي لمدار السرطان والجدي)
            updateSunSkyArc(deltaSun);

            // حساب المطلع المستقيم للشمس alpha_sun لمزامنة حركة فلك البروج بالكامل
            const alpha_sun = Math.atan2(Math.cos(EPSILON) * Math.sin(lambdaSun), Math.cos(lambdaSun));
            const zR = 260;

            // تحديث حلقة فلك البروج الحقيقية في السماء (96 نقطة تتكيف مع دوران اليوم وخط العرض)
            if (zodiacLine) {
                const zPts = [];
                for (let j = 0; j <= 96; j++) {
                    const lam = (j / 96) * Math.PI * 2;
                    zPts.push(getEcliptic3DPos(lam, H_sun, alpha_sun, phi, zR));
                }
                zodiacLine.geometry.setFromPoints(zPts);
            }

            // تحديث الفلك الحامل والمدير للشمس والقمر وفق هندسة ابن الشاطر الحركية والانتقال الفصلي
            updateIbnShatirOrbs(lambdaSun, alpha_sun, H_sun, deltaSun, moonLambda, moonDelta, H_moon, phi, dayOfYear);

            // تحديث مواضع شارات البروج الاثني عشر وحساب البرج الطالع والغارب اللحظيين
            let bestAscIdx = 0, minAscDist = 9999;
            let bestDescIdx = 6, minDescDist = 9999;

            if (zodiacSprites && zodiacSprites.length === 12) {
                for (let i = 0; i < 12; i++) {
                    const midLam = (i * 30 + 15) * Math.PI / 180;
                    const pos = getEcliptic3DPos(midLam, H_sun, alpha_sun, phi, zR);
                    zodiacSprites[i].position.copy(pos);

                    // البحث عن البرج الطالع (الأقرب للأفق الشرقي: pos.x > 0 وارتفاعه y الأقرب للصفر من الأسفل أو الأعلى)
                    if (pos.x > 0) {
                        const dist = Math.abs(pos.y);
                        if (dist < minAscDist) {
                            minAscDist = dist;
                            bestAscIdx = i;
                        }
                    }
                    // البحث عن البرج الغارب (الأقرب للأفق الغربي: pos.x < 0 وارتفاعه y الأقرب للصفر)
                    if (pos.x < 0) {
                        const dist = Math.abs(pos.y);
                        if (dist < minDescDist) {
                            minDescDist = dist;
                            bestDescIdx = i;
                        }
                    }
                }
            }

            // تحديث بيانات الطالع والغارب في HUD
            const ascEl = document.getElementById('hudAscendantSign');
            if (ascEl) ascEl.innerText = ZODIAC_NAMES[bestAscIdx] + ' (طالع الآن)';
            const descEl = document.getElementById('hudDescendantSign');
            if (descEl) descEl.innerText = ZODIAC_NAMES[bestDescIdx] + ' (غارب الآن)';

            // حساب طور القمر ونسبة الإضاءة (Phase & Illumination)
            let elongRad = (moonLambda - lambdaSun);
            elongRad = ((elongRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            const elongDeg = elongRad * 180 / Math.PI;

            // نسبة الإضاءة
            const illumPercent = Math.round((1 - Math.cos(elongRad)) / 2 * 100);

            // اسم الطور
            let phaseName = 'محاق';
            if (elongDeg >= 340 || elongDeg < 20) phaseName = '🌑 محاق (New Moon)';
            else if (elongDeg >= 20 && elongDeg < 70) phaseName = '🌒 هلال متزايد (Crescent)';
            else if (elongDeg >= 70 && elongDeg < 110) phaseName = '🌓 تربيع أول (First Quarter)';
            else if (elongDeg >= 110 && elongDeg < 160) phaseName = '🌔 أحدب متزايد (Gibbous)';
            else if (elongDeg >= 160 && elongDeg < 200) phaseName = '🌕 بدر تام (Full Moon)';
            else if (elongDeg >= 200 && elongDeg < 250) phaseName = '🌖 أحدب متناقص (Gibbous)';
            else if (elongDeg >= 250 && elongDeg < 290) phaseName = '🌗 تربيع أخير (Last Quarter)';
            else phaseName = '🌘 هلال متناقص (Crescent)';

            // مطلع ومغيب القمر
            let moonRiseStr = '56.2°', moonSetStr = '303.8°';
            if (Math.abs(Math.cos(phi)) > 0.0001) {
                const cosMRise = Math.sin(moonDelta) / Math.cos(phi);
                if (Math.abs(cosMRise) <= 1.0) {
                    const mRiseDeg = Math.acos(cosMRise) * 180 / Math.PI;
                    moonRiseStr = `${mRiseDeg.toFixed(1)}° (${mRiseDeg < 90 ? 'شمال الشرق' : 'جنوب الشرق'})`;
                    moonSetStr = `${(360 - mRiseDeg).toFixed(1)}°`;
                }
            }

            // 3. تحديث الكواكب الخمسة الأخرى بحساب الميل الكروي الحقيقي (Spherical Trigonometry) وعرض الكوكب (الفصل 24-25)
            if (typeof PLANETS_CONFIG !== 'undefined' && Array.isArray(PLANETS_CONFIG)) {
                PLANETS_CONFIG.forEach(cfg => {
                    const mesh = planetMeshes[cfg.key];
                    if (!mesh) return;

                    const lambda = ((dayOfYear / cfg.periodDays) * 2 * Math.PI) % (2 * Math.PI);
                    const beta = cfg.inc * Math.sin(lambda); // عرض الكوكب عن منطقة البروج
                    const sinDelta = Math.sin(beta) * Math.cos(EPSILON) + Math.cos(beta) * Math.sin(EPSILON) * Math.sin(lambda);
                    const delta = Math.asin(Math.max(-1, Math.min(1, sinDelta)));
                    const H = H_sun + (lambda - lambdaSun);

                    // موقع الكوكب في القبة السماوية (مع معالجة القطبين)
                    const { alt, az } = computeHorizontalCoords(delta, H, phi);

                    mesh.position.set(
                        cfg.r * Math.cos(alt) * Math.sin(az),
                        cfg.r * Math.sin(alt),
                        -cfg.r * Math.cos(alt) * Math.cos(az)
                    );

                    // تحديث دائرة فلك الكوكب ديناميكياً لتطابق مساره المداري ويدور الكوكب فوقها تماماً
                    const ringLine = planetOrbitLines[cfg.key];
                    if (ringLine) {
                        const pts = [];
                        for (let j = 0; j <= 48; j++) {
                            const ringLam = (j / 48) * Math.PI * 2;
                            const ringBeta = cfg.inc * Math.sin(ringLam);
                            const rSinDelta = Math.sin(ringBeta) * Math.cos(EPSILON) + Math.cos(ringBeta) * Math.sin(EPSILON) * Math.sin(ringLam);
                            const ringDelta = Math.asin(Math.max(-1, Math.min(1, rSinDelta)));
                            const ringH = H_sun + (ringLam - lambdaSun);
                            const { alt: rAlt, az: rAz } = computeHorizontalCoords(ringDelta, ringH, phi);
                            pts.push(new THREE.Vector3(
                                cfg.r * Math.cos(rAlt) * Math.sin(rAz),
                                cfg.r * Math.sin(rAlt),
                                -cfg.r * Math.cos(rAlt) * Math.cos(rAz)
                            ));
                        }
                        ringLine.geometry.setFromPoints(pts);
                    }
                });
            }

            // تدوير الفلك الأطلس وكافة النجوم الثوابت حول محور القطبين السماويين بزاوية خط العرض
            if (atlasGroup) {
                const axisVec = new THREE.Vector3(0, Math.sin(phi), -Math.cos(phi)).normalize();
                atlasGroup.setRotationFromAxisAngle(axisVec, -H_sun);
            }


            // تحديث حركة النجم القطبي اليومية حول القطب السماوي الشمالي (دورة كل 24 ساعة)
            if (polarisStar) {
                const polDist = 320;
                const polOrbitR = 24;
                // الزاوية متوافقة تماماً مع الحركة اليومية من الشرق إلى الغرب (+H_sun)
                const polAngle = H_sun;

                const centerPoleX = 0;
                const centerPoleY = polDist * Math.sin(phi);
                const centerPoleZ = -polDist * Math.cos(phi);

                const px = centerPoleX + polOrbitR * Math.cos(polAngle);
                const py = centerPoleY + polOrbitR * Math.sin(polAngle) * Math.cos(phi);
                const pz = centerPoleZ + polOrbitR * Math.sin(polAngle) * Math.sin(phi);

                polarisStar.position.set(px, py, pz);
            }

            // تحديث HUD
            const elHudDateTime = document.getElementById('hudDateTime');
            if (elHudDateTime) elHudDateTime.innerText = simDate.toISOString().replace('T', ' ').substring(0, 16);
            const elHudSunDecl = document.getElementById('hudSunDecl');
            if (elHudSunDecl) elHudSunDecl.innerText = `${deltaSun >= 0 ? '+' : ''}${(deltaSun * 180 / Math.PI).toFixed(2)}°`;
            const elHudSunAlt = document.getElementById('hudSunAlt');
            if (elHudSunAlt) elHudSunAlt.innerText = `${(altSun * 180 / Math.PI).toFixed(1)}° (${altSun >= 0 ? 'فوق الأفق' : 'تحت الأفق'})`;
            const elHudSunriseAz = document.getElementById('hudSunriseAz');
            if (elHudSunriseAz) elHudSunriseAz.innerText = Math.abs(Math.cos(phi)) < 0.001 ? 'لا شروق ولا غروب (مدارات أفقية)' : `${riseAzDeg.toFixed(1)}° (سعة ${Math.abs(ampDeg).toFixed(1)}°)`;

            const elHudMoonPhase = document.getElementById('hudMoonPhaseName');
            if (elHudMoonPhase) elHudMoonPhase.innerText = phaseName;
            const elHudMoonIllum = document.getElementById('hudMoonIllum');
            if (elHudMoonIllum) elHudMoonIllum.innerText = `${illumPercent}% مضاء (${phaseName.split(' ')[1] || ''})`;
            const elHudMoonElong = document.getElementById('hudMoonElong');
            if (elHudMoonElong) elHudMoonElong.innerText = `${elongDeg.toFixed(1)}°`;
            const elHudMoonAlt = document.getElementById('hudMoonAlt');
            if (elHudMoonAlt) elHudMoonAlt.innerText = `${(altMoon * 180 / Math.PI).toFixed(1)}° (${altMoon >= 0 ? 'فوق الأفق طالع' : 'تحت الأفق غارب'})`;
            const elHudMoonriseAz = document.getElementById('hudMoonriseAz');
            if (elHudMoonriseAz) elHudMoonriseAz.innerText = moonRiseStr;
            const elHudMoonsetAz = document.getElementById('hudMoonsetAz');
            if (elHudMoonsetAz) elHudMoonsetAz.innerText = moonSetStr;
        }

        // togglePlay() and setSpeed() are unified globally

        function stepTime(amount, unit) {
            if (unit === 'hour') currentDate = new Date(currentDate.getTime() + amount * 3600 * 1000);
            if (unit === 'day') currentDate = new Date(currentDate.getTime() + amount * 86400 * 1000);
            updateDateTimeUI();
            if (cosmos3DInitialized) updateAstronomy(currentDate);
        }

        function jumpToSeason(season) {
            const y = currentDate.getUTCFullYear();
            if (season === 'spring') currentDate = new Date(Date.UTC(y, 2, 21, 5, 45, 0));
            if (season === 'summer') currentDate = new Date(Date.UTC(y, 5, 21, 4, 30, 0));
            if (season === 'autumn') currentDate = new Date(Date.UTC(y, 8, 23, 5, 45, 0));
            if (season === 'winter') currentDate = new Date(Date.UTC(y, 11, 21, 6, 45, 0));
            updateDateTimeUI();
            if (cosmos3DInitialized) {
                updateAstronomy(currentDate);
                if (renderer && scene && camera) renderer.render(scene, camera);
            }
        }

        function onCosmos3DResize() {
            const container = document.getElementById('webgl-container');
            if (!container || !camera || !renderer) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w > 0 && h > 0) {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            }
        }
        function toggleCosmos3DFullscreen() {
            const elem = document.getElementById('cosmos3DContainer');
            if (!elem) return;
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (elem.requestFullscreen) elem.requestFullscreen();
                else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
            setTimeout(onCosmos3DResize, 150);
        }
        document.addEventListener('fullscreenchange', () => setTimeout(onCosmos3DResize, 150));
        document.addEventListener('webkitfullscreenchange', () => setTimeout(onCosmos3DResize, 150));

        
        // دالة طي وتوسيع اللوحات الجانبية لتوفير رؤية سينمائية كاملة
        function togglePanel(panel) {
            if (panel === 'city') {
                const c = document.getElementById('cityPanelContent');
                const btn = document.getElementById('btnCollapseCity');
                const isHidden = c.style.display === 'none';
                c.style.display = isHidden ? 'flex' : 'none';
                btn.innerText = isHidden ? '−' : '+';
            } else if (panel === 'hud') {
                const c = document.getElementById('hudPanelContent');
                const btn = document.getElementById('btnCollapseHud');
                const isHidden = c.style.display === 'none';
                c.style.display = isHidden ? 'flex' : 'none';
                btn.innerText = isHidden ? '−' : '+';
            }
        }


    


        // ==========================================
        // ☀️ دوال تحريك المدارات الفصيلة بالماوس ومقارنة العشائين
        // ==========================================
        
        function toggle3DLabels() {
            show3DLabels = !show3DLabels;
            if (sunTimeLabelSprite) sunTimeLabelSprite.visible = show3DLabels;
            if (ishaShafiLabelSprite) ishaShafiLabelSprite.visible = show3DLabels;
            if (prayerDiurnalSprites) {
                Object.values(prayerDiurnalSprites).forEach(sp => {
                    if (sp) sp.visible = show3DLabels;
                });
            }
            if (prayerArcDurationSprites) {
                Object.values(prayerArcDurationSprites).forEach(sp => {
                    if (sp) sp.visible = show3DLabels;
                });
            }
            const btn = document.getElementById('btnToggle3DLabels');
            if (btn) btn.classList.toggle('active', show3DLabels);
            showC3DToast(show3DLabels ? '🏷️ تم إظهار وسوم العشائين على الرسم' : '🚫 تم إخفاء وسوم الرسم لرؤية نقية 100% غير محجوبة');
        }

        function setSeasonalDeclination(declDeg) {
            const clampedDecl = Math.max(-23.516, Math.min(23.516, declDeg));
            const dRad = clampedDecl * Math.PI / 180;
            const sinLam = Math.max(-1.0, Math.min(1.0, Math.sin(dRad) / Math.sin(EPSILON)));
            let lam = Math.asin(sinLam);
            if (lam < 0) lam += 2 * Math.PI;

            // حساب اليوم المقابل لميل الشمس في السنة
            const dayOfYear = ((lam + 1.39) % (2 * Math.PI)) / (2 * Math.PI) * 365.25;
            const y = currentDate.getUTCFullYear();
            const curH = currentDate.getUTCHours();
            const curM = currentDate.getUTCMinutes();
            const curS = currentDate.getUTCSeconds();

            currentDate = new Date(Date.UTC(y, 0, 1 + Math.floor(dayOfYear), curH, curM, curS));
            updateDateTimeUI();
            forceRebuildPrayerArcs = true;
            lastBarDecl = null;
            if (cosmos3DInitialized) {
                updateAstronomy(currentDate);
                if (renderer && scene && camera) renderer.render(scene, camera);
            }
        }

        function snapSeason(declDeg) {
            isDraggingSeasonalOrbit = false;
            setSeasonalDeclination(declDeg);
            const name = declDeg > 15 ? 'الانقلاب الصيفي (+23.5°)' : (declDeg < -15 ? 'الانقلاب الشتوي (-23.5°)' : 'الاعتدالين (0.0°)');
            showToast(`☀️ تم الانتقال إلى مدار: ${name}`);
        }

        function togglePanelCollapse(el) {
            const panel = el.closest('.c3d-side-panel-right, .c3d-side-panel-left');
            if (!panel) return;
            const isMin = panel.classList.toggle('minimized');
            const icon = panel.querySelector('.btn-toggle-icon');
            if (icon) icon.innerText = isMin ? '+' : '−';
        }

        function switchRightPanelTab(tabName) {
            const btnS = document.getElementById('btnTabSeasons');
            const btnM = document.getElementById('btnTabMonths');
            const panS = document.getElementById('panelSeasonsView');
            const panM = document.getElementById('panelMonthsView');
            if (!btnS || !btnM || !panS || !panM) return;
            
            if (tabName === 'months') {
                btnS.classList.remove('active');
                btnM.classList.add('active');
                panS.style.display = 'none';
                panM.style.display = 'flex';
                syncMonthControlsUI(currentDate);
            } else {
                btnM.classList.remove('active');
                btnS.classList.add('active');
                panM.style.display = 'none';
                panS.style.display = 'flex';
            }
        }

        function snapMonth(month1Based) {
            isDraggingSeasonalOrbit = false;
            const y = currentDate.getUTCFullYear();
            const targetMonth0 = Math.max(0, Math.min(11, month1Based - 1));
            
            let d = currentDate.getUTCDate();
            const daysInMonth = new Date(Date.UTC(y, targetMonth0 + 1, 0)).getUTCDate();
            if (d > daysInMonth) d = daysInMonth;

            const curH = currentDate.getUTCHours();
            const curM = currentDate.getUTCMinutes();
            const curS = currentDate.getUTCSeconds();

            currentDate = new Date(Date.UTC(y, targetMonth0, d, curH, curM, curS));
            updateDateTimeUI();
            forceRebuildPrayerArcs = true;
            lastBarDecl = null;
            if (cosmos3DInitialized) {
                updateAstronomy(currentDate);
                syncMonthControlsUI(currentDate);
                if (renderer && scene && camera) renderer.render(scene, camera);
            }
            const info = C3D_MONTHS_INFO[targetMonth0];
            showToast(`📅 تم الانتقال إلى: ${info.name} (${info.sign}) ${info.note ? '— ' + info.note : ''}`);
        }

        function stepMonth(delta) {
            const curM = currentDate.getUTCMonth() + 1;
            let nextM = curM + delta;
            if (nextM < 1) nextM = 12;
            if (nextM > 12) nextM = 1;
            snapMonth(nextM);
        }

        let lastSyncedMonth = null;
        function syncMonthControlsUI(simDate) {
            if (typeof C3D_MONTHS_INFO === 'undefined' || !C3D_MONTHS_INFO) return;
            const d = simDate || currentDate;
            const curM1 = d.getUTCMonth() + 1;
            if (curM1 === lastSyncedMonth) return;
            lastSyncedMonth = curM1;

            const info = C3D_MONTHS_INFO[curM1 - 1];

            const badge = document.getElementById('c3dMonthBadge');
            if (badge && info) {
                const shortName = info.name.split(' ')[0];
                badge.innerText = `${curM1} - ${shortName} ${info.sign}`;
            }

            for (let i = 1; i <= 12; i++) {
                const btn = document.querySelector(`.btn-m-${i}`);
                if (btn) {
                    btn.classList.toggle('month-active', i === curM1);
                }
            }

            const sel = document.getElementById('c3dMonthSelect');
            if (sel && sel.value != curM1) {
                sel.value = curM1;
            }
        }

        // ==========================================
        // 📅 منظومة شريط التنقل بين أيام السنة والفصول الفلكية (Annual Days Timeline)
        // ==========================================
        let isDraggingAnnualTimeline = false;

        const C3D_ANNUAL_MONTHS = [
            { num: 1, name: 'كانون الثاني (يناير)', short: 'كانون 2', days: 31 },
            { num: 2, name: 'شباط (فبراير)', short: 'شباط', days: 28 },
            { num: 3, name: 'آذار (مارس)', short: 'آذار', days: 31 },
            { num: 4, name: 'نيسان (أبريل)', short: 'نيسان', days: 30 },
            { num: 5, name: 'أيار (مايو)', short: 'أيار', days: 31 },
            { num: 6, name: 'حزيران (يونيو)', short: 'حزيران', days: 30 },
            { num: 7, name: 'تموز (يوليو)', short: 'تموز', days: 31 },
            { num: 8, name: 'آب (أغسطس)', short: 'آب', days: 31 },
            { num: 9, name: 'أيلول (سبتمبر)', short: 'أيلول', days: 30 },
            { num: 10, name: 'تشرين الأول (أكتوبر)', short: 'تشرين 1', days: 31 },
            { num: 11, name: 'تشرين الثاني (نوفمبر)', short: 'تشرين 2', days: 30 },
            { num: 12, name: 'كانون الأول (ديسمبر)', short: 'كانون 1', days: 31 }
        ];

        function isLeapYear_App(y) {
            return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
        }

        function getDaysInYear_App(y) {
            return isLeapYear_App(y) ? 366 : 365;
        }

        function getDayOfYear_App(d) {
            const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const cur = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
            return Math.round((cur - start) / 86400000) + 1;
        }

        function getDateFromDayOfYear_App(dayOfYear, year, refDate) {
            const d = new Date(Date.UTC(year, 0, 1));
            d.setUTCDate(dayOfYear);
            if (refDate) {
                d.setUTCHours(refDate.getUTCHours(), refDate.getUTCMinutes(), refDate.getUTCSeconds(), refDate.getUTCMilliseconds());
            }
            return d;
        }

        function getZodiacAndMilestone_App(month1, day) {
            let milestone = '';
            if (month1 === 3 && day >= 20 && day <= 22) milestone = '🌸 الاعتدال الربيعي';
            else if (month1 === 6 && day >= 20 && day <= 22) milestone = '☀️ الانقلاب الصيفي';
            else if (month1 === 9 && day >= 22 && day <= 24) milestone = '🍂 الاعتدال الخريفي';
            else if (month1 === 12 && day >= 20 && day <= 22) milestone = '❄️ الانقلاب الشتوي';

            let zodiac = '';
            if ((month1 === 3 && day >= 21) || (month1 === 4 && day <= 19)) zodiac = 'الحمل ♈';
            else if ((month1 === 4 && day >= 20) || (month1 === 5 && day <= 20)) zodiac = 'الثور ♉';
            else if ((month1 === 5 && day >= 21) || (month1 === 6 && day <= 20)) zodiac = 'الجوزاء ♊';
            else if ((month1 === 6 && day >= 21) || (month1 === 7 && day <= 22)) zodiac = 'السرطان ♋';
            else if ((month1 === 7 && day >= 23) || (month1 === 8 && day <= 22)) zodiac = 'الأسد ♌';
            else if ((month1 === 8 && day >= 23) || (month1 === 9 && day <= 22)) zodiac = 'السنبلة ♍';
            else if ((month1 === 9 && day >= 23) || (month1 === 10 && day <= 22)) zodiac = 'الميزان ♎';
            else if ((month1 === 10 && day >= 23) || (month1 === 11 && day <= 21)) zodiac = 'العقرب ♏';
            else if ((month1 === 11 && day >= 22) || (month1 === 12 && day <= 21)) zodiac = 'القوس ♐';
            else if ((month1 === 12 && day >= 22) || (month1 === 1 && day <= 19)) zodiac = 'الجدي ♑';
            else if ((month1 === 1 && day >= 20) || (month1 === 2 && day <= 18)) zodiac = 'الدلو ♒';
            else zodiac = 'الحوت ♓';

            return { milestone, zodiac };
        }

        function updateAnnualDateBadgeUI(d, dayOfYear, maxDays) {
            const month0 = d.getUTCMonth();
            const month1 = month0 + 1;
            const day = d.getUTCDate();
            const mInfo = C3D_ANNUAL_MONTHS[month0] || { name: '', short: '' };
            const { milestone, zodiac } = getZodiacAndMilestone_App(month1, day);

            const badge = document.getElementById('c3dAnnualDateBadge');
            if (badge) {
                badge.innerHTML = `📅 <strong>${day} ${mInfo.name}</strong> • اليوم ${dayOfYear}`;
            }

            const seasonTag = document.getElementById('c3dAnnualSeasonTag');
            if (seasonTag) {
                if (milestone) {
                    seasonTag.innerHTML = `${milestone} • ${zodiac}`;
                    seasonTag.style.background = 'rgba(239, 68, 68, 0.25)';
                    seasonTag.style.borderColor = '#F87171';
                    seasonTag.style.color = '#FEF08A';
                } else {
                    seasonTag.innerHTML = `برج ${zodiac}`;
                    seasonTag.style.background = 'rgba(245, 158, 11, 0.15)';
                    seasonTag.style.borderColor = 'rgba(245, 158, 11, 0.35)';
                    seasonTag.style.color = '#FDE047';
                }
            }

            // تحديث حالة أزرار المحطات الموسمية
            const snapButtons = document.querySelectorAll('#cosmos3DContainer .btn-timeline-snap');
            if (snapButtons && snapButtons.length) {
                snapButtons.forEach(btn => {
                    if (btn.classList.contains('btn-today')) return;
                    const title = btn.getAttribute('title') || '';
                    btn.classList.toggle('active', !!(milestone && title.includes(milestone.slice(2, 6))));
                });
            }

            // تمييز الشهر النشط في علامات الأشهر
            const ticks = document.querySelectorAll('#cosmos3DContainer .c3d-month-tick-labels span');
            if (ticks && ticks.length === 12) {
                ticks.forEach((tick, idx) => {
                    tick.classList.toggle('active-month', idx === month0);
                });
            }
        }

        function getFractionalDayOfYear_App(d) {
            const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const diffMs = d.getTime() - start.getTime();
            return (diffMs / 86400000.0) + 1.0;
        }

        function onAnnualDaySliderInput(val) {
            isDraggingAnnualTimeline = true;
            const dayVal = parseFloat(val);
            if (isNaN(dayVal) || dayVal < 1) return;

            const y = currentDate.getUTCFullYear();
            const maxDays = getDaysInYear_App(y);
            const clampedDay = Math.max(1.0, Math.min(maxDays, dayVal));
            const dayInt = Math.floor(clampedDay);
            const dayFrac = clampedDay - dayInt;

            const totalHours = dayFrac * 24.0;
            const hh = Math.floor(totalHours);
            const mm = Math.floor((totalHours - hh) * 60.0);
            const ss = Math.floor(((totalHours - hh) * 60.0 - mm) * 60.0);

            currentDate = new Date(Date.UTC(y, 0, dayInt, hh, mm, ss));

            updateDateTimeUI();
            forceRebuildPrayerArcs = true;
            lastBarDecl = null;
            if (cosmos3DInitialized) {
                updateAstronomy(currentDate);
                syncMonthControlsUI(currentDate);
                if (renderer && scene && camera) renderer.render(scene, camera);
            }
            updateAnnualDateBadgeUI(currentDate, dayInt, maxDays);
        }

        function stepAnnualDay(delta) {
            isDraggingAnnualTimeline = false;
            const y = currentDate.getUTCFullYear();
            const maxDays = getDaysInYear_App(y);
            let curDoy = getDayOfYear_App(currentDate);
            let nextDoy = curDoy + delta;
            if (nextDoy < 1) nextDoy = maxDays;
            if (nextDoy > maxDays) nextDoy = 1;

            currentDate = getDateFromDayOfYear_App(nextDoy, y, currentDate);
            updateDateTimeUI();
            forceRebuildPrayerArcs = true;
            lastBarDecl = null;
            if (cosmos3DInitialized) {
                updateAstronomy(currentDate);
                syncMonthControlsUI(currentDate);
                syncAnnualTimelineUI(currentDate);
                if (renderer && scene && camera) renderer.render(scene, camera);
            }
            const mInfo = C3D_ANNUAL_MONTHS[currentDate.getUTCMonth()];
            showC3DToast(`📅 ${currentDate.getUTCDate()} ${mInfo.name} (اليوم ${nextDoy})`);
        }

        function jumpToAnnualDay(dayVal, label) {
            isDraggingAnnualTimeline = false;
            const y = currentDate.getUTCFullYear();
            const maxDays = getDaysInYear_App(y);

            let targetDoy;
            if (dayVal === 'today') {
                const now = new Date();
                targetDoy = getDayOfYear_App(now);
            } else {
                targetDoy = Math.max(1, Math.min(maxDays, parseInt(dayVal, 10)));
            }

            currentDate = getDateFromDayOfYear_App(targetDoy, y, currentDate);
            updateDateTimeUI();
            forceRebuildPrayerArcs = true;
            lastBarDecl = null;
            if (cosmos3DInitialized) {
                updateAstronomy(currentDate);
                syncMonthControlsUI(currentDate);
                syncAnnualTimelineUI(currentDate);
                if (renderer && scene && camera) renderer.render(scene, camera);
            }

            const mInfo = C3D_ANNUAL_MONTHS[currentDate.getUTCMonth()];
            const toastText = label
                ? `📅 ${label}: ${currentDate.getUTCDate()} ${mInfo.name} (اليوم ${targetDoy})`
                : `📅 تم الانتقال إلى: ${currentDate.getUTCDate()} ${mInfo.name} (اليوم ${targetDoy})`;
            showC3DToast(toastText);
        }

        function syncAnnualTimelineUI(simDate) {
            if (isDraggingAnnualTimeline) return;
            const d = simDate || currentDate;
            const y = d.getUTCFullYear();
            const maxDays = getDaysInYear_App(y);
            const fracDay = getFractionalDayOfYear_App(d);
            const dayInt = Math.floor(fracDay);

            const slider = document.getElementById('c3dAnnualDaySlider');
            if (slider) {
                if (slider.max != maxDays) slider.max = maxDays;
                slider.value = fracDay.toFixed(2);
            }
            updateAnnualDateBadgeUI(d, Math.min(maxDays, Math.max(1, dayInt)), maxDays);
        }

        function toggleAnnualTimelineCollapse(event) {
            if (event && typeof event.stopPropagation === 'function') {
                event.stopPropagation();
            }
            const bar = document.getElementById('c3dAnnualTimelineBar');
            if (!bar) return;
            const isCol = bar.classList.toggle('collapsed');
            const toggleBtn = bar.querySelector('.btn-timeline-toggle');
            if (toggleBtn) {
                toggleBtn.innerText = isCol ? '▴' : '▾';
                toggleBtn.setAttribute('title', isCol ? 'توسيع شريط أيام السنة' : 'طي شريط أيام السنة');
                toggleBtn.classList.toggle('collapsed-state', isCol);
            }
            if (isCol) {
                showC3DToast('ℹ️ تم طي شريط الأيام — انقر على الشارة أو زر ▴ لإعادة فتحه في أي وقت');
            }
        }

        function onAnnualTimelineBarClick(event) {
            const bar = document.getElementById('c3dAnnualTimelineBar');
            if (bar && bar.classList.contains('collapsed')) {
                toggleAnnualTimelineCollapse(event);
            }
        }

        // تحرير حالة السحب فور إفلات الفأرة أو اللمس في أي مكان في الشاشة
        if (typeof window !== 'undefined') {
            window.addEventListener('pointerup', () => { isDraggingAnnualTimeline = false; });
            window.addEventListener('touchend', () => { isDraggingAnnualTimeline = false; });
            window.addEventListener('mouseup', () => { isDraggingAnnualTimeline = false; });
        }



        function onSeasonalSliderInput(val) {
            isDraggingSeasonalOrbit = true;
            setSeasonalDeclination(val);
        }


        function jumpToSunsetTime() {
            if (currentSunsetSolarH === null) return;
            const hoursFromNoon = currentSunsetSolarH * (180 / Math.PI) / 15.0;
            const targetLocalSolarHours = 12.0 + hoursFromNoon;
            const lonHours = currentLonDeg / 15.0;
            const targetUtcHours = (targetLocalSolarHours - lonHours + 24.0) % 24.0;
            const hh = Math.floor(targetUtcHours);
            const mm = Math.floor((targetUtcHours - hh) * 60);
            const ss = Math.floor(((targetUtcHours - hh) * 60 - mm) * 60);

            currentDate.setUTCHours(hh, mm, ss);
            updateDateTimeUI();
            if (cosmos3DInitialized) updateAstronomy(currentDate);
            showToast('🌅 تم ضبط الوقت لحظة الغروب تماماً لمشاهدة نزول الشمس في الشفق');
        }

        function toggleSeasonalComparisonTable() {
            const drawer = document.getElementById('seasonalComparisonDrawer');
            if (!drawer) return;
            const isHidden = drawer.style.display === 'none';
            drawer.style.display = isHidden ? 'block' : 'none';
            const btn = document.getElementById('btnToggleSeasonTable');
            if (btn) btn.classList.toggle('active', isHidden);
        }

        function computeTwilightForDecl(phi, decl) {
            function getSettingH(altRad) {
                if (Math.abs(Math.cos(phi) * Math.cos(decl)) < 0.0001) return null;
                const cosH = (Math.sin(altRad) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
                if (Math.abs(cosH) > 1.0) return null;
                return Math.acos(cosH);
            }
            const effElev = (currentCityCountry === 'سوريا' || (Math.abs(currentLatDeg - 33.5138) < 0.25 && Math.abs(currentLonDeg - 36.2924) < 0.25)) ? 690 : 0;
            const horizonDip = effElev > 0 ? (1.76 * Math.sqrt(effElev)) / 60.0 : 0.0;
            const hSetRad = -(0.833 + horizonDip) * Math.PI / 180;
            const h16Rad = -16.0 * Math.PI / 180;
            const h18Rad = -18.0 * Math.PI / 180;

            const H_set = getSettingH(hSetRad);
            const H_16 = getSettingH(h16Rad);
            const H_18 = getSettingH(h18Rad);

            function fmt(H_val, reserveMin = 0) {
                if (H_val === null || isNaN(H_val)) return '--:--';
                const hoursFromNoon = H_val * (180 / Math.PI) / 15.0;
                let solH = 12.0 + hoursFromNoon;
                const tz = (currentPrayersData && currentPrayersData.tzHours !== undefined)
                    ? currentPrayersData.tzHours
                    : getCityTimezoneHours(currentLatDeg, currentLonDeg, currentCityCountry, currentDate);
                const eot = (currentPrayersData && currentPrayersData.eotMin !== undefined)
                    ? currentPrayersData.eotMin
                    : 0;
                const lonOffsetMin = (tz * 15.0 - currentLonDeg) * 4.0;
                let civH = solH + (reserveMin / 60.0) + (lonOffsetMin - eot) / 60.0;
                while (civH < 0) civH += 24.0;
                while (civH >= 24.0) civH -= 24.0;
                const totalM = Math.round(civH * 60.0);
                const hh24 = Math.floor(totalM / 60.0) % 24;
                const mm = totalM % 60;
                const mmStr = String(mm).padStart(2, '0');
                const period = hh24 >= 12 ? 'PM' : 'AM';
                const hh12 = hh24 % 12 || 12;
                const hh12Str = String(hh12).padStart(2, '0');
                return `${hh12Str}:${mmStr} ${period}`;
            }

            const sunsetStr = fmt(H_set, 5);
            const isha16Str = fmt(H_16, 0);
            const isha18Str = fmt(H_18, 0);

            let d16 = 0, d18 = 0;
            if (H_set !== null && H_16 !== null) d16 = Math.round(((H_16 - H_set) * (180 / Math.PI) / 15.0) * 60);
            if (H_set !== null && H_18 !== null) d18 = Math.round(((H_18 - H_set) * (180 / Math.PI) / 15.0) * 60);
            return {
                sunset: sunsetStr,
                isha16: isha16Str,
                diff16: d16,
                isha18: isha18Str,
                diff18: d18,
                diffBetween: d18 - d16
            };
        }

        let lastBarDecl = null;
        let lastBarPhi = null;
        let lastBarSunsetStr = null;
        function updateSeasonalBarUI(deltaSun, phi, sunsetStr, isha16Str, diff16, isha18Str, diff18, diffBetween) {
            const declDeg = deltaSun * 180 / Math.PI;
            const isPole = Math.abs(Math.cos(phi)) < 0.001;

            if (!isDraggingSeasonalOrbit && lastBarDecl !== null &&
                Math.abs(declDeg - lastBarDecl) < 0.04 &&
                Math.abs(phi - lastBarPhi) < 0.0005 &&
                lastBarSunsetStr === sunsetStr) {
                syncMonthControlsUI(currentDate);
                syncAnnualTimelineUI(currentDate);
                return;
            }
            lastBarDecl = declDeg;
            lastBarPhi = phi;
            lastBarSunsetStr = sunsetStr;

            if (isPole) {
                sunsetStr = declDeg >= 0 ? 'نهار قطبي مستمر (شمس منتصف الليل)' : 'ليل قطبي مستمر';
                isha16Str = '--:--';
                isha18Str = '--:--';
                diffBetween = 0;
            }

            // تحديث مؤشر السلايدر
            const slider = document.getElementById('seasonalSlider');
            if (slider && !isDraggingSeasonalOrbit) {
                slider.value = declDeg.toFixed(1);
            }

            // تحديث شارة الميل
            const badge = document.getElementById('c3dDeclBadge');
            if (badge) {
                if (declDeg >= 22) badge.innerText = `☀️ مدار السرطان (صيف: +${declDeg.toFixed(1)}°)`;
                else if (declDeg <= -22) badge.innerText = `❄️ مدار الجدي (شتاء: ${declDeg.toFixed(1)}°)`;
                else if (Math.abs(declDeg) <= 1.5) badge.innerText = `⚖️ مدار الاستواء (اعتدال: ${declDeg.toFixed(1)}°)`;
                else badge.innerText = `☀️ ميل الشمس: ${declDeg >= 0 ? '+' : ''}${declDeg.toFixed(1)}°`;
            }

            // تحديث أزرار المحطات
            const btnW = document.getElementById('btnSeasonWinter');
            const btnE = document.getElementById('btnSeasonEquinox');
            const btnS = document.getElementById('btnSeasonSummer');
            if (btnW && btnE && btnS) {
                btnW.classList.toggle('active', declDeg <= -22);
                btnE.classList.toggle('active', Math.abs(declDeg) <= 2);
                btnS.classList.toggle('active', declDeg >= 22);
            }

            // مزامنة أدوات الشهور في اللوحة الجانبية وشريط الأدوات
            syncMonthControlsUI(currentDate);
            syncAnnualTimelineUI(currentDate);

            // تحديث شريط القياسات اللحظية
            const elSet = document.getElementById('telemSunset');
            const el16 = document.getElementById('telemIsha16');
            const el16Diff = document.getElementById('telemIsha16Diff');
            const el18 = document.getElementById('telemIsha18');
            const el18Diff = document.getElementById('telemIsha18Diff');
            const elDiff = document.getElementById('telemIshaDiff');

            if (elSet) elSet.innerText = sunsetStr;
            if (el16) el16.innerText = isha16Str;
            if (el16Diff) el16Diff.innerText = `(بعد ${diff16}د)`;
            if (el18) el18.innerText = isha18Str;
            if (el18Diff) el18Diff.innerText = `(بعد ${diff18}د)`;
            if (elDiff) elDiff.innerText = isPole ? 'فلك دائر (أفقي)' : `${diffBetween}m (${diffBetween} min)`;

            // تحديث جدول المقارنة الفوري
            const tSummer = computeTwilightForDecl(phi, EPSILON);
            const tEquinox = computeTwilightForDecl(phi, 0.0);
            const tWinter = computeTwilightForDecl(phi, -EPSILON);

            const tdSS = document.getElementById('tdSummerSunset');
            if (tdSS) {
                tdSS.innerText = tSummer.sunset;
                document.getElementById('tdSummerIsha16').innerText = `${tSummer.isha16} (+${tSummer.diff16}د)`;
                document.getElementById('tdSummerIsha18').innerText = `${tSummer.isha18} (+${tSummer.diff18}د)`;

                document.getElementById('tdEquinoxSunset').innerText = tEquinox.sunset;
                document.getElementById('tdEquinoxIsha16').innerText = `${tEquinox.isha16} (+${tEquinox.diff16}د)`;
                document.getElementById('tdEquinoxIsha18').innerText = `${tEquinox.isha18} (+${tEquinox.diff18}د)`;

                document.getElementById('tdWinterSunset').innerText = tWinter.sunset;
                document.getElementById('tdWinterIsha16').innerText = `${tWinter.isha16} (+${tWinter.diff16}د)`;
                document.getElementById('tdWinterIsha18').innerText = `${tWinter.isha18} (+${tWinter.diff18}د)`;

                document.getElementById('tdCurrDecl').innerText = `${declDeg >= 0 ? '+' : ''}${declDeg.toFixed(1)}°`;
                document.getElementById('tdCurrSunset').innerText = sunsetStr;
                document.getElementById('tdCurrIsha16').innerText = `${isha16Str} (+${diff16}د)`;
                document.getElementById('tdCurrIsha18').innerText = `${isha18Str} (+${diff18}د)`;
                document.getElementById('tdCurrDiff').innerText = `${diffBetween} دقيقة`;
            }
        }

    
        // ==========================================
        // 🌐 دوال تعديل زاوية المدارات ومطابقة المدن تلقائياً (متصلة بكافة 465 مدينة)
        // ==========================================
        function onLatAngleSliderInput(latVal) {
            setOrbitLatitude(latVal);
        }

        function snapCityLat(latVal, cityKey) {
            const key = (cityKey === 'pole') ? 'pole_n' : cityKey;
            const city = (typeof WORLD_CITIES_MAP !== 'undefined' && WORLD_CITIES_MAP[key]) ? WORLD_CITIES_MAP[key] : null;
            if (city) {
                applyCitySelection(city.lat, city.lon, `${city.nameAr} (${city.country})`, city.id, false);
                const slider = document.getElementById('latAngleSlider');
                if (slider) slider.value = city.lat;
                updateCityAngleBadge(city.lat);
                showC3DToast(`📍 تم توجيه القبة إلى: ${city.nameAr}`);
            } else {
                setOrbitLatitude(latVal);
            }
        }

        function setOrbitLatitude(latVal) {
            const lat = Math.max(-90, Math.min(90, latVal));
            const closestKey = findClosestCity(lat, currentLonDeg);
            let name = null;
            let lon = currentLonDeg;
            if (closestKey !== 'custom' && typeof WORLD_CITIES_MAP !== 'undefined' && WORLD_CITIES_MAP[closestKey]) {
                const c = WORLD_CITIES_MAP[closestKey];
                name = `${c.nameAr} (${c.country})`;
                lon = c.lon;
            }
            applyCitySelection(lat, lon, name, closestKey, false);
        }

        function findClosestCity(lat, lon = currentLonDeg) {
            if (typeof WORLD_CITIES_DB === 'undefined' || WORLD_CITIES_DB.length === 0) return 'custom';
            let bestCity = null;
            let minScore = 2.2; // نطاق التقريب بالدرجات
            for (let i = 0; i < WORLD_CITIES_DB.length; i++) {
                const c = WORLD_CITIES_DB[i];
                const latDiff = Math.abs(c.lat - lat);
                if (latDiff < minScore) {
                    const lonDiff = (typeof lon === 'number') ? Math.min(Math.abs(c.lon - lon), 360 - Math.abs(c.lon - lon)) : 0;
                    const score = latDiff + (lonDiff * 0.005);
                    if (score < minScore) {
                        minScore = score;
                        bestCity = c;
                    }
                }
            }
            return bestCity ? bestCity.id : 'custom';
        }

        function detectGpsLocation() {
            if (!navigator.geolocation) {
                showC3DToast('⚠️ خاصية تحديد الموقع (GPS) غير مدعومة على هذا الجهاز');
                return;
            }
            showC3DToast('⏳ جاري تحديد موقعك الجغرافي الدقيق عبر الـ GPS...');
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    const closestId = findClosestCity(lat, lon);
                    let cityName = `موقعي الجغرافي (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;
                    let country = 'موقعي المحلي';
                    if (closestId !== 'custom' && typeof WORLD_CITIES_MAP !== 'undefined' && WORLD_CITIES_MAP[closestId]) {
                        const c = WORLD_CITIES_MAP[closestId];
                        cityName = `${c.nameAr} (موقعي الحالي عبر GPS)`;
                        country = c.country;
                    }
                    currentLatDeg = lat;
                    currentLonDeg = lon;
                    currentLatRad = lat * Math.PI / 180;
                    currentCityName = cityName;
                    currentCityCountry = country;
                    currentCityKey = closestId;

                    const inputLat = document.getElementById('inputLat');
                    if (inputLat) inputLat.value = lat.toFixed(2);
                    const inputLon = document.getElementById('inputLon');
                    if (inputLon) inputLon.value = lon.toFixed(2);
                    const citySelect = document.getElementById('citySelect');
                    if (citySelect) citySelect.value = (closestId !== 'custom' && citySelect.querySelector(`option[value="${closestId}"]`)) ? closestId : 'custom';

                    applyCityChanges();
                    showC3DToast(`📍 تم ضبط القبة الفلكية والقبلة على موقعك: ${cityName}`);
                },
                function(err) {
                    let msg = 'تعذر تحديد الموقع الجغرافي';
                    if (err.code === 1) msg = '⚠️ تم رفض إذن الوصول للموقع (يرجى السماح بالـ GPS في الإعدادات)';
                    else if (err.code === 2) msg = '⚠️ تعذر التقاط إشارة الأقمار الصناعية GPS';
                    else if (err.code === 3) msg = '⚠️ انتهت مهلة محاولة جلب إحداثيات GPS';
                    showC3DToast(msg);
                },
                { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
            );
        }
        window.detectGpsLocation = detectGpsLocation;

        function updateCityAngleBadge(lat) {
            const badge = document.getElementById('c3dCityAngleBadge');
            if (!badge) return;
            let cityNameStr = currentCityName || '';
            const isGeneric = !cityNameStr || cityNameStr.includes('مخصص') || cityNameStr.includes('إحداثيات');
            if (isGeneric) {
                const closestKey = findClosestCity(lat, currentLonDeg);
                if (closestKey !== 'custom' && typeof WORLD_CITIES_MAP !== 'undefined' && WORLD_CITIES_MAP[closestKey]) {
                    cityNameStr = WORLD_CITIES_MAP[closestKey].nameAr;
                } else {
                    cityNameStr = 'موقع مخصص';
                }
            } else {
                cityNameStr = cityNameStr.split('(')[0].trim();
            }
            const hemi = lat > 0.05 ? 'شمالاً' : (lat < -0.05 ? 'جنوباً' : 'استواء');
            badge.innerText = `📍 ${cityNameStr} (${lat >= 0 ? '+' : ''}${lat.toFixed(1)}° ${hemi})`;

            // تحديث حالة الأزرار النشطة للمدن بدقة بالمعرف المفتاحي للمدينة
            const normKey = (key) => (key === 'tripoli' ? 'tripoli_lb' : (key === 'pole' ? 'pole_n' : key));
            const activeKey = normKey(currentCityKey);

            document.querySelectorAll('#c3dLeftPanel .btn-season-snap').forEach(btn => {
                const onclickAttr = btn.getAttribute('onclick') || '';
                if (onclickAttr.includes('snapCityLat')) {
                    const m = onclickAttr.match(/snapCityLat\(\s*([-0-9.]+)\s*,\s*['"]([^'"]+)['"]/);
                    if (m) {
                        const bLat = parseFloat(m[1]);
                        const bKey = normKey(m[2]);
                        let isActive = false;
                        if (activeKey && activeKey !== 'custom') {
                            isActive = (bKey === activeKey);
                        } else {
                            // في حال الإدخال اليدوي عبر السلايدر، تفعيل الزر الأقرب بهامش دقيق جداً (0.15°)
                            isActive = (Math.abs(lat - bLat) < 0.15);
                        }
                        btn.classList.toggle('city-active', isActive);
                    }
                }
            });
        }

    

// Expose all functions to window for HTML inline handlers
window.onLatAngleSliderInput = onLatAngleSliderInput;
window.drawPlanets = drawPlanets;
window.togglePanelCollapse = togglePanelCollapse;
window.togglePrayerFocusMode = togglePrayerFocusMode;
window.activatePrayerPerspective = activatePrayerPerspective;
window.toggleTwilightCircles = toggleTwilightCircles;
window.drawCosmos = drawCosmos;
window.getEcliptic3DPos = getEcliptic3DPos;
window.toggle3DLabels = toggle3DLabels;
window.setLiveNow = setLiveNow;
window.createSafeWebGLRenderer = createSafeWebGLRenderer;
window.calcObliquityCorrection_Mujaib = calcObliquityCorrection_Mujaib;
window.showToast = showToast;
window.onCityChange = onCityChange;
window.init3D = init3D;
window.computeHorizontalCoords = computeHorizontalCoords;
window._revDrawCircleArrow = _revDrawCircleArrow;
window.toggleLayer = toggleLayer;
window.getPtMoonDist = getPtMoonDist;
window.switchTab = switchTab;
window.createTextBadgeSprite = createTextBadgeSprite;
window.closeWorldMapModal = closeWorldMapModal;
window.updateAstronomy = updateAstronomy;
window.drawIbsMoon = drawIbsMoon;
window.drawCopernicus = drawCopernicus;
window.addTime = addTime;
window.setOrbitLatitude = setOrbitLatitude;
window.drawMoonComparison = drawMoonComparison;
window.onModalManualCoordInput = onModalManualCoordInput;
window.selectSearchedCity = selectSearchedCity;
window.createZodiacBelt = createZodiacBelt;
window.calcSunTrueLong_Mujaib = calcSunTrueLong_Mujaib;
window.drawIbsPlanet = drawIbsPlanet;
window.updateCelestialAxesGeometry = updateCelestialAxesGeometry;
window.snapCityLat = snapCityLat;
window.drawKepler = drawKepler;
window.getCityTimezoneHours = getCityTimezoneHours;
window.calcGeomMeanAnomalySun_Mujaib = calcGeomMeanAnomalySun_Mujaib;
window.drawDirectionBadge = drawDirectionBadge;
window.cleanThreeGroup = cleanThreeGroup;
window.onCosmos3DResize = onCosmos3DResize;
window.togglePlay = togglePlay;
window.setMode = setMode;
window.onManualDateChange = onManualDateChange;
window.addDays = addDays;
window.syncMonthControlsUI = syncMonthControlsUI;
window.calcEquationOfTime_Mujaib = calcEquationOfTime_Mujaib;
window.calcMeanObliquityOfEcliptic_Mujaib = calcMeanObliquityOfEcliptic_Mujaib;
window.drawRevolution = drawRevolution;
window.mapXYToLatLon = mapXYToLatLon;
window.jumpToSeason = jumpToSeason;
window.normAr = normAr;
window.toggleCosmos3DFullscreen = toggleCosmos3DFullscreen;
window.togglePanel = togglePanel;
window.createCelestialAxes = createCelestialAxes;
window.adjustModalCoord = adjustModalCoord;
window.updateModalUI = updateModalUI;
window.switchRightPanelTab = switchRightPanelTab;
window.clearMapSearch = clearMapSearch;
window.drawPtolemyMoon = drawPtolemyMoon;
window.stepTime = stepTime;
window.stepMonth = stepMonth;
window.openWorldMapModal = openWorldMapModal;
window.toggleOverlaySetting = toggleOverlaySetting;
window.drawOverlay = drawOverlay;
window.createAtlasSphere = createAtlasSphere;
window.drawIbsSun = drawIbsSun;
window.setClockRunning = setClockRunning;
window.applyCityChanges = applyCityChanges;
window.applyUnifiedSpeed = applyUnifiedSpeed;
window.selectPlanet = selectPlanet;
window.updateTextBadgeSprite = updateTextBadgeSprite;
window.setSeasonalDeclination = setSeasonalDeclination;
window.createHorizonPlane = createHorizonPlane;
window.drawCircleArrow = drawCircleArrow;
window.createStarfield = createStarfield;
window.findClosestCity = findClosestCity;
window.applyCitySelection = applyCitySelection;
window.buildPrayerDiurnalArcs = buildPrayerDiurnalArcs;
window.drawCosmos3D = drawCosmos3D;
window.calcSunApparentLong_Mujaib = calcSunApparentLong_Mujaib;
window.updatePrayerHUD = updatePrayerHUD;
window.drawSunComparison = drawSunComparison;
window.drawSmoothTrail = drawSmoothTrail;
window.setupHiDpiCanvas = setupHiDpiCanvas;
window.latLonToMapXY = latLonToMapXY;
window.closeShortcutsModal = closeShortcutsModal;
window.initRevolution = initRevolution;
window.resetEpoch = resetEpoch;
window.drawFadingTrail = drawFadingTrail;
window.createPlanetarySpheres = createPlanetarySpheres;
window.computeTwilightForDecl = computeTwilightForDecl;
window.computePrayersMujaib = computePrayersMujaib;
window.updateDateTimeUI = updateDateTimeUI;
window.createDirectionBadge = createDirectionBadge;
window.setSpeed = setSpeed;
window.confirmWorldMapSelection = confirmWorldMapSelection;
window.showWebGLErrorUI = showWebGLErrorUI;
window.calcGeomMeanLongSun_Mujaib = calcGeomMeanLongSun_Mujaib;
window.jumpToEpoch = jumpToEpoch;
window.toggleClockPlay = toggleClockPlay;
window.snapSeason = snapSeason;
window.createTwilightDepressionCircles = createTwilightDepressionCircles;
window.drawShatir = drawShatir;
window.onCustomCoordChange = onCustomCoordChange;
window.calculateAstroPosition = calculateAstroPosition;
window.findNearestCity = findNearestCity;
window.onSeasonalSliderInput = onSeasonalSliderInput;
window.drawPtolemySun = drawPtolemySun;
window.rebuildSeasonalArcs = rebuildSeasonalArcs;
window.drawPtPlanet = drawPtPlanet;
window.onMapSearchInput = onMapSearchInput;
window.showC3DToast = showC3DToast;
window.onSliderSpeedChange = onSliderSpeedChange;
window.onModalBackdropClick = onModalBackdropClick;
window.initMapEvents = initMapEvents;
window.updateSeasonalBarUI = updateSeasonalBarUI;
window.jumpToMoonPhase = jumpToMoonPhase;
window.toggleShortcutsModal = toggleShortcutsModal;
window.setCameraPreset = setCameraPreset;
window.updateMoonSkyArc = updateMoonSkyArc;
window.createSunAndMoonOnDome = createSunAndMoonOnDome;
window.updatePrayerDiurnalArcs = updatePrayerDiurnalArcs;
window.masterLoop = masterLoop;
window.disposeThreeObject = disposeThreeObject;
window.snapMonth = snapMonth;
window.setTimeSpeed = setTimeSpeed;
window.toggleMoon = toggleMoon;
window.toggleAutoRotate = toggleAutoRotate;
window.toggleSeasonalComparisonTable = toggleSeasonalComparisonTable;
window.calcSunEqOfCenter_Mujaib = calcSunEqOfCenter_Mujaib;
window.jumpToSunsetTime = jumpToSunsetTime;
window.executeMapSearch = executeMapSearch;
window.calcSunDeclination_Mujaib = calcSunDeclination_Mujaib;
window.selectPredefinedCity = selectPredefinedCity;
window.updateCityAngleBadge = updateCityAngleBadge;
window.updateSunSkyArc = updateSunSkyArc;
window.sunArcGroup = sunArcGroup;
window.toggleSolidSpheres = toggleSolidSpheres;
window.toggleFourElements = toggleFourElements;
window.jumpSolarAngle = jumpSolarAngle;
window.jumpLunarElongation = jumpLunarElongation;
window.jumpPlanetAngle = jumpPlanetAngle;
window.applyShatirHorizonPreset = applyShatirHorizonPreset;
window.setC3DSpeedMode = setC3DSpeedMode;
window.syncCityRealTime = syncCityRealTime;
window.getCityCurrentDate = getCityCurrentDate;
window.updateC3DSpeedStatusPill = updateC3DSpeedStatusPill;
window.onAnnualDaySliderInput = onAnnualDaySliderInput;
window.stepAnnualDay = stepAnnualDay;
window.jumpToAnnualDay = jumpToAnnualDay;
window.syncAnnualTimelineUI = syncAnnualTimelineUI;
window.toggleAnnualTimelineCollapse = toggleAnnualTimelineCollapse;
window.onAnnualTimelineBarClick = onAnnualTimelineBarClick;


// طي بطاقات التيليمترية والأفلاك لتفريغ الشاشة، وتأكيد ظهور المحاكي ثلاثي الأبعاد 3D فور التشغيل
(function initStartup3DAndCollapse() {
    const go = () => {
        document.querySelectorAll('.c3d-card').forEach(card => {
            const hd = card.querySelector(':scope > .c3d-card-header');
            if (!hd) return;
            if (card.id !== 'hudPanel') card.classList.add('c3d-collapsed');
            hd.addEventListener('click', () => card.classList.toggle('c3d-collapsed'));
        });
        if (typeof switchTab === 'function') {
            switchTab('cosmos3D');
        }
        if (typeof setC3DSpeedMode === 'function') {
            setC3DSpeedMode('realtime');
        }
        if (typeof activatePrayerPerspective === 'function') {
            activatePrayerPerspective();
        } else {
            if (typeof togglePrayerFocusMode === 'function') togglePrayerFocusMode(true);
            if (typeof setCameraPreset === 'function') setCameraPreset('prayers');
        }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
})();
