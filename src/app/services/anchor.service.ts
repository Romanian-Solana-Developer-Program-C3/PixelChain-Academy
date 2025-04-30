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

import idl from '../../assets/idl.json';

@Injectable({ providedIn: 'root' })
export class AnchorService {
    private readonly programId = new web3.PublicKey(
        (idl as any).metadata.address
    );

    private _provider?: AnchorProvider;
    private _program?: Program;

    constructor(private walletStore: WalletStore) { }

    private async getProvider(): Promise<AnchorProvider> {
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

    private async getProgram(): Promise<Program> {
        if (this._program) return this._program;

        const provider = await this.getProvider();

        this._program = new Program(idl as Idl, provider);

        return this._program;
    }

    async initPlayer() {
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

    async completeChallenge(challengeId: number) {
        const provider = await this.getProvider();
        const program = await this.getProgram();

        /* TODO: derive PDAs pentru mint/ATA*/
    }
}