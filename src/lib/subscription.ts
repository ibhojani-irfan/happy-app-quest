export const PLANS = {
  monthly: {
    price_id: "price_1T8xnHFUacKsdY5PtyWghi5S",
    product_id: "prod_U7CB8D5NWETZ2z",
    name: "Monthly",
    price: 4.99,
    currency: "AUD",
    interval: "month" as const,
  },
  yearly: {
    price_id: "price_1T8xnaFUacKsdY5PZhFxojji",
    product_id: "prod_U7CBR6fadHde9Q",
    name: "Yearly",
    price: 50,
    currency: "AUD",
    interval: "year" as const,
    savings: "Save 17%",
  },
};
