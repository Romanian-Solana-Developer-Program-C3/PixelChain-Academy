import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Connection, PublicKey, Keypair, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";

admin.initializeApp();

const FAUCET_SECRET = JSON.parse(process.env.FAUCET_SECRET!);   // store in env
const faucet = Keypair.fromSecretKey(Uint8Array.from(FAUCET_SECRET));
const connection = new Connection("https://api.devnet.solana.com");

export const claimTreasure = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");

    const snap = await admin.database().ref(`players/${uid}`).get();
    const player = snap.val();
    if (!player?.wallet) throw new functions.https.HttpsError("failed-precondition", "Wallet missing");
    if (player.treasureClaimed) return "already-claimed";

    const toPubkey = new PublicKey(player.wallet);
    const tx = SystemProgram.transfer({
        fromPubkey: faucet.publicKey,
        toPubkey,
        lamports: 1_000_000_000   // 1 SOL
    });

    const signature = await sendAndConfirmTransaction(connection, tx, [faucet]);

    // mark as claimed
    await admin.database().ref(`players/${uid}`).update({ treasureClaimed: true, txSig: signature });
    return signature;
});