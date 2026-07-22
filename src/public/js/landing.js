import * as THREE from 'three';

const PARTICLES_COUNT = 1500;
const MOBILE_PARTICLES_COUNT = 600;
const STAGE_COUNT = 5;
const COLOR = {
    sky: new THREE.Color(0x38BDF8),
    mint: new THREE.Color(0x3FCF8E),
    white: new THREE.Color(0xFFFFFF),
    dim: new THREE.Color(0x334155),
    glow: new THREE.Color(0x7DD3FC),
    amber: new THREE.Color(0xFBBF24),

}
function isMobile() {
    return window.innerWidth < 768
}

function prefersREducedMotion() {
    return window.matchMedia('(prefers-reduced-motion:reduce').matches
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}
function lerpColor(c1, c2, t) {
    return new THREE.Color().lerpColors(c1, c2, t);
}
function smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
}
class HowItWorksScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.count = isMobile() ? MOBILE_PARTICLES_COUNT : PARTICLES_COUNT;
        this.progress = 0;
        this.active = false;
        this.destroyed = false;
        this.reducedMotion = prefersREducedMotion();
        this.time = 0;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
        this.camera.position.set(0, 0, 30);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: false });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this._resize();
        this._initParticles();
        this._initStages();
        this._bindEvents();
        this._animate();
    }

    _initParticles() {
        const n = this.count;
        const positions = new Float32Array(n * 3)
        const colors = new Float32Array(n * 3)
        const sizes = new Float32Array(n)

        this.particles = []
        for (let i = 0; i < n; i++) {
            const x = (Math.random() - 0.5) * 40;
            const y = (Math.random() - 0.5) * 20;
            const z = (Math.random() - 0.5) * 20;
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            colors[i * 3] = COLOR.dim.r;
            colors[i * 3 + 1] = COLOR.dim.g;
            colors[i * 3 + 2] = COLOR.dim.b;
            sizes[i] = .15 + Math.random() * .1;

            this.particles.push({
                base: new THREE.Vector3(x, y, z),
                current: new THREE.Vector3(x, y, z),
                stageTargets: [],
                colorTargets: [],
                sizeTargets: [],
                phase: Math.random() * Math.PI * 2,
                speed: 0.3 + Math.random() * 0.7,
            })
        }

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
        this.material = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.points = new THREE.Points(this.geometry, this.material)
        this.scene.add(this.points)
    }
    _initStages() {
        const n = this.count;
        const isMobileView = isMobile();
        const spread = isMobileView ? 12 : 20

        for (let i = 0; i < n; i++) {
            const p = this.particles[i];
            const angle = (i / n) * Math.PI * 2;
            const ring = Math.floor(i / (n / 5));
            const ringAngle = (i % (n / 5)) / (n / 5) * Math.PI * 2;

            // the intial stage of the particles (when you input)
            const wordShapeX = Math.cos(angle) * (2 + Math.sin(angle * 3) * 0.8);
            const wordShapeY = Math.sin(angle) * 1.5 + Math.cos(angle * 5) * 0.3;
            p.stageTargets[0] = new THREE.Vector3(wordShapeX, wordShapeY, (Math.random() - 0.5) * 1);
            p.colorTargets[0] = COLOR.sky.clone();
            p.sizeTargets[0] = 0.18;

            // the second stage of the particles (when you click generate) and the word start being tokinezied
            const tokenGroup = ring % 4;
            const tokenAngle = tokenGroup * (Math.PI / 2) + Math.PI / 4;
            const tokenRadius = 3 + tokenGroup * 1.5;
            const tokenSpread = 1.5;
            p.stageTargets[1] = new THREE.Vector3(
                Math.cos(tokenAngle) * tokenRadius + (Math.random() - 0.5) * tokenSpread,
                Math.sin(tokenAngle) * tokenRadius + (Math.random() - 0.5) * tokenSpread,
                (Math.random() - 0.5) * 2
            );

            p.colorTargets[3] = lerpColor(COLOR.mint, COLOR.sky, 0.3);
            p.sizeTargets[1] = 0.16;

            // the third stage of the particles (when the tokens are being embedded into 3d vector space (sure won't create a 1024D space lol))
            const theta = Math.acos(2 * (i / n) - 1);
            const phi = (1 + Math.sqrt(5)) * i * Math.PI;
            const embedRadius = spread * 0.6;
            p.stageTargets[2] = new THREE.Vector3(
                embedRadius * Math.sin(theta) * Math.cos(phi),
                embedRadius * Math.sin(theta) * Math.sin(phi),
                embedRadius * Math.cos(theta)
            );

            const hueT = i / n;
            p.colorTargets[3] = lerpColor(COLOR.mint, COLOR.sky, 0.3);

            p.sizeTargets[2] = 0.12 + Math.random() * 0.08;

            // the fourth stage of the particles (when partcles converge int a tight spherical shell (the database))
            const storeRadius = 5;
            p.stageTargets[3] = new THREE.Vector3(storeRadius * Math.sin(theta) * Math.cos(phi), storeRadius * Math.sin(theta) * Math.sin(phi), storeRadius * Math.cos(theta));
            p.colorTargets[3] = lerpColor(COLOR.mint, COLOR.sky, 0.3);

            p.sizeTargets[3] = 0.1;

            // the fifth stage of the particles (when the particles are retrieved by similarity)
            const isMatch = i < n * 0.2;
            if (isMatch) {
                const matchAngle = (i / (n * 0.2)) * Math.PI * 2;
                p.stageTargets[4] = new THREE.Vector3(
                    Math.cos(matchAngle) * 2.5,
                    Math.sin(matchAngle) * 2.5 - 1,
                    8
                );
                p.colorTargets[4] = COLOR.white.clone();
                p.sizeTargets[4] = 0.25;
            } else {
                p.stageTargets[4] = new THREE.Vector3(
                    p.base.x * 1.5,
                    p.base.y * 1.5,
                    p.base.z - 5
                );
                p.colorTargets[4] = COLOR.dim.clone();
                p.sizeTargets[4] = 0.06;
            }
        }
    }

    updateProgress(progress) {
        this.progress = Math.max(0, Math.min(1, progress));
    }

    _animate() {
        if (this.destroyed) return;
        requestAnimationFrame(() => this._animate());

        if (!this.active) return;
        if (this.reducedMotion) return;

        this.time += 0.016;

        const stageFloat = this.progress * (STAGE_COUNT - 1);
        const stageFrom = Math.min(Math.floor(stageFloat), STAGE_COUNT - 2);
        const stageTo = stageFrom + 1;
        const t = stageFloat - stageFrom;

        const posAttr = this.geometry.getAttribute('position');
        const colorAttr = this.geometry.getAttribute('color');
        const sizeAttr = this.geometry.getAttribute('size');

        for (let i = 0; i < this.count; i++) {
            const p = this.particles[i];
            const from = p.stageTargets[stageFrom];
            const to = p.stageTargets[stageTo];
            const cFrom = p.colorTargets[stageFrom];
            const cTo = p.colorTargets[stageTo];
            const sFrom = p.sizeTargets[stageFrom];
            const sTo = p.sizeTargets[stageTo];

            const floatX = Math.sin(this.time * 0.5 + p.phase) * 0.15 * p.speed;
            const floatY = Math.cos(this.time * 0.4 + p.phase * 1.3) * 0.1 * p.speed;

            posAttr.array[i * 3] = lerp(from.x, to.x, t) + floatX;
            posAttr.array[i * 3 + 1] = lerp(from.y, to.y, t) + floatY;
            posAttr.array[i * 3 + 2] = lerp(from.z, to.z, t);

            colorAttr.array[i * 3] = lerp(cFrom.r, cTo.r, t);
            colorAttr.array[i * 3 + 1] = lerp(cFrom.g, cTo.g, t);
            colorAttr.array[i * 3 + 2] = lerp(cFrom.b, cTo.b, t);

            sizeAttr.array[i] = lerp(sFrom, sTo, t);
        }

        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;

        const cameraOrbit = smoothstep(0.2, 0.6, this.progress) * (1 - smoothstep(0.7, 1.0, this.progress));
        const camAngle = this.time * 0.15;
        this.camera.position.x = Math.sin(camAngle) * 5 * cameraOrbit;
        this.camera.position.y = Math.cos(camAngle * 0.7) * 2 * cameraOrbit;
        this.camera.position.z = 30 - cameraOrbit * 5;
        this.camera.lookAt(0, 0, 0);

        this.renderer.render(this.scene, this.camera);
    }

    _resize() {
        const section = document.getElementById('how-it-works');
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const w = rect.width || window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    _bindEvents() {
        this._onScroll = () => {
            const section = document.getElementById('how-it-works');
            if (!section) return;
            const rect = section.getBoundingClientRect();
            const totalScroll = rect.height - window.innerHeight;
            if (totalScroll <= 0) return;
            const scrolled = -rect.top;
            const progress = Math.max(0, Math.min(1, scrolled / totalScroll));
            this.updateProgress(progress);
            this._updateLabels(progress);
            this._updateProgressFill(progress);
        };

        const section = document.getElementById('how-it-works');
        if (section) {
            this._observer = new IntersectionObserver(
                ([entry]) => {
                    this.active = entry.isIntersecting;
                    if (entry.isIntersecting && this.reducedMotion) {
                        this.updateProgress(0.5);
                        this._updateLabels(0.5);
                        this._updateProgressFill(0.5);
                    }
                },
                { threshold: 0.05 }
            );
            this._observer.observe(section);
        }

        this._onResize = () => {
            this._resize();
            this._initStages();
        };

        window.addEventListener('scroll', this._onScroll, { passive: true });
        window.addEventListener('resize', this._onResize);
    }

    _updateLabels(progress) {
        const stageFloat = progress * (STAGE_COUNT - 1);
        const currentStage = Math.round(stageFloat);
        const stages = document.querySelectorAll('.hiw-stage');
        stages.forEach((el, i) => {
            el.setAttribute('data-active', i === currentStage ? 'true' : 'false');
        });
    }

    _updateProgressFill(progress) {
        const fill = document.getElementById('hiw-progress-fill');
        if (fill) {
            fill.style.width = (progress * 100) + '%';
        }
    }

    _destroy() {
        this.destroyed = true;
        window.removeEventListener('scroll', this._onScroll);
        window.removeEventListener('resize', this._onResize);
        if (this._observer) this._observer.disconnect();
        this.geometry.dispose();
        this.material.dispose();
        this.renderer.dispose();
    }

}
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('hiw-canvas');
    if (!canvas) return;

    const scene = new HowItWorksScene(canvas);
});