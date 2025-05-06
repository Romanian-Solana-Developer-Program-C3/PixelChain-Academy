import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AnchorService } from 'src/app/services/anchor.service';
import { ChallengeService } from 'src/app/services/challenge.service';

@Component({
  selector: 'app-admin-challenge',
  templateUrl: './admin-challenge.component.html',
  styleUrl: './admin-challenge.component.scss'
})
export class AdminChallengeComponent {
  @Output() close = new EventEmitter();

  onClose(): void {
    this.close.emit();
  }

  onModalClick(event: MouseEvent): void {
    event.stopPropagation();
  }
  
  form = this.fb.group({
    challengeId: [null, [Validators.required, Validators.min(0), Validators.max(255)]],
    uri: ['', Validators.required],
  }) as FormGroup & { value: { challengeId: number; uri: string } };

  loading = false;
  message = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly anchor: AnchorService,
    private readonly firestore: ChallengeService
  ) { }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading = true;
    this.message = '';

    const challengeId = this.form.controls.challengeId.value! as number;
    const uri = this.form.controls.uri.value! as string;

    if (challengeId == null) {
      this.message = 'Trebuie să completezi ID-ul!';
      return;
    }

    try {
      const txSig = await this.anchor.adminAddChallenge(challengeId, uri);

      await this.firestore.addChallenge({ id: challengeId, uri });

      this.message = `✅ Challenge #${challengeId} creat!\nTx: ${txSig}`;
      this.form.reset();
    } catch (err: any) {
      console.error(err);
      this.message = '❌ Eroare: ' + (err.message ?? err.toString());
    } finally {
      this.loading = false;
    }
  }
}
