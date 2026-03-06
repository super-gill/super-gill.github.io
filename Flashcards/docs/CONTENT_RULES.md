# Content rules (Flashcards dataset)

These rules exist so every card works in every mode:
- Flashcards (flip)
- Typing (exact/close + accept lists)
- Multiple choice
- Match translations (two columns)
- Match pairs (tiles)

## Card schema

Minimum:

```js
{ es: "…", en: "…" }
```

Optional (typing-only variants):

```js
{
  es: "Buenas noches",
  en: "Good evening",
  accept: { en: ["Good night", "Good evening"] }
}
```

## Golden rules

1) **True flashcard**: each side must stand alone as a prompt.
2) **Reversible**: ES→EN and EN→ES must both make sense.
3) **One canonical answer**: `en` is the single “display” translation.
   - Put alternate correct answers in `accept.en` / `accept.es`.
4) **No teaching notes inside answers**
   - Avoid literal glosses like “It does sun (It’s sunny)”.
   - If you must keep a note, add it as a separate card or (future) `meta`.
5) **No worksheet fragments**
   - No numbering like `1/ Dad` or `Ex. ...`
   - No emoji-only cards
6) **Deck consistency**
   - Within a deck, pick one style and stick to it:
     - Words: `la madre ↔ mother`
     - Phrases: `por favor ↔ please`
     - Sentences: `Vivo en España. ↔ I live in Spain.`
7) **Match-game safety**
   - Avoid putting slashes in `en` (e.g. `clock / watch`).
   - Use `accept` lists instead, and keep `en` unique and clean.

## Template for new decks

- Start with 20–60 cards.
- Use consistent casing and punctuation.
- Prefer Spain Spanish.

Example deck:

```js
window.RAW_DECKS.my_deck = {
  label: "My deck",
  cards: [
    { es: "Buenos días", en: "Good morning" },
    { es: "Por favor", en: "Please" }
  ]
};
```
