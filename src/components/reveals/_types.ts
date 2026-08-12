// Shared types for the reveal-template plugin system.
//
// Each reveal template is a self-contained React component + config
// living in its own folder under src/components/reveals/[id]/. The
// central registry (_registry.ts) collects all templates and exposes
// them to the sender-side picker (SendKissModal) and the receiver-side
// reveal (KissRevealPopup dispatch).
//
// To add a new template:
//   1. Create src/components/reveals/[my-template]/index.tsx
//   2. Export a default React component that accepts TemplateProps.
//   3. Create src/components/reveals/[my-template]/config.ts
//   4. Export a default TemplateConfig with the metadata.
//   5. Import + register in _registry.ts.

import type { ComponentType } from 'react';

/** The subset of kiss data every reveal template can rely on. */
export interface RevealKiss {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  receiver_id: string;
  receiver_name?: string;
  receiver_avatar?: string;
  message: string;
  emoji: string;
  photos?: string | null;         // JSON-encoded string[] of URLs
  music_url?: string | null;
  music_title?: string | null;
  open_count?: number;
  max_opens?: number;
  created_at?: string;
  template_id?: string | null;
  template_data?: string | null;  // JSON — sender's answers for the template's fields_schema
}

/** Props every reveal template component receives. */
export interface TemplateProps {
  kiss: RevealKiss;
  currentUserId?: string;
  onClose: () => void;
  /** Called when the receiver taps "Send back" — opens the send flow prefilled with the sender. */
  onSendBack?: (senderId: string) => void;
}

/** Metadata + component for a reveal template. One per folder. */
export interface TemplateConfig {
  /** Unique ID persisted on the kiss row (max 60 chars). */
  id: string;
  /** Display name shown on the template card + preview modal. */
  name: string;
  /** Which occasions this template appears under in the picker. */
  occasionIds: string[];
  /** Hero emoji rendered on the thumbnail card + preview modal fallback. */
  emoji: string;
  /** One-liner description shown in the preview modal. */
  description: string;
  /** CSS background for the thumbnail card (gradient or color). */
  thumbnailBg: string;
  /** Optional preview video URL (mp4). If missing, preview shows the hero emoji. */
  previewVideo?: string;
  /** Premium templates cost coins to attach. Free by default. */
  premium?: boolean;
  coins?: number;
  /** The React component that renders the receiver's reveal experience. */
  Component: ComponentType<TemplateProps>;
}
