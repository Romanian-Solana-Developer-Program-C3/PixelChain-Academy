import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFireDatabase } from '@angular/fire/database';

interface Player {
  id: string;
  name: string;
  direction: string;
  color: string;
  x: number;    // coordonată orizontală în pixeli (pe baza hărții)
  y: number;    // coordonată verticală în pixeli (pe baza hărții)
  coins: number;
}

interface Coin {
  x: number;    // coordonată orizontală în pixeli (pe baza hărții)
  y: number;    // coordonată verticală în pixeli (pe baza hărții)
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  playerName: string = '';
  playerId: string = '';
  players: { [key: string]: Player } = {};
  coins: { [key: string]: Coin } = {};

  // lista de culori pentru jucatori
  playerColors: string[] = ['blue', 'red', 'orange', 'yellow', 'green', 'purple'];

  // dimensiunile containerului (rezolutia ecranului)
  containerWidth: number = 1920;
  containerHeight: number = 1065;

  // dimensiunile imaginii hartii
  mapImageWidth: number = 1100;
  mapImageHeight: number = 600;

  // offset pentru a centra harta in container:
  mapOffsetX: number;
  mapOffsetY: number;

  // dimensiunea sprite-ului jucator
  playerSpriteWidth: number = 32;
  playerSpriteHeight: number = 48;

  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;

  constructor(private db: AngularFireDatabase, private auth: AngularFireAuth) {
    // calculăm offset-ul pentru centrare:
    this.mapOffsetX = (this.containerWidth - this.mapImageWidth) / 2; // 128 px
    this.mapOffsetY = (this.containerHeight - this.mapImageHeight) / 2; // aproximativ 84 px
  }

  ngOnInit(): void {
    // autentificare anonima cu Firebase
    this.auth.signInAnonymously().then(() => {
      this.auth.authState.subscribe((user) => {
        if (user) {
          this.playerId = user.uid;
          // alegem o pozitie sigura in interiorul hartii (in pixeli, folosind offset si limitele hartii)
          const { x, y } = this.getRandomSafeSpot();
          this.playerName = this.createName();

          const initialPlayer: Player = {
            id: this.playerId,
            name: this.playerName,
            direction: 'right',
            color: this.getRandomColor(),
            x,
            y,
            coins: 0,
          };

          // salvam datele initiale in Firebase
          this.db.object(`players/${this.playerId}`).set(initialPlayer);

          // stergem jucatorul la deconectare
          this.db.object(`players/${this.playerId}`).query.ref.onDisconnect().remove();

          // pornim event listenerii pentru actualizari in timp real
          this.initGameListeners();
        }
      });
    });
  }

