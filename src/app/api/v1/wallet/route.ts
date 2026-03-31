import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/wallet — My balance + transactions ─────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: { balance: 0, transactions: [] } });

    // Get balance
    const userRes = await pgPool.query('SELECT gao_points FROM users WHERE id = $1', [userId]);
    const balance = userRes.rows[0]?.gao_points || 0;

    // Get recent transactions
    const txRes = await pgPool.query(
      'SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
      [userId]
    );

    return NextResponse.json({ data: { balance, transactions: txRes.rows } });
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

    // Update balance
    const userRes = await pgPool.query(
      'UPDATE users SET gao_points = gao_points + $1, updated_at = NOW() WHERE id = $2 RETURNING gao_points',
      [amount, userId]
    );
    const newBalance = userRes.rows[0]?.gao_points || 0;

    // Record transaction
    await pgPool.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, source, ref_type, ref_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, amount > 0 ? 'earn' : 'spend', amount, newBalance, source, ref_type || null, ref_id || null, description || '']
    );

    return NextResponse.json({ data: { balance: newBalance, earned: amount } });
  } catch (err) {
    console.error('[Wallet POST]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}
