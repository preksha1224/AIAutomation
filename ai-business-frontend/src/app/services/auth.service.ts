import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

interface Credentials {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly token = signal<string | null>(null);
  readonly userEmail = signal<string | null>(null);
  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      const storedToken = localStorage.getItem('authToken');
      const storedEmail = localStorage.getItem('authEmail');
      if (storedToken) {
        this.token.set(storedToken);
        this.userEmail.set(storedEmail);
      }
    }
  }

  login(cred: Credentials): Observable<any> {
    return this.http.post('/api/auth/login', cred).pipe(
      tap((result: any) => {
        this.token.set(result.token);
        this.userEmail.set(cred.email);
        if (this.isBrowser) {
          localStorage.setItem('authToken', result.token);
          localStorage.setItem('authEmail', cred.email);
        }
      })
    );
  }

  logout() {
    this.token.set(null);
    this.userEmail.set(null);
    if (this.isBrowser) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authEmail');
    }
  }

  isAuthenticated(): boolean {
    return !!this.token();
  }
}
