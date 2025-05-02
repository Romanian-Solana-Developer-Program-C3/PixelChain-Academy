// functions/src/index.ts
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import * as functions from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import {
    Connection,
    PublicKey,
    Keypair,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

// ─── dotenv ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── Firebase init ───────────────────────────────────────────────────────────
initializeApp();
const auth = getAuth();
const db = getDatabase();

// ─── Solana faucet setup ─────────────────────────────────────────────────────
const raw = process.env.FAUCET_SECRET;
if (!raw) throw new Error('FAUCET_SECRET missing');

let secretBytes: Uint8Array;
if (raw.trim().startsWith('[')) {
    const arr = JSON.parse(raw) as number[];
    if (arr.length !== 64) throw new Error(`Array length is ${arr.length}, expected 64`);
    secretBytes = Uint8Array.from(arr);
} else {
    const cleaned = raw.trim();
    secretBytes = bs58.decode(cleaned);
    if (secretBytes.length !== 64) throw new Error(`Decoded Base58 secret is ${secretBytes.length} bytes, expected 64`);
}

const faucet = Keypair.fromSecretKey(secretBytes);
const connection = new Connection('https://api.devnet.solana.com');

// ─── HTTP endpoint cu validare Bearer token ─────────────────────────────────
export const claimTreasure = functions.https.onRequest(async (req: any, res: any) => {
    try {
        // 1) Extrage token-ul din header
        const authHeader = req.get('Authorization') || '';
        const match = authHeader.match(/^Bearer (.+)$/);
        if (!match) {
            return res.status(401).json({ error: 'Missing or malformed Authorization header' });
        }
        const idToken = match[1];

        // 2) Verifică-l cu Admin SDK
        const { uid } = await auth.verifyIdToken(idToken);

        // 3) Încarcă datele jucătorului
        const snap = await db.ref(`players/${uid}`).get();
        const player = snap.val();
        if (!player?.wallet) {
            return res.status(400).json({ error: 'Wallet missing for this user' });
        }
        if (player.treasureClaimed) {
            return res.status(200).json({ result: 'already-claimed' });
        }

        // 4) Construiește + semnează tranzacția Solana
        const toPubkey = new PublicKey(player.wallet);
        const tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: faucet.publicKey,
                toPubkey,
                lamports: 100,
            })
        );
        const signature = await sendAndConfirmTransaction(connection, tx, [faucet]);

        // 5) Salvează starea în Realtime DB
        await db.ref(`players/${uid}`).update({
            treasureClaimed: true,
            txSig: signature,
        });

        // 6) Returnează răspuns OK
        return res.status(200).json({ result: signature });
    } catch (e: any) {
        console.error('claimTreasure error:', e);
        const code = e.code === 'auth/argument-error' ? 401 : 500;
        return res.status(code).json({ error: e.message });
    }
});
