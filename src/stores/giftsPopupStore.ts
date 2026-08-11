import { create } from 'zustand';

// Merged store for the unified Gifts popup — one entry point that
// covers both the "Send a Kiss" flow and the Gao Gifts templates
// (Trái Tim 3D, Couple ID card) in a tabbed dialog.
//
// State separation:
//   • Popup itself — the tabbed dialog opened from the Gifts chip.
//   • Kiss modal — the full-screen SendKissModal for the "send back"
//     flow (KissRevealPopup) which bypasses the popup and opens the
//     kiss form directly with a prefilled recipient.
//   • Template builders — HeartBuilder + CoupleCardBuilder. Opened
//     when the user picks a template card in the popup's Templates
//     tab. Full-screen builders on top of everything else.

type GiftsTab = 'kiss' | 'templates';

interface GiftsPopupStore {
  isPopupOpen: boolean;
  activeTab: GiftsTab;

  // Kiss modal (direct — used by KissRevealPopup's Send Back flow).
  isKissModalOpen: boolean;
  kissSendBackTo: string | null;

  // Template builders — opened from the popup's Templates tab.
  isHeartBuilderOpen: boolean;
  isCoupleBuilderOpen: boolean;
  // Birthday launches the time-capsule composer with the birthday
  // theme preloaded (the recipient later gets the cinematic drone-
  // show reveal via BirthdayJourneyFlow when they open the capsule).
  isBirthdayCapsuleOpen: boolean;

  openPopup: (tab?: GiftsTab) => void;
  closePopup: () => void;
  setTab: (tab: GiftsTab) => void;

  openKissModalDirect: (sendBackTo?: string | null) => void;
  closeKissModal: () => void;

  openHeartBuilder: () => void;
  closeHeartBuilder: () => void;

  openCoupleBuilder: () => void;
  closeCoupleBuilder: () => void;

  openBirthdayCapsule: () => void;
  closeBirthdayCapsule: () => void;
}

export const useGiftsPopupStore = create<GiftsPopupStore>((set) => ({
  isPopupOpen: false,
  activeTab: 'kiss',

  isKissModalOpen: false,
  kissSendBackTo: null,

  isHeartBuilderOpen: false,
  isCoupleBuilderOpen: false,
  isBirthdayCapsuleOpen: false,

  openPopup: (tab = 'kiss') => set({ isPopupOpen: true, activeTab: tab }),
  closePopup: () => set({ isPopupOpen: false }),
  setTab: (tab) => set({ activeTab: tab }),

  openKissModalDirect: (sendBackTo = null) =>
    set({ isKissModalOpen: true, kissSendBackTo: sendBackTo }),
  closeKissModal: () => set({ isKissModalOpen: false, kissSendBackTo: null }),

  openHeartBuilder: () => set({ isHeartBuilderOpen: true, isPopupOpen: false }),
  closeHeartBuilder: () => set({ isHeartBuilderOpen: false }),

  openCoupleBuilder: () => set({ isCoupleBuilderOpen: true, isPopupOpen: false }),
  closeCoupleBuilder: () => set({ isCoupleBuilderOpen: false }),

  openBirthdayCapsule: () => set({ isBirthdayCapsuleOpen: true, isPopupOpen: false }),
  closeBirthdayCapsule: () => set({ isBirthdayCapsuleOpen: false }),
}));
