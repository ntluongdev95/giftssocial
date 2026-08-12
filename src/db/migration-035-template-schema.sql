-- Migration 035: data-driven templates (fields_schema + effects) + kiss template_data
--
-- Turns templates from React-only to data-driven:
--   • fields_schema (JSON) — declares which inputs the sender fills in
--     for THIS template. The DynamicForm renders inputs from it.
--     Shape: [{ key, type, label, required?, default?, min?, max?, options?, maxLength? }]
--
--   • effects (JSON) — declares which visual effects play during the
--     reveal, in order. The TemplateRenderer walks this list and mounts
--     the matching primitive from the effect registry.
--     Shape: [{ type, at?, duration?, ...params }]
--
-- Kisses gain template_data so each sent kiss can carry the user's
-- answers (e.g. { age: 25, name: "Linh" }). The renderer substitutes
-- {placeholders} in effect params from this data.
--
-- component_key stays as an ESCAPE HATCH — templates with a custom
-- React component (like rose-rain) keep working. New templates default
-- to component_key='data-driven' so the engine kicks in.

ALTER TABLE templates ADD COLUMN fields_schema TEXT;   -- JSON: [{key,type,label,...}]
ALTER TABLE templates ADD COLUMN effects       TEXT;   -- JSON: [{type,at,...params}]

ALTER TABLE kisses    ADD COLUMN template_data TEXT;   -- JSON: sender's answers { key: value }
