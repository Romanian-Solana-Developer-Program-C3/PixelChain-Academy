// src/app/services/challenge.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

export interface ChallengeRecord {
    id: number;
    uri: string;
    createdAt: Date;
}

@Injectable({ providedIn: 'root' })
export class ChallengeService {
    constructor(private readonly afs: AngularFirestore) { }

    addChallenge(challenge: Omit<ChallengeRecord, 'createdAt'>) {
        const docId = `challenge_${challenge.id}`;
        return this.afs
            .collection<ChallengeRecord>('challenges')
            .doc(docId)
            .set({ ...challenge, createdAt: new Date() });
    }
}
