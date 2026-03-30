/**
 * Gao Audit Trail — IronClaw Rule 5: Audit Everything
 */

export interface AuditEntry { id: string; timestamp: string; action: string; detail?: string; }

let log: AuditEntry[] = [];

export function logAudit(action: string, detail?: string): AuditEntry {
  const entry: AuditEntry = {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toLocaleTimeString('en', { hour12: false }),
    action, detail,
  };
  log.push(entry);
  if (log.length > 200) log = log.slice(-200);
  try { sessionStorage.setItem('gao_audit', JSON.stringify(log)); } catch {}
  return entry;
}

export function getAuditLog(): AuditEntry[] {
  if (log.length === 0) {
    try { const s = sessionStorage.getItem('gao_audit'); if (s) log = JSON.parse(s); } catch {}
  }
  return [...log];
}
