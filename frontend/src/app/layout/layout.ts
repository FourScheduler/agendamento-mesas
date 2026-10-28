import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Topbar } from '../shared/topbar/topbar';
import { ToastContainer } from '../shared/toast/toast-container';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, Topbar, ToastContainer],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  readonly auth = inject(AuthService);
  readonly usuario = this.auth.usuario;
}