import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

interface ChatMessage {
  id: number;
  sender: 'bot' | 'user';
  text: string;
}

@Component({
  selector: 'app-chat-bot',
  templateUrl: './chat-bot.html',
  styleUrl: './chat-bot.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatBot {
  protected readonly open = signal(false);
  protected readonly draft = signal('');
  protected readonly canSend = computed(() => this.draft().trim().length > 0);
  private nextMessageId = 2;
  protected readonly messages = signal<ChatMessage[]>([
    {
      id: 1,
      sender: 'bot',
      text: 'Hi! I can help you find a recipe or plan what to cook.',
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

  private submitText(text: string): void {
    if (!text) {
      return;
    }

    this.messages.update((messages) => [
      ...messages,
      { id: this.nextMessageId++, sender: 'user', text },
      { id: this.nextMessageId++, sender: 'bot', text: this.createReply(text) },
    ]);
    this.draft.set('');
  }

  private createReply(text: string): string {
    const message = text.toLowerCase();

    if (message.includes('quick') || message.includes('fast') || message.includes('minute')) {
      return 'Try a 20-minute pasta, a quick vegetable stir-fry, or an avocado breakfast toast. Use the search above to narrow by ingredients.';
    }
    if (message.includes('breakfast')) {
      return 'For breakfast, look for oats, eggs, pancakes, or a fresh smoothie in the Breakfast category.';
    }
    if (message.includes('lunch')) {
      return 'A grain bowl, soup, or crisp salad is a great lunch. Try the Lunch category for a few ideas.';
    }
    if (message.includes('dinner')) {
      return 'For dinner, consider pasta, curry, or sheet-pan vegetables. Open the Dinner category to explore.';
    }
    if (message.includes('dessert') || message.includes('sweet')) {
      return 'Something sweet sounds good! Browse the Dessert category for cakes, fruit treats, and more.';
    }
    if (message.includes('vegetarian') || message.includes('vegan')) {
      return 'Use the recipe search for ingredients like tofu, beans, lentils, or vegetables to find a plant-friendly option.';
    }
    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
      return 'Hello! What are you in the mood to cook today?';
    }
    return 'I can help with breakfast, lunch, dinner, desserts, vegetarian ideas, or quick meals. What would you like to cook?';
  }
}
