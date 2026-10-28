/**
 * Confetti for wins and sparks for losses: a small fixed pool, so a burst never allocates per frame.
 */
const POOL_SIZE = 96;
const GRAVITY = 900;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
  color: string;
}

export interface Burst {
  readonly x: number;
  readonly y: number;
  readonly colors: readonly string[];
  readonly count: number;
  /** Launch speed, CSS px per second. */
  readonly speed: number;
}

export class Particles {
  private readonly pool: Particle[] = Array.from({ length: POOL_SIZE }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0, ttl: 0, size: 0, color: '',
  }));
  private lastTick = 0;

  public get isAlive(): boolean {
    return this.pool.some((particle) => particle.life > 0);
  }

  public burst({ x, y, colors, count, speed }: Burst, now: number): void {
    if (!this.isAlive) this.lastTick = now;
    let launched = 0;
    for (const particle of this.pool) {
      if (launched >= count) return;
      if (particle.life > 0) continue;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const velocity = speed * (0.45 + Math.random() * 0.55);
      Object.assign(particle, {
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 1,
        ttl: 0.9 + Math.random() * 0.6,
        size: 3 + Math.random() * 4,
        color: colors[launched % colors.length] ?? '#ffffff',
      });
      launched += 1;
    }
  }

  public draw(context: CanvasRenderingContext2D, now: number): void {
    const dt = Math.min(0.05, (now - this.lastTick) / 1000);
    this.lastTick = now;
    for (const particle of this.pool) {
      if (particle.life <= 0) continue;
      particle.vy += GRAVITY * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt / particle.ttl;
      context.globalAlpha = Math.max(0, particle.life);
      context.fillStyle = particle.color;
      context.fillRect(particle.x, particle.y, particle.size, particle.size * 0.6);
    }
    context.globalAlpha = 1;
  }
}
