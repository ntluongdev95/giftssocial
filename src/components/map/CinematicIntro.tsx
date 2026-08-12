'use client';

import {
  motion,
} from 'framer-motion';

interface Kiss {
  sender_name?: string;
  receiver_name?: string;
  emoji: string;
  kiss_type?: string;
}

interface Props {
  kiss: Kiss;
  senderCity: string;
  receiverCity: string;
  onComplete: () => void;
}

export default function CinematicIntro({
  kiss,
  senderCity,
  receiverCity,
  onComplete,
}: Props) {
  return (
    <motion.div
      className="
        absolute
        inset-0
        z-[30]
        pointer-events-none
        flex
        items-center
        justify-center
      "
    >
      {/* Opening title */}
      <motion.div
        initial={{
          opacity: 0,
          scale: 1.08,
        }}
        animate={{
          opacity: [
            0,
            1,
            1,
            0,
          ],
          scale: [
            1.08,
            1,
            1,
            0.98,
          ],
        }}
        transition={{
          duration: 10.5,
          times: [
            0,
            0.12,
            0.68,
            0.92,
          ],
          ease: 'easeInOut',
        }}
        className="
          absolute
          inset-0
          flex
          flex-col
          items-center
          justify-center
          text-center
        "
      >
        {/* Small eyebrow */}
        <motion.p
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: [
              0,
              1,
              1,
              0,
            ],
            y: [
              12,
              0,
              0,
              -10,
            ],
          }}
          transition={{
            duration: 5,
            delay: 0.5,
            ease: 'easeOut',
          }}
          className="
            absolute
            top-[28%]
            text-[9px]
            uppercase
            tracking-[0.5em]
            text-white/35
          "
        >
          A message is coming
        </motion.p>

        {/* Main title */}
        <motion.h1
          initial={{
            opacity: 0,
            letterSpacing:
              '0.8em',
            filter:
              'blur(8px)',
          }}
          animate={{
            opacity: [
              0,
              1,
              1,
              0,
            ],
            letterSpacing: [
              '0.8em',
              '0.28em',
              '0.28em',
              '0.45em',
            ],
            filter: [
              'blur(8px)',
              'blur(0px)',
              'blur(0px)',
              'blur(5px)',
            ],
          }}
          transition={{
            duration: 8,
            delay: 1,
            times: [
              0,
              0.25,
              0.7,
              1,
            ],
            ease: 'easeInOut',
          }}
          className="
            font-black
            text-3xl
            md:text-6xl
            text-white
            uppercase
          "
          style={{
            textShadow:
              '0 0 30px rgba(236,72,153,.25)',
          }}
        >
          ARE YOU READY
        </motion.h1>

        {/* Sub title */}
        <motion.p
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: [
              0,
              0,
              1,
              1,
              0,
            ],
            y: [
              15,
              15,
              0,
              0,
              -10,
            ],
          }}
          transition={{
            duration: 7,
            delay: 2.8,
            times: [
              0,
              0.3,
              0.45,
              0.75,
              1,
            ],
          }}
          className="
            mt-5
            text-[10px]
            tracking-[0.35em]
            uppercase
            text-[#ec4899]/70
          "
        >
          Something special is on its way
        </motion.p>
      </motion.div>

      {/* Final route text */}
      <motion.div
        initial={{
          opacity: 0,
          y: 20,
        }}
        animate={{
          opacity: [
            0,
            0,
            1,
            1,
            0,
          ],
          y: [
            20,
            20,
            0,
            0,
            -15,
          ],
        }}
        transition={{
          duration: 3.5,
          delay: 7.3,
          times: [
            0,
            0.25,
            0.4,
            0.75,
            1,
          ],
        }}
        className="
          absolute
          bottom-[18%]
          flex
          items-center
          gap-4
        "
      >
        <span
          className="
            text-[10px]
            uppercase
            tracking-[0.2em]
            text-white/50
          "
        >
          {senderCity || 'Origin'}
        </span>

        <span
          className="
            text-sm
            text-[#ec4899]
          "
        >
          →
        </span>

        <span
          className="
            text-[10px]
            uppercase
            tracking-[0.2em]
            text-white/50
          "
        >
          {receiverCity || 'Destination'}
        </span>
      </motion.div>
    </motion.div>
  );
}