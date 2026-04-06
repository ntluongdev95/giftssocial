import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/wallet — My balance + transactions ─────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: { balance: 0, transactions: [] } });

    const db = getDB();

    // Get balance
    const userRow = await db.prepare('SELECT gao_points FROM users WHERE id = ?').bind(userId).first<{ gao_points: number }>();
    const balance = userRow?.gao_points || 0;

    // Get recent transactions
    const txResult = await db.prepare(
      'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30'
    ).bind(userId).all<Record<string, unknown>>();

    return NextResponse.json({ data: { balance, transactions: txResult.results } });
  } catch (err) {
    console.error('[Wallet GET]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}

// ─── POST /api/v1/wallet — Earn points (internal use) ────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const { amount, source, description, ref_type, ref_id } = await req.json();
    if (!amount || !source) return NextResponse.json({ error: { code: 'invalid_request', message: 'amount and source required' } }, { status: 400 });

    const db = getDB();

    // Update balance
    await db.prepare(
      "UPDATE users SET gao_points = gao_points + ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(amount, userId).run();

    const userRow = await db.prepare('SELECT gao_points FROM users WHERE id = ?').bind(userId).first<{ gao_points: number }>();
    const newBalance = userRow?.gao_points || 0;

    // Record transaction
    const id = genId('tx_');
    await db.prepare(
      `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, source, ref_type, ref_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, userId, amount > 0 ? 'earn' : 'spend', amount, newBalance, source, ref_type || null, ref_id || null, description || '').run();

    return NextResponse.json({ data: { balance: newBalance, earned: amount } });
  } catch (err) {
    console.error('[Wallet POST]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}
