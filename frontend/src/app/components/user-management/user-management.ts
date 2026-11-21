import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PosService } from '../../services/pos.service';
import { User, UserRole } from '../../models/types';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.html',
})
export class UserManagementComponent implements OnInit {
  protected posService = inject(PosService);

  readonly users = signal<User[]>([]);
  readonly showCreateModal = signal<boolean>(false);

  // Form Fields
  readonly newUsername = signal<string>('');
  readonly newPassword = signal<string>('');
  readonly newFullName = signal<string>('');
  readonly newRole = signal<UserRole>(UserRole.SALESPERSON);
  readonly roles = [UserRole.OWNER, UserRole.MANAGER, UserRole.SALESPERSON];

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.posService.getUsers().subscribe((data) => this.users.set(data));
  }

  toggleActive(user: User) {
    const newState = !user.isActive;
    this.posService.toggleUserStatus(user.id, newState).subscribe({
      next: () => {
        this.loadUsers();
      },
      error: (err) => alert(`Failed: ${err.message}`),
    });
  }

  createUser() {
    if (!this.newUsername() || !this.newPassword() || !this.newFullName()) {
      alert('Please fill out all onboarding fields.');
      return;
    }

    this.posService
      .createUser({
        username: this.newUsername().trim(),
        password: this.newPassword(),
        fullName: this.newFullName().trim(),
        role: this.newRole(),
      })
      .subscribe({
        next: () => {
          this.showCreateModal.set(false);
          this.newUsername.set('');
          this.newPassword.set('');
          this.newFullName.set('');
          this.loadUsers();
          alert('Staff account onboarded successfully!');
        },
        error: (err) => alert(`Error: ${err.error?.error || err.message}`),
      });
  }
}
