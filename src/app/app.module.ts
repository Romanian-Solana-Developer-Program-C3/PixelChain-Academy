// src/app/app.module.ts
import { NgModule }                   from '@angular/core';
import { BrowserModule }              from '@angular/platform-browser';
import { FormsModule }                from '@angular/forms';

import { AngularFireModule }          from '@angular/fire/compat';
import { AngularFireAuthModule }      from '@angular/fire/compat/auth';
import { AngularFireDatabaseModule }  from '@angular/fire/compat/database';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';

import { environment }                from '../environments/environment';
import { AppRoutingModule }           from './app-routing.module';
import { AppComponent }               from './app.component';
import { MiniMapComponent } from './components/mini-map/mini-map.component';
import { InfoModalComponent } from './components/info-modal/info-modal.component';

@NgModule({
  declarations: [AppComponent, MiniMapComponent, InfoModalComponent],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,

    // bootstrap compat
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFireDatabaseModule,
    AngularFirestoreModule,
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
