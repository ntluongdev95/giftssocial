'use client';

import { useState, useMemo } from 'react';
import { X, Clock, Calendar, User, ChevronRight, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import type { Business, BusinessService } from '@/types';

interface Props {
  business: Business;
  initialService?: string;
  onClose: () => void;
  onBooked: () => void;
}

// Mock staff — in production from business API
const MOCK_STAFF = [
  { id: 'any', name: 'Any available', avatar: null },
  { id: 'staff_1', name: 'Emily N.', avatar: null },
  { id: 'staff_2', name: 'Linh T.', avatar: null },
  { id: 'staff_3', name: 'Sarah K.', avatar: null },
];

// Generate time slots
function generateSlots(openTime: string, closeTime: string, durationMin: number): string[] {
  const slots: string[] = [];
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  let current = oh * 60 + om;
  const end = ch * 60 + cm - durationMin;
  while (current <= end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    current += 30; // 30-min intervals
  }
  return slots;
}

type Step = 'service' | 'datetime' | 'staff' | 'confirm';

export default function NailBookingModal({ business: biz, initialService, onClose, onBooked }: Props) {
  const services = (biz.services || []) as BusinessService[];
  const hours = biz.hours || {};

  const [step, setStep] = useState<Step>(initialService ? 'datetime' : 'service');
  const [selectedService, setSelectedService] = useState<BusinessService | null>(
    initialService ? services.find(s => s.name === initialService) || null : null
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState(MOCK_STAFF[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Generate dates (next 14 days)
  const dates = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);

  // Time slots for selected date
  const dayKey = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][selectedDate.getDay()];
  const dayHours = hours[dayKey];
  const isClosed = dayHours?.closed;
  const timeSlots = useMemo(() => {
    if (isClosed || !dayHours?.open || !dayHours?.close) return [];
    return generateSlots(dayHours.open, dayHours.close, selectedService?.duration || 30);
  }, [dayHours, isClosed, selectedService]);

  const handleSubmit = async () => {
    if (!selectedService || !selectedTime) return;
    setSubmitting(true);

    const slotTime = new Date(selectedDate);
    const [h, m] = selectedTime.split(':').map(Number);
    slotTime.setHours(h, m, 0, 0);

    try {
      const res = await fetch('/api/v1/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({
          business_id: biz.id,
          service_name: selectedService.name,
          slot_time: slotTime.toISOString(),
          amount: selectedService.price,
          notes: `Staff: ${selectedStaff.name}${notes ? ` | ${notes}` : ''}`,
        }),
      });

      if (res.ok) {
        toast.success('Booking confirmed!');
        onBooked();
        onClose();
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Failed to book');
      }
    } catch { toast.error('Network error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center lg:items-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-[480px] max-h-[90dvh] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
        style={{ background: '#0a0b0f', border: '1px solid rgba(0,212,255,0.08)' }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">{biz.name}</h2>
            <p className="text-[10px] text-[#4a5068]">
              {step === 'service' && 'Choose a service'}
              {step === 'datetime' && 'Pick date & time'}
              {step === 'staff' && 'Choose technician'}
              {step === 'confirm' && 'Confirm booking'}
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <X size={16} className="text-[#4a5068]" />
          </button>
        </div>

        {/* Progress */}
        <div className="shrink-0 flex gap-1 px-5 pb-4">
          {(['service', 'datetime', 'staff', 'confirm'] as Step[]).map((s, i) => (
            <div key={s} className="flex-1 h-1 rounded-full" style={{ background: (['service', 'datetime', 'staff', 'confirm'].indexOf(step) >= i) ? '#00d4ff' : 'rgba(255,255,255,0.06)' }} />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <AnimatePresence mode="wait">

            {/* Step 1: Service */}
            {step === 'service' && (
              <motion.div key="service" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-1.5">
                {services.map(svc => (
                  <button
                    key={svc.name}
                    onClick={() => { setSelectedService(svc); setStep('datetime'); }}
                    className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <div>
                      <p className="text-sm text-white">{svc.name}</p>
                      <p className="text-[10px] text-[#4a5068]">{svc.duration} min</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#00d4ff]">${svc.price}</span>
                      <ChevronRight size={14} className="text-[#4a5068]" />
                    </div>
                  </button>
                ))}
              </motion.div>
            )}

            {/* Step 2: Date & Time */}
            {step === 'datetime' && (
              <motion.div key="datetime" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {/* Date picker */}
                <div>
                  <p className="text-xs font-semibold text-[#4a5068] mb-2">Date</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {dates.map(d => {
                      const key = d.toISOString().split('T')[0];
                      const sel = selectedDate.toISOString().split('T')[0] === key;
                      const dKey = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
                      const closed = hours[dKey]?.closed;
                      return (
                        <button
                          key={key}
                          onClick={() => { if (!closed) { setSelectedDate(d); setSelectedTime(null); } }}
                          disabled={closed}
                          className="shrink-0 flex flex-col items-center gap-0.5 rounded-xl w-14 py-2 cursor-pointer disabled:opacity-30"
                          style={sel ? { background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' } : { background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)', color: '#a3adc3' }}
                        >
                          <span className="text-[10px] font-medium">{format(d, 'EEE')}</span>
                          <span className="text-base font-bold">{format(d, 'd')}</span>
                          <span className="text-[9px]">{format(d, 'MMM')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time slots */}
                <div>
                  <p className="text-xs font-semibold text-[#4a5068] mb-2">Time {isClosed && <span className="text-[#f87171]">— Closed</span>}</p>
                  {!isClosed && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {timeSlots.map(t => {
                        const sel = selectedTime === t;
                        // Disable past times for today
                        const isPast = selectedDate.toDateString() === new Date().toDateString() && t <= format(new Date(), 'HH:mm');
                        return (
                          <button
                            key={t}
                            onClick={() => !isPast && setSelectedTime(t)}
                            disabled={isPast}
                            className="rounded-lg py-2 text-xs font-medium cursor-pointer disabled:opacity-20"
                            style={sel ? { background: '#00d4ff', color: '#0a0b0f' } : { background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)', color: '#a3adc3' }}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Staff */}
            {step === 'staff' && (
              <motion.div key="staff" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-1.5">
                {MOCK_STAFF.map(s => {
                  const sel = selectedStaff.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStaff(s)}
                      className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left cursor-pointer"
                      style={{ background: sel ? 'rgba(0,212,255,0.1)' : 'rgba(17,19,24,0.5)', border: `1px solid ${sel ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.04)'}` }}
                    >
                      <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.1)' }}>
                        <User size={16} className="text-[#00d4ff]" />
                      </div>
                      <span className="flex-1 text-sm text-white">{s.name}</span>
                      {sel && <Check size={16} className="text-[#00d4ff]" />}
                    </button>
                  );
                })}

                {/* Notes */}
                <div className="pt-3">
                  <p className="text-xs font-semibold text-[#4a5068] mb-1.5">Special requests</p>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. French tip design, allergies..."
                    rows={2}
                    maxLength={200}
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none resize-none placeholder:text-[#2d3548]"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                </div>
              </motion.div>
            )}

            {/* Step 4: Confirm */}
            {step === 'confirm' && selectedService && (
              <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(0,212,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#4a5068]">Service</p>
                    <p className="text-sm font-semibold text-white">{selectedService.name}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#4a5068]">Date</p>
                    <p className="text-sm text-white">{format(selectedDate, 'EEE, MMM d')}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#4a5068]">Time</p>
                    <p className="text-sm text-white">{selectedTime}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#4a5068]">Technician</p>
                    <p className="text-sm text-white">{selectedStaff.name}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#4a5068]">Duration</p>
                    <p className="text-sm text-white">{selectedService.duration} min</p>
                  </div>
                  {notes && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[#4a5068]">Notes</p>
                      <p className="text-sm text-[#a3adc3] truncate ml-4">{notes}</p>
                    </div>
                  )}
                  <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Total</p>
                    <p className="text-lg font-bold text-[#00d4ff]">${selectedService.price}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] lg:pb-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {step !== 'service' && (
            <button
              onClick={() => {
                if (step === 'datetime') setStep('service');
                else if (step === 'staff') setStep('datetime');
                else if (step === 'confirm') setStep('staff');
              }}
              className="rounded-xl px-4 py-3 text-sm font-medium cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }}
            >
              Back
            </button>
          )}

          {step === 'datetime' && (
            <button
              onClick={() => selectedTime && setStep('staff')}
              disabled={!selectedTime}
              className="flex-1 rounded-xl py-3 text-sm font-semibold cursor-pointer disabled:opacity-30"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              Next — Choose Technician
            </button>
          )}

          {step === 'staff' && (
            <button
              onClick={() => setStep('confirm')}
              className="flex-1 rounded-xl py-3 text-sm font-semibold cursor-pointer"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              Next — Review Booking
            </button>
          )}

          {step === 'confirm' && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #22C55E)', color: '#0a0b0f', boxShadow: '0 4px 20px rgba(0,212,255,0.3)' }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Confirm — $${selectedService?.price}`}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
