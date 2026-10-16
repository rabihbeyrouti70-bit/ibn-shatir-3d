import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    toSexagesimal,
    intToAbjad,
    SHATIR_CONSTANTS,
    computeShatirSolarGeometry,
    computeShatirLunarGeometry,
    computeShatirPlanetGeometry,
    SHATIR_COSMIC_SCALE,
    SHATIR_FIVE_HORIZONS
} from '../js/nihayat-al-sul-engine.js';

describe('Nihāyat al-Sūl Scientific Engine (نهاية السول في تصحيح الأصول)', () => {
    it('converts numbers to exact Sexagesimal and Arabic Abjad (حساب الجُمَّل)', () => {
        const s1 = toSexagesimal(67 + 7 / 60);
        assert.equal(s1.parts, 67);
        assert.equal(s1.minutes, 7);
        assert.equal(s1.abjadShort, 'سز ز');

        const s2 = toSexagesimal(52 + 53 / 60);
        assert.equal(s2.parts, 52);
        assert.equal(s2.minutes, 53);
        assert.equal(s2.abjadShort, 'نب نج');

        assert.equal(intToAbjad(60), 'س');
        assert.equal(intToAbjad(0), '٠');
    });

    it('implements Ibn al-Shatir exact Solar Model (Chapters 3–6)', () => {
        // Apogee (alpha = 0): Distance = 60 + 4;37 + 2;30 = 67;07
        const apo = computeShatirSolarGeometry(0);
        assert.ok(Math.abs(apo.dist - (67 + 7 / 60)) < 1e-6);
        assert.ok(Math.abs(apo.equationDeg) < 1e-6);

        // Perigee (alpha = PI): Distance = 60 - 4;37 - 2;30 = 52;53
        const peri = computeShatirSolarGeometry(Math.PI);
        assert.ok(Math.abs(peri.dist - (52 + 53 / 60)) < 1e-6);
        assert.ok(Math.abs(peri.equationDeg) < 1e-6);

        // Max Solar Equation at alpha = 97° (3 signs 7 degrees) ≈ 2° 02'
        const maxEq = computeShatirSolarGeometry(97 * Math.PI / 180);
        assert.ok(maxEq.equationDeg > 2.02 && maxEq.equationDeg < 2.05);
    });

    it('implements Ibn al-Shatir exact Lunar Model (Chapters 7–9)', () => {
        // Syzygy (elongation = 0, anomaly = 0): Distance = 60 + 6;35 - 1;25 = 65;10
        const syzApo = computeShatirLunarGeometry(0, 0, 0, 0);
        assert.ok(Math.abs(syzApo.dist - (65 + 10 / 60)) < 1e-6);

        // Quadrature (elongation = 90°, anomaly = 0): Distance = 60 + 6;35 + 1;25 = 68;00
        const quadApo = computeShatirLunarGeometry(0, 0, Math.PI / 2, 0);
        assert.ok(Math.abs(quadApo.dist - 68.0) < 1e-6);

        // Quadrature Perigee (elongation = 90°, anomaly = 180°): Distance = 60 - 6;35 - 1;25 = 52;00 (vs Ptolemy's 34;07!)
        const quadPeri = computeShatirLunarGeometry(0, Math.PI, Math.PI / 2, 0);
        assert.ok(Math.abs(quadPeri.dist - 52.0) < 1e-6);
        assert.ok(quadPeri.ptolemyDist < 35.0);
    });

    it('implements Mercury 7-Orb Model with Muhit & Hafiz Tusi Couple (Chapters 19–23)', () => {
        // At Apogee (kappa = 0): effective epicycle radius = 22;46 - 1;06 = 21;40
        const mercApo = computeShatirPlanetGeometry('mercury', 0, 0);
        assert.ok(Math.abs(mercApo.effectiveR3 - (21 + 40 / 60)) < 1e-6);
        assert.ok(mercApo.muhitHafiz !== null);

        // At Quadrature (kappa = 90°): effective epicycle radius = 22;46 + 1;06 = 23;52
        const mercQuad = computeShatirPlanetGeometry('mercury', Math.PI / 2, 0);
        assert.ok(Math.abs(mercQuad.effectiveR3 - (23 + 52 / 60)) < 1e-6);

        // At Perigee (kappa = 180°): effective epicycle radius = 21;40
        const mercPeri = computeShatirPlanetGeometry('mercury', Math.PI, 0);
        assert.ok(Math.abs(mercPeri.effectiveR3 - (21 + 40 / 60)) < 1e-6);
    });

    it('includes Chapter 31 Cosmic Scale and Part II Five Horizons', () => {
        assert.equal(SHATIR_COSMIC_SCALE.length, 9);
        assert.equal(SHATIR_FIVE_HORIZONS.length, 5);
        assert.ok(Math.abs(SHATIR_CONSTANTS.OBLIQUITY_DEG - 23.516667) < 1e-4);
    });
});
