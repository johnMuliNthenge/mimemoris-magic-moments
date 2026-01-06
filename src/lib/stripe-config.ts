// Stripe product and price configuration
// Maps database subscription tiers to Stripe products

export const STRIPE_TIERS = {
  basic: {
    product_id: "prod_TjwInmR333067C",
    price_id: "price_1SmSQKKhPSFOc2Ir29CLhdUP",
  },
  standard: {
    product_id: "prod_TjwJlD5ClW1D0C",
    price_id: "price_1SmSQTKhPSFOc2IrZweSkWJI",
  },
  premium: {
    product_id: "prod_TjwJvL09GzBsOL",
    price_id: "price_1SmSQdKhPSFOc2IrMTdF6OHk",
  },
} as const;

export type StripeTier = keyof typeof STRIPE_TIERS;

export const getStripePriceId = (tier: StripeTier): string => {
  return STRIPE_TIERS[tier].price_id;
};

export const getStripeProductId = (tier: StripeTier): string => {
  return STRIPE_TIERS[tier].product_id;
};

export const getTierFromProductId = (productId: string): StripeTier | null => {
  for (const [tier, config] of Object.entries(STRIPE_TIERS)) {
    if (config.product_id === productId) {
      return tier as StripeTier;
    }
  }
  return null;
};
