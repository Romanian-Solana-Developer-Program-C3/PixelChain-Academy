import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { WalletStore } from '@heavy-duty/wallet-adapter';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  walletReady = false;
  pending = false;

  constructor(
    private dialogRef: MatDialogRef<LoginComponent>,
    private auth: AuthService,
    private wallet: WalletStore
  ) {
    this.wallet.publicKey$.subscribe(pk => (this.walletReady = !!pk));
  }

  async login() {
    this.pending = true;
    await this.auth.signInAnon();
    this.pending = false;
  }

  async link() {
    this.pending = true;
    await this.auth.saveWallet();
    this.pending = false;
    this.dialogRef.close();
  }
}
