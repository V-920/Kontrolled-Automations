/* =========================================================
   KONTROLLED — HOME PAGE
   Particle / constellation animation and shared footer year.
   ========================================================= */

(() => {
    const canvas = document.getElementById("universe");
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    const pointer = { x: -1000, y: -1000, active: false };
    const GOLD = "227,184,92";

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let frame = 0;

    function createParticles() {
        const count = Math.max(
            65,
            Math.min(150, Math.round((width * height) / 10500))
        );

        particles = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            radius: 0.7 + Math.random() * 1.35,
            phase: Math.random() * Math.PI * 2,
            twinkle: 0.35 + Math.random() * 0.65
        }));
    }

    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        createParticles();

        if (reducedMotion) drawFrame();
    }

    function drawFrame() {
        ctx.clearRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(
            width * 0.5,
            height * 0.43,
            0,
            width * 0.5,
            height * 0.43,
            Math.max(width, height) * 0.72
        );

        glow.addColorStop(0, "rgba(227,184,92,0.045)");
        glow.addColorStop(1, "rgba(227,184,92,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
            const particle = particles[i];

            if (!reducedMotion) {
                particle.x += particle.vx;
                particle.y += particle.vy;

                if (particle.x < -8) particle.x = width + 8;
                if (particle.x > width + 8) particle.x = -8;
                if (particle.y < -8) particle.y = height + 8;
                if (particle.y > height + 8) particle.y = -8;
            }

            if (pointer.active && !reducedMotion) {
                const dx = pointer.x - particle.x;
                const dy = pointer.y - particle.y;
                const distance = Math.hypot(dx, dy);

                if (distance < 150 && distance > 0) {
                    const force = (150 - distance) * 0.0018;
                    particle.x -= (dx / distance) * force;
                    particle.y -= (dy / distance) * force;
                }
            }

            const pulse = reducedMotion
                ? 0.72
                : 0.52 + Math.sin(frame * 0.018 + particle.phase) * 0.22;

            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${GOLD},${Math.max(0.25, pulse * particle.twinkle)})`;
            ctx.shadowBlur = 9;
            ctx.shadowColor = `rgba(${GOLD},0.65)`;
            ctx.fill();
            ctx.shadowBlur = 0;

            for (let j = i + 1; j < particles.length; j++) {
                const other = particles[j];
                const dx = particle.x - other.x;
                const dy = particle.y - other.y;
                const distance = Math.hypot(dx, dy);

                if (distance < 118) {
                    ctx.strokeStyle = `rgba(${GOLD},${(1 - distance / 118) * 0.19})`;
                    ctx.lineWidth = 0.65;
                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(other.x, other.y);
                    ctx.stroke();
                }
            }
        }

        frame++;
    }

    function animate() {
        drawFrame();
        if (!reducedMotion) requestAnimationFrame(animate);
    }

    window.addEventListener("resize", resizeCanvas, { passive: true });
    window.addEventListener("pointermove", (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
    }, { passive: true });
    window.addEventListener("pointerleave", () => {
        pointer.active = false;
    });

    resizeCanvas();
    animate();
})();

/* Keep the copyright year current on every page using this script. */
const yearElement = document.getElementById("year");
if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}
