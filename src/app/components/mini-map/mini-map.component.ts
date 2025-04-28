import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { Player } from 'src/app/app.component';

@Component({
  selector: 'app-mini-map',
  templateUrl: './mini-map.component.html',
  styleUrls: ['./mini-map.component.scss']
})
export class MiniMapComponent {
  @Input() src!: string;
  @Input() player!: Player;
  @Input() mapWidth!: number;
  @Input() mapHeight!: number;
  @Output() close = new EventEmitter();

  /** Factor de scalare pentru mini-hartă (20% din dimensiuni) */
  scale = 1;

  /** Ascultă click în afara modalului pentru a închide harta */
  onClose(): void {
    this.close.emit();
  }

  /** Previne propagarea click-ului în interiorul modalului */
  onModalClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  /** Calculează poziția marker-ului jucătorului pe mini-hartă */
  get playerLeft(): string {
    const percentX = (this.player.x / this.mapWidth) * 100;
    return `${percentX * this.scale}%`;
  }

  get playerTop(): string {
    const percentY = (this.player.y / this.mapHeight) * 100;
    return `${percentY * this.scale}%`;
  }
}