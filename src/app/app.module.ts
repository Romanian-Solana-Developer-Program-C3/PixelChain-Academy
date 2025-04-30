// src/app/app.module.ts
import { CUSTOM_ELEMENTS_SCHEMA, NgModule }                   from '@angular/core';
import { BrowserModule }              from '@angular/platform-browser';
import { FormsModule }                from '@angular/forms';

import { AngularFireModule }          from '@angular/fire/compat';
import { AngularFireAuthModule }      from '@angular/fire/compat/auth';
import { AngularFireDatabaseModule }  from '@angular/fire/compat/database';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';

import { HdWalletAdapterModule } from '@heavy-duty/wallet-adapter';

import { environment }                from '../environments/environment';
import { AppRoutingModule }           from './app-routing.module';
import { AppComponent }               from './app.component';
import { MiniMapComponent } from './components/mini-map/mini-map.component';
import { InfoModalComponent } from './components/info-modal/info-modal.component';
import {MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { LoginComponent } from './components/login/login.component';

@NgModule({
  declarations: [AppComponent, MiniMapComponent, InfoModalComponent, LoginComponent],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    MatDialogModule,

    HdWalletAdapterModule.forRoot({
      autoConnect: true,
    }),
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
  bootstrap: [AppComponent]
})
export class AppModule {}
