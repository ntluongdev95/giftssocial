'use client';

import { useEffect, useMemo, useState } from 'react';
import Vehicle, { VehicleType } from './Vehicle';
import { createTextFormation } from './FormationEngine';

interface CinematicFormationProps {
  type: VehicleType;
  text: string;
  active: boolean;
}

interface VehiclePoint {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  rotation: number;
}

export default function CinematicFormation({
  type,
  text,
  active,
}: CinematicFormationProps) {
  const [progress, setProgress] = useState(0);

  const points = useMemo(() => {
    if (!active) return [];

    const formation = createTextFormation(
      text,
      window.innerWidth * 0.8,
      250,
      12
    );

    return formation.map((point, index) => ({
      id: index,

      // Random starting positions
      startX:
        Math.random() * window.innerWidth,

      startY:
        Math.random() * window.innerHeight,

      targetX:
        window.innerWidth * 0.1 + point.x,

      targetY:
        window.innerHeight * 0.35 + point.y,

      rotation:
        (Math.random() - 0.5) * 180,
    }));
  }, [text, active]);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }

    let start = performance.now();
    const duration = 3000;

    let frame: number;

    const animate = (time: number) => {
      const elapsed = time - start;

      const value = Math.min(
        elapsed / duration,
        1
      );

      // easeOutCubic
      const eased =
        1 - Math.pow(1 - value, 3);

      setProgress(eased);

      if (value < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {points.map((point) => {
        const x =
          point.startX +
          (point.targetX - point.startX) * progress;

        const y =
          point.startY +
          (point.targetY - point.startY) * progress;

        const rotation =
          point.rotation * (1 - progress);

        const opacity =
          Math.min(1, progress * 2);

        const scale =
          0.4 + progress * 0.6;

        return (
          <Vehicle
            key={point.id}
            type={type}
            x={x}
            y={y}
            rotation={rotation}
            scale={scale}
            opacity={opacity}
          />
        );
      })}
    </div>
  );
}