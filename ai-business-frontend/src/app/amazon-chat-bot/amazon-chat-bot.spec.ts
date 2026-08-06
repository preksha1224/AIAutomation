import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AmazonChatBot } from './amazon-chat-bot';

describe('AmazonChatBot', () => {
  let component: AmazonChatBot;
  let fixture: ComponentFixture<AmazonChatBot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AmazonChatBot],
    }).compileComponents();

    fixture = TestBed.createComponent(AmazonChatBot);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
