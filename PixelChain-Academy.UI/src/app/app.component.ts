import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { debounceTime, empty, firstValueFrom, map, Subject, take } from 'rxjs';
import { colissions } from '../assets/colissions';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from './services/auth.service';
import { LoginComponent } from './components/login/login.component';
import { AngularFirestore } from '@angular/fire/compat/firestore';


export interface Player {
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

export interface Boundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

enum Modals {
  Information = 1001,
  Chest = 1002
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, AfterViewInit {
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

  private readonly TILE_SIZE = 16;
  private readonly COLS = 140;
  private readonly ROWS = 80;
  // dimensiunile imaginii hartii
  mapImageWidth = this.COLS * this.TILE_SIZE;   // 140×16 = 2240
  mapImageHeight = this.ROWS * this.TILE_SIZE;   //  80×16 = 1280

  showMiniMap: boolean = false;

  // offset pentru a centra harta in container:
  mapOffsetX = 0;
  mapOffsetY = 0;

  // dimensiunea sprite-ului jucator
  playerSpriteWidth: number = 32;
  playerSpriteHeight: number = 32;

  zoom = 4;

  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;

  worldOffsetX = -1550;
  worldOffsetY = -1400;

  isWalking = false;
  movement$ = new Subject<Player>();
  boundaries: Boundary[] = [];
  informationPopUpCoordinates: Boundary = {
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };
  isInformationModalOpened = false;
  chestPopUpCoordinates: Boundary = {
    x: 1,
    y: 1,
    width: 1,
    height: 1
  };
  isChestModalOpened = false;
  colissionsMap: [] = [];

  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;

  constructor(
    private dialog: MatDialog,
    private authSvc: AuthService,
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private db: AngularFireDatabase) {
    // calculăm offset-ul pentru centrare:
    const maxOffsetX = 0;
    const minOffsetX = this.viewportWidth - this.mapImageWidth * this.zoom;

    const maxOffsetY = 0;
    const minOffsetY = this.viewportHeight - this.mapImageHeight * this.zoom;

    this.worldOffsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.worldOffsetX));
    this.worldOffsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.worldOffsetY));

    this.movement$.pipe(debounceTime(100)).subscribe(p => {
      this.db.object(`players/${this.playerId}`).update({
        x: p.x,
        y: p.y,
        direction: p.direction
      });
    });
  }

  ngOnInit(): void {
    this.afAuth.authState.subscribe(async user => {
      if (!user) {
        this.openLoginDialog();
        return;
      }

      const snap = await firstValueFrom(
        this.afs.doc(`players/${user.uid}`).get()
      );

      const hasWallet = await this.afs
        .doc(`players/${user.uid}`)
        .valueChanges()
        .pipe(
          take(1),
          map((d: any) => !!d?.wallet)
        )
        .toPromise();


      if (!hasWallet) {
        this.openLoginDialog();
        return;
      }

      this.startGame(user.uid);
    });
  }

  private openLoginDialog() {
    this.dialog.open(LoginComponent, {
      disableClose: true,
      width: '400px',
    });
  }

  private async startGame(userUid: string) {

    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const cell = colissions[row * this.COLS + col];
    
        // tile = 15713  → obstacol (roşu pe harta Tiled)
        if (cell === 15713) {
          this.boundaries.push({
            x: col * this.TILE_SIZE,
            y: row * this.TILE_SIZE,
            width:  this.TILE_SIZE,
            height: this.TILE_SIZE,
          });
        }
    
        // tile = 1001  → pătratul care deschide modalul de informaţii
        if (cell === 1001 /* Modals.Information */) {
          this.informationPopUpCoordinates = {
            x: col * this.TILE_SIZE,
            y: row * this.TILE_SIZE,
            width:  this.TILE_SIZE,
            height: this.TILE_SIZE,
          };
        }

        // tile = 1002  → pătratul care deschide modalul pentru chest
        if (cell === 1002 /* Modals.Chest */) {
          this.chestPopUpCoordinates = {
            x: col * this.TILE_SIZE,
            y: row * this.TILE_SIZE,
            width:  this.TILE_SIZE,
            height: this.TILE_SIZE,
          };
          console.log(this.chestPopUpCoordinates);
        }
      }
    }

    this.playerId = userUid;
    const x = 320, y = 380;

    this.centerCameraOn(x, y);
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

    await this.db.object(`players/${this.playerId}`).set(initialPlayer);
    this.db.object(`players/${this.playerId}`).query.ref.onDisconnect().remove();
    this.initGameListeners();
  }


  ngAfterViewInit() {
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private gameLoop() {
    this.processMovement();
    requestAnimationFrame(this.gameLoop.bind(this));
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
      event.preventDefault();
    }
    if (event.key.toLowerCase() === 'm') {
      this.showMiniMap = !this.showMiniMap;
      console.log(this.showMiniMap);
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    this.pressedKeys.delete(event.code);
    this.processMovement();
  }

  toggleMiniMap(): void {
    this.showMiniMap = !this.showMiniMap;
  }

  toggleInfoModal(): void {
    this.isInformationModalOpened = !this.isInformationModalOpened;
  }

  toggleChestModal(): void {
    this.isChestModalOpened = !this.isChestModalOpened;
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

    if (dx !== 0 || dy !== 0) {
      const mag = Math.hypot(dx, dy);
      dx = (dx / mag) * this.BASE_STEP;
      dy = (dy / mag) * this.BASE_STEP;
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
    this.db.object(`players/${this.playerId}`).update({
      name: this.playerName,
    });
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
  /**
   * Încearcă să mute jucătorul cu xChange, yChange
   * respectând:
   *  - marginile hărții (mapOffsetX/Y + mapImageWidth/Height)
   *  - zonele de coliziune din this.boundaries
   */
  handleArrowPress(xChange: number, yChange: number) {
    const currentPlayer = this.players[this.playerId];
    if (!currentPlayer) return;

    // —— 1) calculează mapOffset din camera worldOffset/zoom
    //     (hartă = coordonate interne la world)
    const mapOffsetX = -this.worldOffsetX / this.zoom;
    const mapOffsetY = -this.worldOffsetY / this.zoom;

    // —— 2) limitează încercarea de mişcare la marginile hărţii
    const minX = mapOffsetX;
    const minY = mapOffsetY;
    const maxX = mapOffsetX + this.mapImageWidth - this.TILE_SIZE;
    const maxY = mapOffsetY + this.mapImageHeight - this.TILE_SIZE;

    let attemptX = currentPlayer.x + xChange;
    let attemptY = currentPlayer.y + yChange;

    attemptX = Math.max(minX, Math.min(maxX, attemptX));
    attemptY = Math.max(minY, Math.min(maxY, attemptY));

    // —— 3) collision‑detection pas‑cu‑pas
    let finalX = currentPlayer.x;
    if (!this.checkCollision(
      attemptX,
      currentPlayer.y,
      this.TILE_SIZE,
      this.TILE_SIZE
    )) {
      finalX = attemptX;
    }

    let finalY = currentPlayer.y;
    if (!this.checkCollision(
      finalX,
      attemptY,
      this.TILE_SIZE,
      this.TILE_SIZE
    )) {
      finalY = attemptY;
    }

    if (this.checkInformationModal(
      finalX,
      attemptY,
      this.TILE_SIZE,
      this.TILE_SIZE
    )) {
      this.isInformationModalOpened = true;
    }
    else {
      this.isInformationModalOpened = false;
    }

    if (this.checkChestModal(
      finalX,
      attemptY,
      this.TILE_SIZE,
      this.TILE_SIZE
    )) {
      this.isChestModalOpened = true;
    }
    else {
      this.isChestModalOpened = false;
    }

    // —— 4) actualizează direcţia (bazată pe xChange/yChange originale)
    if (xChange > 0 && yChange < 0) currentPlayer.direction = 'up-right';
    else if (xChange > 0 && yChange > 0) currentPlayer.direction = 'down-right';
    else if (xChange < 0 && yChange < 0) currentPlayer.direction = 'up-left';
    else if (xChange < 0 && yChange > 0) currentPlayer.direction = 'down-left';
    else if (xChange > 0) currentPlayer.direction = 'right';
    else if (xChange < 0) currentPlayer.direction = 'left';
    else if (yChange > 0) currentPlayer.direction = 'down';
    else if (yChange < 0) currentPlayer.direction = 'up';

    // —— 5) dacă s‑a mutat pe vreo axă, aplică mutarea
    if (finalX !== currentPlayer.x || finalY !== currentPlayer.y) {
      currentPlayer.x = finalX;
      currentPlayer.y = finalY;

      this.centerCameraOn(finalX, finalY);
      this.movement$.next(currentPlayer);
      this.attemptGrabCoin(finalX, finalY);

      this.isWalking = true;
    } else {
      // blocat → oprim animația
      this.isWalking = false;
    }
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
    const yOffset = this.playerSpriteHeight - this.TILE_SIZE; // 32 - 16 = 16
    return `translate3d(
      ${player.x}px,
      ${player.y - yOffset}px,
      0
    )`;
  }

  // calcularea transformarilor SCSS pentru pozitionarea monedelor (in pixeli)
  getCoinTransform(coin: Coin): string {
    return `translate3d(${coin.x}px, ${coin.y}px, 0)`;
  }

  getWorldStyle() {
    return {
      transform: `translate(${this.worldOffsetX}px, ${this.worldOffsetY}px) scale(${this.zoom})`
    };
  }

  private checkCollision(x: number, y: number, width: number, height: number): boolean {
    return this.boundaries.some(b =>
      x < b.x + b.width &&
      x + width > b.x &&
      y < b.y + b.height &&
      y + height > b.y
    );
  }

  private checkInformationModal(x: number, y: number, width: number, height: number): boolean {
    let coordinates: Boundary;
    coordinates = this.informationPopUpCoordinates;
    return x < coordinates.x + coordinates.width &&
      x + width > coordinates.x &&
      y < coordinates.y + coordinates.height &&
      y + height > coordinates.y;
  }

  private checkChestModal(x: number, y: number, width: number, height: number): boolean {
    let coordinates: Boundary;
    coordinates = this.chestPopUpCoordinates;
    return x < coordinates.x + coordinates.width &&
      x + width > coordinates.x &&
      y < coordinates.y + coordinates.height &&
      y + height > coordinates.y;
  }

  private lerp(start: number, end: number, t: number) {
    return start + (end - start) * t;
  }

  private updateCamera() {
    const p = this.players[this.playerId];
    if (!p) return;

    const targetX = this.viewportWidth / 2 - (p.x + this.playerSpriteWidth / 2) * this.zoom;
    const targetY = this.viewportHeight / 2 - (p.y + this.playerSpriteHeight / 2) * this.zoom;

    // t mic = mişcare mai „moale”
    this.worldOffsetX = this.lerp(this.worldOffsetX, targetX, 0.1);
    this.worldOffsetY = this.lerp(this.worldOffsetY, targetY, 0.1);
    this.constrainWorld();
  }

}
