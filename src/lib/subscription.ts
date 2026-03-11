export const PLANS = {
  monthly: {
    price_id: "price_1T9e27FUacKsdY5PdqdISmac",
    product_id: "prod_U7tpqFQ8JNScyH",
    name: "Monthly",
    price: 4.99,
    currency: "AUD",
    interval: "month" as const,
  },
  yearly: {
    price_id: "price_1T9e2cFUacKsdY5P1UEKc8zx",
    product_id: "prod_U7tqqEV4vcBWyu",
    name: "Yearly",
    price: 50,
    currency: "AUD",
    interval: "year" as const,
    savings: "Save 17%",
  },
};
