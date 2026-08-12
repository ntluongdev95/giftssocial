'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import PixelFormation from './PixelFormation';

interface Kiss {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name?: string;
  sender_avatar?: string;
  receiver_name?: string;
  receiver_avatar?: string;
  emoji: string;
  message?: string;
  visibility: string;
  sender_lat: number;
  sender_lng: number;
  receiver_lat: number;
  receiver_lng: number;
  kiss_type?: string;
  created_at: string;
}

interface Props {
  kiss: Kiss;
  senderCity: string;
  receiverCity: string;
  onComplete: () => void;
}

type Scene =
  | 'black'
  | 'text'
  | 'formation'
  | 'sender'
  | 'route';

export default function CinematicIntro({
  kiss,
  senderCity,
  receiverCity,
  onComplete,
}: Props) {
  const [scene, setScene] =
    useState<Scene>('black');

  const vehicle =
    kiss.kiss_type === 'declaration'
      ? 'drone'
      : 'car';

  useEffect(() => {
    const timers = [
      setTimeout(() => {
        setScene('text');
      }, 700),

      setTimeout(() => {
        setScene('formation');
      }, 2600),

      setTimeout(() => {
        setScene('sender');
      }, 7200),

      setTimeout(() => {
        setScene('route');
      }, 9000),

      setTimeout(() => {
        onComplete();
      }, 11000),
    ];

    return () =>
      timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 50% 40%, #111522 0%, #05060a 45%, #000 100%)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* ================================================= */}
      {/* CINEMATIC LIGHT */}
      {/* ================================================= */}

      <motion.div
        className="absolute inset-0"
        animate={{
          opacity:
            scene === 'formation'
              ? [0.2, 0.5, 0.25]
              : 0.15,
        }}
        transition={{
          duration: 3,
          repeat:
            scene === 'formation'
              ? Infinity
              : 0,
        }}
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(236,72,153,.18), transparent 45%)',
        }}
      />

      {/* ================================================= */}
      {/* TOP CINEMATIC TEXT */}
      {/* ================================================= */}

      <motion.div
        className="absolute top-[13%] left-0 right-0 text-center z-20"
        initial={{
          opacity: 0,
          y: 15,
        }}
        animate={{
          opacity:
            scene === 'text' ||
            scene === 'formation'
              ? 1
              : 0,
          y: 0,
        }}
        transition={{
          duration: 1.2,
        }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.55em]"
          style={{
            color: 'rgba(255,255,255,.35)',
          }}
        >
          Gao Social presents
        </p>
      </motion.div>

      {/* ================================================= */}
      {/* MAIN FORMATION */}
      {/* ================================================= */}

      {scene === 'formation' && (
        <PixelFormation
          text={
            kiss.kiss_type === 'declaration'
              ? 'ARE YOU READY'
              : 'GET READY'
          }
          vehicle={vehicle}
          duration={4300}
        />
      )}

      {/* ================================================= */}
      {/* SUBTITLE */}
      {/* ================================================= */}

      <motion.div
        className="absolute bottom-[23%] left-0 right-0 text-center z-20"
        initial={{
          opacity: 0,
          y: 10,
        }}
        animate={{
          opacity:
            scene === 'formation' ||
            scene === 'sender'
              ? 1
              : 0,
          y: 0,
        }}
        transition={{
          duration: 1,
        }}
      >
        <p
          className="text-xs tracking-[0.35em] uppercase"
          style={{
            color: 'rgba(255,255,255,.4)',
          }}
        >
          {kiss.kiss_type === 'declaration'
            ? 'Something extraordinary is coming'
            : 'A little surprise is on its way'}
        </p>
      </motion.div>

      {/* ================================================= */}
      {/* SENDER REVEAL */}
      {/* ================================================= */}

      {scene === 'sender' && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-30"
          initial={{
            opacity: 0,
            scale: 0.8,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          transition={{
            duration: 1.2,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div className="flex flex-col items-center">
            <motion.div
              initial={{
                scale: 0,
              }}
              animate={{
                scale: [0, 1.15, 1],
              }}
              transition={{
                duration: 0.8,
              }}
              className="relative"
            >
              <div
                className="h-24 w-24 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold"
                style={{
                  background:
                    'linear-gradient(135deg,#ec4899,#f87171)',
                  border:
                    '2px solid rgba(236,72,153,.5)',
                  boxShadow:
                    '0 0 60px rgba(236,72,153,.35)',
                }}
              >
                {kiss.sender_avatar ? (
                  <img
                    src={kiss.sender_avatar}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (
                    kiss.sender_name ||
                    '?'
                  )
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>

              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
                style={{
                  border:
                    '1px solid rgba(236,72,153,.5)',
                }}
              />
            </motion.div>

            <motion.p
              initial={{
                opacity: 0,
                y: 10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.5,
              }}
              className="mt-5 text-xl font-bold text-white"
            >
              {kiss.sender_name ||
                'Someone'}
            </motion.p>

            <motion.p
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              transition={{
                delay: 0.8,
              }}
              className="mt-2 text-xs tracking-[0.3em] uppercase"
              style={{
                color:
                  'rgba(255,255,255,.4)',
              }}
            >
              has something for you
            </motion.p>
          </div>
        </motion.div>
      )}

      {/* ================================================= */}
      {/* ROUTE */}
      {/* ================================================= */}

      {scene === 'route' && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-30"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
        >
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {senderCity ||
                  'Unknown'}
              </p>

              <p className="text-[9px] uppercase tracking-wider text-white/30 mt-1">
                Origin
              </p>
            </div>

            <div className="flex items-center gap-2">
              <motion.div
                className="w-10 h-px"
                style={{
                  background:
                    'rgba(236,72,153,.5)',
                }}
              />

              <motion.span
                animate={{
                  x: [0, 6, 0],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                }}
              >
                {vehicle === 'car'
                  ? '🏎️'
                  : '🚁'}
              </motion.span>

              <motion.div
                className="w-10 h-px"
                style={{
                  background:
                    'rgba(0,212,255,.5)',
                }}
              />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {receiverCity ||
                  'Unknown'}
              </p>

              <p className="text-[9px] uppercase tracking-wider text-white/30 mt-1">
                Destination
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ================================================= */}
      {/* FILM GRAIN */}
      {/* ================================================= */}

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] z-[100]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%22.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%22.7%22/%3E%3C/svg%3E")',
        }}
      />

      {/* ================================================= */}
      {/* VIGNETTE */}
      {/* ================================================= */}

      <div
        className="absolute inset-0 pointer-events-none z-[90]"
        style={{
          background:
            'radial-gradient(circle, transparent 45%, rgba(0,0,0,.65) 100%)',
        }}
      />
    </motion.div>
  );
}