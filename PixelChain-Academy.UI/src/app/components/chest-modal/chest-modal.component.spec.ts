import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChestModalComponent } from './chest-modal.component';

describe('ChestModalComponent', () => {
  let component: ChestModalComponent;
  let fixture: ComponentFixture<ChestModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChestModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChestModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
