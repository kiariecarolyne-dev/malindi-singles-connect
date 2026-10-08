/**
 * 💎 Malindi Gold product definition.
 *
 * Gold is a ONE-TIME KSh 100 purchase — never a subscription:
 *   · no monthly renewal
 *   · no weekly renewal
 *   · no recurring fee
 *   · no expiry
 *
 * Payment is handled server-side by the Render backend via M-Pesa (Daraja).
 * These values drive the paywall UI; the backend independently enforces the
 * KSh 100 price and owns Gold activation.
 */

/** How many incoming likes a free member sees clearly before the blur starts. */
export const FREE_VISIBLE_LIKES = 3;

export const GOLD = {
  id: 'gold',
  emoji: '💎',
  name: 'Malindi Gold',
  price: 100,
  priceLabel: 'KSh 100',
  currency: 'KSh',
  billing: 'one_time',
  billingLabel: 'ONE-TIME PAYMENT',
  tagline: 'KSh 100 — Pay Once, Keep Forever',
  noFees: 'No monthly fees. No renewal fees.',
  cta: 'Unlock Malindi Gold',
  unlockCta: 'UNLOCK FOR KSh 100',
  closing: 'You only pay once. Your Gold membership does not expire.',
  benefits: [
    'See ALL people who like you',
    'Unblur their profile photos',
    'Discover everyone who is interested in you',
    'Keep Gold forever',
    'No monthly subscription',
    'No renewal fees',
  ],
};

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 'KSh 0',
    features: [
      `${FREE_VISIBLE_LIKES} likes you can see clearly`,
      'Discover singles around Malindi',
      'Like, match and chat',
      'Meet Today, safety tools and reports',
    ],
    missing: ['See everyone who likes you', 'Unblurred like photos'],
  },
  premium: {
    id: 'premium',
    name: GOLD.name,
    price: `${GOLD.priceLabel} one-time`,
    features: GOLD.benefits,
    missing: [],
  },
};