  // listener pentru event-uri de la tastatura
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case 'ArrowUp':
        this.handleArrowPress(0, -10);
        break;
      case 'ArrowDown':
        this.handleArrowPress(0, 10);
        break;
      case 'ArrowLeft':
        this.handleArrowPress(-10, 0);
        break;
      case 'ArrowRight':
        this.handleArrowPress(10, 0);
        break;
    }
  }

  // actualizeaza numele jucatorului in Firebase cand inputul de nume se schimba
  updateName() {
    this.db.object(`players/${this.playerId}`).update({
      name: this.playerName,
    });
  }

  // schimba culoarea jucatorului
  changeColor() {
    const currentPlayer = this.players[this.playerId];
    if (!currentPlayer) return;
    const currentIndex = this.playerColors.indexOf(currentPlayer.color);
    const nextColor = this.playerColors[(currentIndex + 1) % this.playerColors.length];
    this.db.object(`players/${this.playerId}`).update({
      color: nextColor,
    });
  }

  /**
   * actualizeaza pozitia jucatorului, limitand miscarea la suprafata hartii (in functie de dimensiunea imaginii si offset).
   */
  handleArrowPress(xChange: number, yChange: number) {
    const currentPlayer = this.players[this.playerId];
    if (!currentPlayer) return;
    let newX = currentPlayer.x + xChange;
    let newY = currentPlayer.y + yChange;

    // limitele hartii calculate cu offset:
    const leftBoundary = this.mapOffsetX;
    const topBoundary = this.mapOffsetY;
    const rightBoundary = this.mapOffsetX + this.mapImageWidth - this.playerSpriteWidth;
    const bottomBoundary = this.mapOffsetY + this.mapImageHeight - this.playerSpriteHeight;

    newX = Math.max(leftBoundary, Math.min(rightBoundary, newX));
    newY = Math.max(topBoundary, Math.min(bottomBoundary, newY));

    // actualizam directia jucatorului în functie de miscare
    if (xChange > 0) {
      currentPlayer.direction = 'right';
    } else if (xChange < 0) {
      currentPlayer.direction = 'left';
    }
    currentPlayer.x = newX;
    currentPlayer.y = newY;

    this.db.object(`players/${this.playerId}`).set(currentPlayer);
    this.attemptGrabCoin(newX, newY);
  }

  // listeneri pentru actualizarile din Firebase
  initGameListeners() {
    // actualizeaza lista jucatorilor
    this.db.object('players').valueChanges().subscribe((data: any) => {
      this.players = data || {};
    });

    // actualizeaza lista monedelor
    this.db.object('coins').valueChanges().subscribe((data: any) => {
      this.coins = data || {};
    });

    // functia care plaseaza monedele pe harta
    this.placeCoin();
  }

  // preia moneda de la coordonatele (x, y)
  attemptGrabCoin(x: number, y: number) {
    const key = this.getKeyString(x, y);
    if (this.coins && this.coins[key]) {
      // stergem moneda din Firebase si incrementeaza contorul de monede
      this.db.object(`coins/${key}`).remove();
      const currentPlayer = this.players[this.playerId];
      if (currentPlayer) {
        const newCoins = (currentPlayer.coins || 0) + 1;
        this.db.object(`players/${this.playerId}`).update({ coins: newCoins });
      }
    }
  }

  // plaseaza o moneda intr-o pozitie aleatorie in interiorul suprafetei hartii
  placeCoin() {
    const { x, y } = this.getRandomSafeSpot();
    const key = this.getKeyString(x, y);
    this.db.object(`coins/${key}`).set({ x, y });

    const coinTimeouts = [2000, 3000, 4000, 5000];
    setTimeout(() => this.placeCoin(), this.randomFromArray(coinTimeouts));
  }

  // functii helper

  randomFromArray(array: any[]): any {
    return array[Math.floor(Math.random() * array.length)];
  }

  // generarea unei chei unice pe baza coordonatelor
  getKeyString(x: number, y: number): string {
    return `${x}x${y}`;
  }

  createName(): string {
    const prefixes = [
      'COOL', 'SUPER', 'HIP', 'SMUG', 'SILKY', 'GOOD',
      'SAFE', 'DEAR', 'DAMP', 'WARM', 'RICH', 'LONG',
      'DARK', 'SOFT', 'BUFF', 'DOPE',
    ];
    const animals = [
      'BEAR', 'DOG', 'CAT', 'FOX', 'LAMB', 'LION',
      'BOAR', 'GOAT', 'VOLE', 'SEAL', 'PUMA', 'MULE',
      'BULL', 'BIRD', 'BUG',
    ];
    return `${this.randomFromArray(prefixes)} ${this.randomFromArray(animals)}`;
  }

  getRandomColor(): string {
    return this.randomFromArray(this.playerColors);
  }

  /**
   * returneaza o pozitie aleatorie an interiorul suprafetei hartii,
   * calculata pe baza dimensiunilor imaginii hartii si a offset-ului.
   */
  getRandomSafeSpot(): { x: number; y: number } {
    const leftBoundary = this.mapOffsetX;
    const topBoundary = this.mapOffsetY;
    const rightBoundary = this.mapOffsetX + this.mapImageWidth - this.playerSpriteWidth;
    const bottomBoundary = this.mapOffsetY + this.mapImageHeight - this.playerSpriteHeight;
    const randomX = Math.floor(Math.random() * (rightBoundary - leftBoundary)) + leftBoundary;
    const randomY = Math.floor(Math.random() * (bottomBoundary - topBoundary)) + topBoundary;
    return { x: randomX, y: randomY };
  }

  // calcularea transformarilor SCSS pentru pozitionarea jucatorilor (in pixeli)
  getPlayerTransform(player: Player): string {
    return `translate3d(${player.x}px, ${player.y}px, 0)`;
  }

  // calcularea transformarilor SCSS pentru pozitionarea monedelor (in pixeli)
  getCoinTransform(coin: Coin): string {
    return `translate3d(${coin.x}px, ${coin.y}px, 0)`;
  }
}
