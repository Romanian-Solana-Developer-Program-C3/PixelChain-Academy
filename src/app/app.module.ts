// src/app/app.module.ts
import { CUSTOM_ELEMENTS_SCHEMA, NgModule }                   from '@angular/core';
import { BrowserModule }              from '@angular/platform-browser';
import { FormsModule }                from '@angular/forms';

import { AngularFireModule }          from '@angular/fire/compat';
import { AngularFireAuthModule }      from '@angular/fire/compat/auth';
import { AngularFireDatabaseModule }  from '@angular/fire/compat/database';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';

import { HdWalletAdapterModule, provideWalletAdapter } from '@heavy-duty/wallet-adapter';

import { environment }                from '../environments/environment';
import { AppRoutingModule }           from './app-routing.module';
import { AppComponent }               from './app.component';
import { MiniMapComponent } from './components/mini-map/mini-map.component';
import { InfoModalComponent } from './components/info-modal/info-modal.component';
import {MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { LoginComponent } from './components/login/login.component';
import { HdWalletAdapterMaterialModule } from '@heavy-duty/wallet-adapter-material';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ChestModalComponent } from './components/chest-modal/chest-modal.component';
import { getFunctions, provideFunctions } from '@angular/fire/functions';

@NgModule({
  declarations: [AppComponent, MiniMapComponent, InfoModalComponent, LoginComponent, ChestModalComponent],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    MatDialogModule,

    HdWalletAdapterModule.forRoot({
      autoConnect: true,
    }),
    HdWalletAdapterMaterialModule,
    // bootstrap compat
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule,
    AngularFireDatabaseModule,
    NoopAnimationsModule,
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  providers: [
    provideWalletAdapter({ autoConnect: true }),
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
