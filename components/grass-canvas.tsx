"use client";

import { useEffect, useRef } from "react";

type Blade = {
  x: number;
  y: number;
  height: number;
  width: number;
  hue: number;
  sat: number;
  light: number;
  angle: number;
  vel: number;
  stiffness: number;
  phase: number;
  depth: number;
};

export function GrassCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let blades: Blade[] = [];
    let mouseX = -9999;
    let mouseY = -9999;
    let lastTime = 0;
    let rafId = 0;

    function initBlades() {
      blades = [];
      const count = Math.max(110, Math.floor(W / 3.5));
      for (let i = 0; i < count; i++) {
        const baseX = (i / count) * W + (Math.random() - 0.5) * 5;
        const depth = Math.random();
        blades.push({
          x: baseX,
          y: H - 4 - Math.random() * 5,
          height: 52 + Math.random() * 70 + depth * 14,
          width: 2 + Math.random() * 1.6,
          hue: 95 + Math.random() * 35,
          sat: 35 + Math.random() * 28,
          light: 18 + depth * 26 + Math.random() * 7,
          angle: (Math.random() - 0.5) * 0.08,
          vel: 0,
          stiffness: 0.03 + Math.random() * 0.02,
          phase: Math.random() * Math.PI * 2,
          depth,
        });
      }
      blades.sort((a, b) => a.depth - b.depth);
    }

    function resize() {
      if (!canvas || !ctx) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = rect.width;
      H = rect.height;
      initBlades();
    }

    function setMouseFromEvent(e: MouseEvent | TouchEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      let cx: number;
      let cy: number;
      if ("touches" in e && e.touches.length) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      } else if ("clientX" in e) {
        cx = (e as MouseEvent).clientX;
        cy = (e as MouseEvent).clientY;
      } else {
        return;
      }
      mouseX = cx - rect.left;
      mouseY = cy - rect.top;
    }
    function clearMouse() {
      mouseX = -9999;
      mouseY = -9999;
    }

    function tick(time: number) {
      if (!ctx) return;
      if (!lastTime) lastTime = time;
      const dtMs = Math.min(40, time - lastTime);
      lastTime = time;
      const dt = dtMs / 16.6667;

      ctx.clearRect(0, 0, W, H);

      const soil = ctx.createLinearGradient(0, H - 34, 0, H);
      soil.addColorStop(0, "rgba(14,68,41,0)");
      soil.addColorStop(1, "rgba(14,68,41,0.35)");
      ctx.fillStyle = soil;
      ctx.fillRect(0, H - 34, W, 34);

      const wave = time * 0.0009;

      for (const b of blades) {
        const wind = reduceMotion
          ? 0
          : Math.sin(wave + b.phase + b.x * 0.012) * 0.028;

        const midX = b.x + Math.sin(b.angle * 0.7) * b.height * 0.7;
        const midY = b.y - Math.cos(b.angle * 0.7) * b.height * 0.7;
        const dx = midX - mouseX;
        const dy = midY - mouseY;
        const distSq = dx * dx + dy * dy;
        const radius = 120;
        let force = 0;
        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          const s = 1 - dist / radius;
          force = (dx >= 0 ? 1 : -1) * s * s * 0.16;
        }

        b.vel += (-b.angle * b.stiffness + force + wind * 0.0045) * dt;
        b.vel *= Math.pow(0.88, dt);
        b.angle += b.vel * dt;

        if (b.angle > 1.4) {
          b.angle = 1.4;
          b.vel = Math.min(b.vel, 0) * -0.3;
        }
        if (b.angle < -1.4) {
          b.angle = -1.4;
          b.vel = Math.max(b.vel, 0) * -0.3;
        }

        const baseL = b.x - b.width / 2;
        const baseR = b.x + b.width / 2;
        const tipX = b.x + Math.sin(b.angle) * b.height;
        const tipY = b.y - Math.cos(b.angle) * b.height;
        const ctrlX = b.x + Math.sin(b.angle * 0.55) * b.height * 0.55;
        const ctrlY = b.y - Math.cos(b.angle * 0.55) * b.height * 0.55;

        ctx.beginPath();
        ctx.moveTo(baseL, b.y);
        ctx.quadraticCurveTo(ctrlX - b.width * 0.35, ctrlY, tipX, tipY);
        ctx.quadraticCurveTo(ctrlX + b.width * 0.35, ctrlY, baseR, b.y);
        ctx.closePath();
        ctx.fillStyle = `hsl(${b.hue.toFixed(1)}, ${b.sat.toFixed(1)}%, ${b.light.toFixed(1)}%)`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", setMouseFromEvent);
    canvas.addEventListener("mouseleave", clearMouse);
    canvas.addEventListener("touchmove", setMouseFromEvent, { passive: true });
    canvas.addEventListener("touchend", clearMouse);
    canvas.addEventListener("touchcancel", clearMouse);

    resize();
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", setMouseFromEvent);
      canvas.removeEventListener("mouseleave", clearMouse);
      canvas.removeEventListener("touchmove", setMouseFromEvent);
      canvas.removeEventListener("touchend", clearMouse);
      canvas.removeEventListener("touchcancel", clearMouse);
    };
  }, []);

  return <canvas id="grass-canvas" ref={canvasRef} aria-hidden="true" />;
}
