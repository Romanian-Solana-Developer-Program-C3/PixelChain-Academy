import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { signInAnonymously } from 'firebase/auth';
import { Database, ref, set, onValue, onDisconnect, update, remove } from '@angular/fire/database';
import { Auth }     from '@angular/fire/auth';

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

  private pressedKeys = new Set<string>();
  private readonly BASE_STEP = 3;

  // dimensiunile containerului (rezolutia ecranului)
  containerWidth: number = 1920;
  containerHeight: number = 1065;

  // dimensiunile imaginii hartii
  mapImageWidth: number = 1100;
  mapImageHeight: number = 600;

  // offset pentru a centra harta in container:
  mapOffsetX = 0;
  mapOffsetY = 0;

  // dimensiunea sprite-ului jucator
  playerSpriteWidth: number = 32;
  playerSpriteHeight: number = 32;

  zoom = 6;

  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;

  worldOffsetX = -420;
  worldOffsetY = -400;

  isWalking = false;

  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;

  constructor(private auth: Auth, private db: Database) {
    // calculăm offset-ul pentru centrare:
    const maxOffsetX = 0;
    const minOffsetX = this.viewportWidth - this.mapImageWidth * this.zoom;

    const maxOffsetY = 0;
    const minOffsetY = this.viewportHeight - this.mapImageHeight * this.zoom;

    this.worldOffsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.worldOffsetX));
    this.worldOffsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.worldOffsetY));
  }

  ngOnInit(): void {
    // autentificare anonima cu Firebase
    signInAnonymously(this.auth).then(() => {
      // ascultă authState
      this.auth.onAuthStateChanged((user) => {
        if (user) {
          this.playerId = user.uid;
          // alegem o pozitie sigura in interiorul hartii (in pixeli, folosind offset si limitele hartii)
          const x = 152;
          const y = 169;
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

          const playerRef = ref(this.db, `players/${this.playerId}`);
          set(playerRef, initialPlayer);
          onDisconnect(playerRef).remove()

          // pornim event listenerii pentru actualizari in timp real
          this.initGameListeners();
        }
      });
    });
  }

  private centerCameraOn(x: number, y: number) {
    // calculează offset‑ul
    this.worldOffsetX = this.viewportWidth / 2 - (x + this.playerSpriteWidth / 2) * this.zoom;
    this.worldOffsetY = this.viewportHeight / 2 - (y + this.playerSpriteHeight / 2) * this.zoom;
    this.constrainWorld();
  }

  private constrainWorld() {
    const minX = this.viewportWidth - this.mapImageWidth * this.zoom;
    const minY = this.viewportHeight - this.mapImageHeight * this.zoom;
    this.worldOffsetX = Math.max(minX, Math.min(0, this.worldOffsetX));
    this.worldOffsetY = Math.max(minY, Math.min(0, this.worldOffsetY));
  }

  // listener pentru event-uri de la tastatura
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      this.pressedKeys.add(event.code);
      this.processMovement();
      event.preventDefault();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    this.pressedKeys.delete(event.code);
    this.processMovement();
  }

  private processMovement(): void {
    let dx = 0;
    let dy = 0;

    const step = this.BASE_STEP;

    if (this.pressedKeys.has('ArrowUp')) dy -= step;
    if (this.pressedKeys.has('ArrowDown')) dy += step;
    if (this.pressedKeys.has('ArrowLeft')) dx -= step;
    if (this.pressedKeys.has('ArrowRight')) dx += step;

    if (dx === 0 && dy === 0) {
      this.isWalking = false;
    }

    if (dx !== 0 && dy !== 0) {
      dx = Math.round(dx / Math.SQRT2);
      dy = Math.round(dy / Math.SQRT2);
    }

    this.handleArrowPress(dx, dy);

    const isMoving = dx !== 0 || dy !== 0;
    if (isMoving == true) this.isWalking = true;
    else this.isWalking = false;
  }

  @HostListener('window:resize')
  onResize() {
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
  }

  // actualizeaza numele jucatorului in Firebase cand inputul de nume se schimba
  updateName() {
    const playerRef = ref(this.db, `players/${this.playerId}`);
    // actualizezi doar câmpul name
    update(playerRef, { name: this.playerName });
  }

  // schimba culoarea jucatorului
  // changeColor() {
  //   const currentPlayer = this.players[this.playerId];
  //   if (!currentPlayer) return;
  //   const currentIndex = this.playerColors.indexOf(currentPlayer.color);
  //   const nextColor = this.playerColors[(currentIndex + 1) % this.playerColors.length];
  //   this.db.object(`players/${this.playerId}`).update({
  //     color: nextColor,
  //   });
  // }

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

    if (xChange > 0 && yChange < 0) currentPlayer.direction = 'up-right';
    else if (xChange > 0 && yChange > 0) currentPlayer.direction = 'down-right';
    else if (xChange < 0 && yChange < 0) currentPlayer.direction = 'up-left';
    else if (xChange < 0 && yChange > 0) currentPlayer.direction = 'down-left';
    else if (xChange > 0) currentPlayer.direction = 'right';
    else if (xChange < 0) currentPlayer.direction = 'left';
    else if (yChange > 0) currentPlayer.direction = 'down';
    else if (yChange < 0) currentPlayer.direction = 'up';

    currentPlayer.x = newX;
    currentPlayer.y = newY;

    this.centerCameraOn(newX, newY);

    const playerRef = ref(this.db, `players/${this.playerId}`);
    set(playerRef, currentPlayer);
    this.attemptGrabCoin(newX, newY);
  }

  // listeneri pentru actualizarile din Firebase
  initGameListeners() {
    // actualizeaza lista jucatorilor
    onValue(ref(this.db, 'players'), snapshot => {
      this.players = snapshot.val() || {};
    });

    // actualizeaza lista monedelor
    onValue(ref(this.db, 'coins'), snapshot => {
      this.coins = snapshot.val() || {};
    });

    // functia care plaseaza monedele pe harta
    this.placeCoin();
  }

  // preia moneda de la coordonatele (x, y)
  attemptGrabCoin(x: number, y: number) {
    const key = this.getKeyString(x, y);

    // 1) stergi moneda
    const coinRef = ref(this.db, `coins/${key}`);
    remove(coinRef)
      .then(() => {
        // 2) incrementezi numărul de monede ale jucătorului
        const currentPlayer = this.players[this.playerId];
        if (currentPlayer) {
          const newCoins = (currentPlayer.coins || 0) + 1;
          const playerRef = ref(this.db, `players/${this.playerId}`);
          update(playerRef, { coins: newCoins })
            .then(() => console.log('Monedă luată, coins=', newCoins))
            .catch(err => console.error('Eroare la update coins:', err));
        }
      })
      .catch(err => {
        // dacă nu exista moneda, remove() va eșua silențios sau cu eroare
        console.warn('Nu s‑a putut șterge moneda:', err);
      });
  }


  // plaseaza o moneda intr-o pozitie aleatorie in interiorul suprafetei hartii
  placeCoin() {
    const { x, y } = this.getRandomSafeSpot();
    const key = this.getKeyString(x, y);
    const coinRef = ref(this.db, `coins/${key}`);

    set(coinRef, { x, y })
      .then(() => console.log(`Monedă plasată la ${key}`))
      .catch(err => console.error('Eroare la plasare monedă:', err));

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

  getWorldStyle() {
    return {
      transform: `
        translate(${this.worldOffsetX}px, ${this.worldOffsetY}px)
        scale(${this.zoom})
      `
    };
  }
}
