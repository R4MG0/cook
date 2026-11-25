import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { RecipeService } from '../../services/recipe.service';
import { Recipe } from '../../models/recipe.model';

interface ChatMessage {
  id: number;
  sender: 'bot' | 'user';
  text: string;
  time: string;
}

@Component({
  selector: 'app-chat-bot',
  templateUrl: './chat-bot.html',
  styleUrl: './chat-bot.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatBot {
  private readonly recipeService = inject(RecipeService);
  private readonly elementRef = inject(ElementRef);
  protected readonly open = signal(false);
  protected readonly draft = signal('');
  protected readonly typing = signal(false);
  protected readonly canSend = computed(() => this.draft().trim().length > 0);
  private nextMessageId = 2;
  protected readonly messages = signal<ChatMessage[]>([
    {
      id: 1,
      sender: 'bot',
      text: 'Hi! I know the recipes in your kitchen. Ask me for a meal, category, or time limit.',
      time: this.currentTime(),
    },
  ]);

  protected toggle(): void {
    this.open.update((isOpen) => !isOpen);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected updateDraft(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected sendSuggested(text: string): void {
    this.submitText(text);
  }

  protected send(event: Event): void {
    event.preventDefault();
    this.submitText(this.draft().trim());
  }

  protected sendOnEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.submitText(this.draft().trim());
    }
  }

  protected clearChat(): void {
    this.messages.set([
      {
        id: 1,
        sender: 'bot',
        text: 'Chat cleared. What would you like to cook?',
        time: this.currentTime(),
      },
    ]);
    this.nextMessageId = 2;
  }

  private submitText(text: string): void {
    if (!text || this.typing()) {
      return;
    }

    this.messages.update((messages) => [
      ...messages,
      { id: this.nextMessageId++, sender: 'user', text, time: this.currentTime() },
    ]);
    this.draft.set('');
    this.typing.set(true);
    this.scrollToLatest();

    window.setTimeout(() => {
      this.messages.update((messages) => [
        ...messages,
        { id: this.nextMessageId++, sender: 'bot', text: this.createReply(text), time: this.currentTime() },
      ]);
      this.typing.set(false);
      this.scrollToLatest();
    }, 550);
  }

  private createReply(text: string): string {
    const message = text.toLowerCase();
    const recipes = this.recipeService.recipes();

    if (recipes.length === 0) {
      return 'I’m waiting for your recipe collection to load. Try again in a moment.';
    }

    const categories = ['breakfast', 'lunch', 'dinner', 'dessert'];
    const requestedCategory = categories.find((category) => message.includes(category));
    if (requestedCategory) {
      const matches = recipes.filter((recipe) =>
        recipe.category.toLowerCase() === requestedCategory,
      );
      if (matches.length > 0) {
        return this.formatMatches(requestedCategory, matches);
      }
    }

    const quickMatch = /(quick|fast|15|min|20|min)/.test(message);
    if (quickMatch) {
      const matches = recipes.filter((recipe) => recipe.time <= 30);
      if (matches.length > 0) {
        return `Here are some quick picks (30 minutes or less):${this.formatRecipeNames(matches)}`;
      }
    }

    const topMatch = /(top|best|highest|popular|rating)/.test(message);
    if (topMatch) {
      const matches = [...recipes].sort((a, b) => b.rating - a.rating).slice(0, 3);
      return `Your highest-rated picks:${this.formatRecipeNames(matches)}`;
    }

    const exactMatches = recipes.filter((recipe) => {
      const searchable = `${recipe.title} ${recipe.category} ${recipe.steps.join(' ')}`.toLowerCase();
      return message.split(/\s+/).some((word) => word.length > 3 && searchable.includes(word));
    });
    if (exactMatches.length > 0) {
      return `I found these recipe matches:${this.formatRecipeNames(exactMatches.slice(0, 3))}`;
    }

    if (/hello|^hi\b|hey/.test(message)) {
      return 'Hello! Ask me for “quick dinner”, “dessert”, “top rated”, or an ingredient you have.';
    }

    return `Try asking for a category, a time limit, or an ingredient. For example: “quick dinner with chicken” or “something sweet.”`;
  }

  private formatMatches(category: string, matches: Recipe[]): string {
    const title = category.charAt(0).toUpperCase() + category.slice(1);
    return `${title} ideas from your collection:${this.formatRecipeNames(matches)}`;
  }

  private formatRecipeNames(recipes: Recipe[]): string {
    return recipes.slice(0, 3).map((recipe) =>
      `\n• ${recipe.title} — ${recipe.time} min · ★ ${recipe.rating}`,
    ).join('');
  }

  private currentTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToLatest(): void {
    window.setTimeout(() => {
      const messages = this.elementRef.nativeElement.querySelector('.chat-messages') as HTMLElement | null;
      if (messages) {
        messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
      }
    });
  }
}
