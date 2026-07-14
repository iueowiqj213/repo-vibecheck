const stripeKey = process.env.STRIPE_SECRET_KEY;
const databaseUrl = process.env.DATABASE_URL;

export function createCheckout(): string {
  // TODO: replace this mock checkout with the real Stripe session call.
  return `mock-checkout:${Boolean(stripeKey)}:${Boolean(databaseUrl)}`;
}
