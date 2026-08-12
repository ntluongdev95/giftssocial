'use client'
function CinematicIntro({
  kiss,
  senderCity,
  receiverCity,
}: {
  kiss: Kiss;
  senderCity: string;
  receiverCity: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
    >
      {/* Cinematic background */}
      <div className="absolute inset-0 bg-[#050508]" />

      {/* Ambient glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.25, 0.12], scale: [0.5, 1.2, 1] }}
        transition={{ duration: 7 }}
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(236,72,153,.22), transparent 70%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Stars / particles */}
      <CinematicParticles />

      {/* Scene */}
      <div className="relative z-10 w-full max-w-lg h-full flex items-center justify-center">

        {/* Scene 1 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 2.2,
            times: [0, 0.2, 0.75, 1],
          }}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <p className="text-[10px] tracking-[0.5em] uppercase text-white/30">
            Somewhere in the world
          </p>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1, 1] }}
            transition={{ duration: 1.2, delay: 0.5 }}
            className="mt-6 h-2 w-2 rounded-full bg-pink-400"
            style={{
              boxShadow: '0 0 30px 10px rgba(236,72,153,.35)',
            }}
          />
        </motion.div>


        {/* Scene 2 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{
            duration: 3,
            times: [0, 0.25, 0.4, 0.85, 1],
          }}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >

          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{
              scale: [0.7, 1, 1.05, 1],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 3,
              times: [0, 0.3, 0.7, 1],
            }}
            className="relative"
          >
            {/* radar */}
            <motion.div
              animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
              transition={{
                duration: 1.8,
                repeat: 1,
              }}
              className="absolute inset-0 rounded-full border border-pink-400/40"
            />

            <div
              className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg,#ec4899,#f87171)',
                border: '2px solid rgba(255,255,255,.15)',
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
                <span className="text-3xl font-bold text-white">
                  {(kiss.sender_name || '?')
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -5] }}
            transition={{
              duration: 2.5,
              delay: 0.5,
            }}
            className="mt-5 text-xl font-semibold text-white"
          >
            {kiss.sender_name || 'Someone'}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 2.2,
              delay: 0.8,
            }}
            className="mt-1 text-[10px] tracking-[0.25em] uppercase text-white/30"
          >
            {senderCity}
          </motion.p>
        </motion.div>


        {/* Scene 3 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{
            duration: 2.5,
            times: [0, 0.35, 0.5, 0.8, 1],
          }}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{
              scale: [0, 1.3, 1],
              rotate: [-20, 5, 0],
            }}
            transition={{
              duration: 1,
              delay: 0.3,
            }}
            className="text-7xl"
          >
            {kiss.emoji}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
            transition={{
              duration: 2,
              delay: 0.8,
            }}
            className="mt-6 text-sm text-white/50"
          >
            decided to send something special
          </motion.p>

        </motion.div>


        {/* Scene 4 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{
            duration: 3,
            times: [0, 0.35, 0.5, 0.85, 1],
          }}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >

          <p className="text-[9px] tracking-[0.4em] uppercase text-white/25">
            From
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            {senderCity || 'Somewhere'}
          </h2>

          {/* route */}
          <div className="relative w-72 h-16 mt-6">

            <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />

            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: 1.4,
                delay: 0.4,
              }}
              className="absolute left-0 right-0 top-1/2 h-px origin-left"
              style={{
                background:
                  'linear-gradient(90deg,#ec4899,#a855f7,#00d4ff)',
                boxShadow:
                  '0 0 12px rgba(236,72,153,.5)',
              }}
            />

            <motion.div
              initial={{ left: '0%' }}
              animate={{ left: '100%' }}
              transition={{
                duration: 1.4,
                delay: 0.4,
                ease: 'easeInOut',
              }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            >
              <div className="text-xl">
                {kiss.emoji}
              </div>
            </motion.div>

            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-pink-400" />

            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400" />

          </div>

          <p className="mt-2 text-[9px] tracking-[0.4em] uppercase text-white/25">
            To
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            {receiverCity || 'Somewhere'}
          </h2>

        </motion.div>


        {/* Final title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: [0, 0, 0, 1, 1, 0], scale: [0.96, 0.96, 0.96, 1, 1, 1.03] }}
          transition={{
            duration: 2,
            delay: 5.2,
          }}
          className="absolute bottom-[18%] text-center"
        >
          <p className="text-xs tracking-[0.25em] uppercase text-pink-400">
            Preparing for takeoff
          </p>

          <div className="mt-3 flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{
                  duration: 1,
                  delay: i * 0.2,
                  repeat: Infinity,
                }}
                className="w-1 h-1 rounded-full bg-pink-400"
              />
            ))}
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}