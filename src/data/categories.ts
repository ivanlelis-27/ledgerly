export type CategoryDef = {
    id: string;
    name: string;
    subcategories: string[];
};

export const CATEGORIES: CategoryDef[] = [
    {
        id: "groceries",
        name: "Groceries",
        subcategories: ["rice/noodles", "meat", "veggies", "snacks", "drinks", "toiletries"],
    },
    {
        id: "foodDrink",
        name: "Food & Drink",
        subcategories: ["fast food", "coffee", "milktea", "restaurants", "delivery"],
    },
    {
        id: "transport",
        name: "Transport",
        subcategories: ["jeep/bus", "MRT/LRT", "gas", "parking", "grab/angkas", "maintenance"],
    },
    {
        id: "bills",
        name: "Bills & Utilities",
        subcategories: ["electricity", "water", "internet", "mobile load", "rent", "HOA"],
    },

    {
        id: "subscriptions",
        name: "Subscriptions",
        subcategories: [
            "streaming",
            "music",
            "software",
            "cloud storage",
            "gaming",
            "news",
            "productivity",
            "other",
        ],
    },
    
    { id: "health", name: "Health", subcategories: ["meds", "checkups", "gym", "supplements"] },
    { id: "shopping", name: "Shopping", subcategories: ["clothing", "gadgets", "home stuff", "gifts"] },
    { id: "education", name: "Education", subcategories: ["courses", "books", "school fees"] },
    { id: "debt", name: "Debt & Payments", subcategories: ["loan", "credit card payment", "interest"] },
    { id: "savings", name: "Savings & Investments", subcategories: ["savings", "crypto", "stocks"] },
];
