import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { timer, Subscription } from 'rxjs';
import { httpsCallable, getFunctions } from '@angular/fire/functions';

@Component({
  selector: 'app-chest-modal',
  templateUrl: './chest-modal.component.html',
  styleUrl: './chest-modal.component.scss'
})
export class ChestModalComponent implements OnDestroy {
  @Output() close = new EventEmitter();

  onClose(): void {
    this.close.emit();
  }

  onModalClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  /** Interval după care se poate revendica (ms) */
  readonly allowAfter = 1_000; // 2 min

  /** câte secunde mai sunt până la deblocare (pentru UI) */
  remaining = Math.ceil(this.allowAfter / 1000);

  private countdownSub?: Subscription;

  constructor(
  ) {
    // la deschiderea dialogului pornește un timer 1 s
    this.countdownSub = timer(0, 1000).subscribe(tick => {
      this.remaining = Math.max(0, Math.ceil(this.allowAfter / 1000) - tick);
      if (this.remaining === 0 && this.countdownSub) {
        this.countdownSub.unsubscribe();  // oprim timerul
      }
    });
  }

  /** butonul e activ doar când nu mai sunt secunde rămase */
  get canClaim() {
    return this.remaining === 0;
  }

  async claim() {
    if (!this.canClaim) return;
    try {
      const claimTreasure = httpsCallable(getFunctions(), 'claimTreasure');
      const res = await claimTreasure({});
      alert(`1 SOL sent!\nTx: ${res.data as string}`);
      this.onClose();
    } catch (err: any) {
      alert('Error: ' + (err.message ?? err));
    }
  }

  ngOnDestroy() {
    this.countdownSub?.unsubscribe();
  }
}
