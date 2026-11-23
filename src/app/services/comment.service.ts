import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RecipeComment } from '../models/comment.model';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly http = inject(HttpClient);

  list(recipeId: number): Observable<RecipeComment[]> {
    return this.http.get<RecipeComment[]>(`/api/recipes/${recipeId}/comments`);
  }

  create(recipeId: number, body: string): Observable<RecipeComment> {
    return this.http.post<RecipeComment>(`/api/recipes/${recipeId}/comments`, { body });
  }
}
