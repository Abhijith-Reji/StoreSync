import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-inactivity-lock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inactivity-lock.html',
})
export class InactivityLockComponent {
  protected authService = inject(AuthService);
  readonly pinInput = signal<string>('');
  readonly errorMsg = signal<string>('');

  unlock() {
    const pin = this.pinInput();
    if (!pin) {
      this.errorMsg.set('Please enter PIN or password to unlock terminal.');
      return;
    }

    const success = this.authService.unlockScreen(pin);
    if (success) {
      this.pinInput.set('');
      this.errorMsg.set('');
    } else {
      this.errorMsg.set('Invalid credentials.');
    }
  }

  appendNum(digit: string) {
    this.pinInput.set(this.pinInput() + digit);
  }

  backspace() {
    this.pinInput.set(this.pinInput().slice(0, -1));
  }
}
