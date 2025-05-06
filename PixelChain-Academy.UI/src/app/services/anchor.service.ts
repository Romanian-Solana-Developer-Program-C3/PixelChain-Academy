import { Injectable } from '@angular/core';
import {
    AnchorProvider,
    Program,
    Idl,
    setProvider,
    web3,
    Wallet as AnchorWallet,
} from '@coral-xyz/anchor';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { WalletStore } from '@heavy-duty/wallet-adapter';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Buffer } from "buffer";
(window as any).Buffer = Buffer;

import idl from '../../assets/idl.json';

@Injectable({ providedIn: 'root' })
export class AnchorService {
    public readonly programId = new web3.PublicKey(
        (idl as any).address
    );
    private _provider?: AnchorProvider;
    private _program?: Program<Idl>;

    constructor(private walletStore: WalletStore) { }

    public async getProvider(): Promise<AnchorProvider> {
        if (this._provider) return this._provider;

        const connection = new web3.Connection(
            'https://api.devnet.solana.com',
            'confirmed'
        );

        const wallet = await firstValueFrom(
            this.walletStore.anchorWallet$.pipe(
                filter((w): w is AnchorWallet => !!w),
                take(1)
            )
        );

        this._provider = new AnchorProvider(connection, wallet, {
            commitment: 'confirmed',
        });
        setProvider(this._provider);
        return this._provider;
    }

    public async getProgram(): Promise<Program<Idl>> {
        if (this._program) return this._program;
        const provider = await this.getProvider();
        this._program = new Program(idl as Idl, provider);
        return this._program;
    }

    async initPlayer(): Promise<string> {
        const provider = await this.getProvider();
        const program = await this.getProgram();

        const [playerPda] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from('player'), provider.wallet.publicKey.toBuffer()],
            this.programId
        );

        return program.methods
            .initPlayer()
            .accounts({ player: playerPda })
            .rpc();
    }

    async completeChallenge(challengeId: number): Promise<string> {
        const provider = await this.getProvider();
        const program = await this.getProgram();
        const walletPubkey = provider.wallet.publicKey;

        const [playerPda] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from('player'), walletPubkey.toBuffer()],
            this.programId
        );

        const [challengePda] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from('challenge'), Buffer.from([challengeId])],
            this.programId
        );

        console.log(challengePda);

        const [mintPda] = web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from('reward_mint'),
                walletPubkey.toBuffer(),
                Buffer.from([challengeId]),
            ],
            this.programId
        );

        const rewardAta = await getAssociatedTokenAddress(
            mintPda,
            walletPubkey
        );

        return program.methods
            .completeChallenge(challengeId)
            .accounts({
                player: playerPda,
                challenge: challengePda,
                rewardMint: mintPda,
                rewardAta,
                authority: walletPubkey,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: web3.SYSVAR_RENT_PUBKEY,
            })
            .rpc();
    }

    async adminAddChallenge(challengeId: number, uri: string): Promise<string> {
        const provider = await this.getProvider();
        const program = await this.getProgram();
        const wallet = provider.wallet.publicKey;

        const [challengePda] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from('challenge'), Buffer.from([challengeId])],
            this.programId
        );

        return program.methods
            .adminAddChallenge(challengeId, uri)
            .accounts({
                challenge: challengePda,
                authority: wallet,
                systemProgram: web3.SystemProgram.programId,
            })
            .rpc();
    }
}
