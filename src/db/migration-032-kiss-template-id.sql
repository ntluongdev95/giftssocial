-- Migration 032: reveal template plugin ID
--
-- The sender picks a "reveal template" — a self-contained React
-- component that owns the receiver's reveal animation (RoseRain,
-- PartyPopper, SantaDelivery, …). Storing the template ID on the kiss
-- lets KissRevealPopup dispatch to the correct plugin.
-- NULL = fall back to the default cinematic reveal.
ALTER TABLE kisses ADD COLUMN template_id TEXT DEFAULT NULL;
