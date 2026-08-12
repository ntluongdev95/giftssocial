'use client';

import React from 'react';

export type VehicleType =
  | 'car'
  | 'drone'
  | 'airplane';

interface VehicleProps {
  type: VehicleType;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  opacity?: number;
  image?: string;
}

export default function Vehicle({
  type,
  x,
  y,
  rotation = 0,
  scale = 1,
  opacity = 1,
  image,
}: VehicleProps) {
  const defaultImages: Record<VehicleType, string> = {
    car: '/cars/porsche.webp',
    drone: '/vehicles/drone.webp',
    airplane: '/vehicles/airplane.webp',
  };

  const src = image || defaultImages[type];

  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        left: x,
        top: y,
        opacity,
        transform: `
          translate(-50%, -50%)
          rotate(${rotation}deg)
          scale(${scale})
        `,
        transformOrigin: 'center center',
        willChange: 'transform, opacity',
      }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className="block object-contain"
        style={{
          width: type === 'car' ? 70 : 55,
          height: type === 'car' ? 45 : 45,
          filter: `
            drop-shadow(0 5px 5px rgba(0,0,0,0.45))
            drop-shadow(0 0 8px rgba(255,255,255,0.12))
          `,
          userSelect: 'none',
          WebkitUserDrag: 'none',
        }}
      />
    </div>
  );
}