import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ChatComponent } from './chat/chat.component';
import { Documents } from './documents/documents';
import { AmazonChatBot } from './amazon-chat-bot/amazon-chat-bot';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: AuthComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'documents', component: Documents},
  { path: 'chat', component: ChatComponent },
  { path: 'amazon-chat', component: AmazonChatBot},
  { path: '**', redirectTo: 'dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
