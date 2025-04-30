import { Injectable } from '@angular/core';
import {
  AngularFireAuth
} from '@angular/fire/compat/auth';
import {
  AngularFirestore,
} from '@angular/fire/compat/firestore';

import { WalletStore } from '@heavy-duty/wallet-adapter';
import { firstValueFrom, filter, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private wallet: WalletStore
  ) {}

  signInAnon() {
    return this.afAuth.signInAnonymously();
  }

  hasWallet(uid: string) {
    return this.afs
      .doc(`players/${uid}`)
      .valueChanges()
      .pipe(map((d: any) => !!d?.wallet));
  }

  async saveWallet() {
    const pk = await firstValueFrom(
      this.wallet.publicKey$.pipe(filter(Boolean))
    );

    const user = await this.afAuth.currentUser;
    if (!user) throw new Error('User not logged in');

    await this.afs.doc(`players/${user.uid}`).set(
      {
        wallet: pk.toBase58(),
        updatedAt: new Date(),
      },
      { merge: true }
    );
  }
}
