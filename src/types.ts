export interface Person {
  id: string;
  name: string;
}

export interface Item {
  id: string;
  name: string;
  price: number;
  dividers: string[]; // Person IDs who will split this item
}

export interface BillCharges {
  taxEnabled: boolean;
  taxRate: number;
  serviceEnabled: boolean;
  serviceRate: number;
  tipEnabled: boolean;
  tipRate: number;
}

export interface Bill {
  id: string;
  name: string;
  persons: Person[];
  items: Item[];
  settlementRecipientId: string | null;
  charges: BillCharges;
}

export interface PersonSummary {
  personId: string;
  personName: string;
  totalAmount: number;
  itemBreakdown: {
    itemName: string;
    itemPrice: number;
    splitAmount: number;
    splitWith: number;
  }[];
}
