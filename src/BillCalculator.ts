import { Bill, Person, Item, PersonSummary, BillCharges } from './types';

export class BillCalculator {
  private bills: Bill[] = [];

  loadBills(bills: Bill[]): void {
    this.bills = bills.map(bill => ({
      id: bill.id,
      name: bill.name,
      persons: bill.persons.map(person => ({
        id: person.id,
        name: person.name
      })),
      items: bill.items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        dividers: [...item.dividers]
      })),
      settlementRecipientId: bill.settlementRecipientId ?? null,
      charges: {
        taxEnabled: typeof bill.charges?.taxEnabled === 'boolean' ? bill.charges.taxEnabled : (Number.isFinite(bill.charges?.taxRate) ? bill.charges.taxRate > 0 : false),
        taxRate: this.normalizeChargeRate(bill.charges?.taxRate),
        serviceEnabled: typeof bill.charges?.serviceEnabled === 'boolean' ? bill.charges.serviceEnabled : (Number.isFinite(bill.charges?.serviceRate) ? bill.charges.serviceRate > 0 : false),
        serviceRate: this.normalizeChargeRate(bill.charges?.serviceRate),
        tipEnabled: typeof bill.charges?.tipEnabled === 'boolean' ? bill.charges.tipEnabled : (Number.isFinite(bill.charges?.tipRate) ? bill.charges.tipRate > 0 : false),
        tipRate: this.normalizeChargeRate(bill.charges?.tipRate)
      }
    }));
  }

  exportBills(): Bill[] {
    return this.bills.map(bill => ({
      id: bill.id,
      name: bill.name,
      persons: bill.persons.map(person => ({
        id: person.id,
        name: person.name
      })),
      items: bill.items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        dividers: [...item.dividers]
      })),
      settlementRecipientId: bill.settlementRecipientId,
      charges: {
        taxEnabled: bill.charges.taxEnabled,
        taxRate: bill.charges.taxRate,
        serviceEnabled: bill.charges.serviceEnabled,
        serviceRate: bill.charges.serviceRate,
        tipEnabled: bill.charges.tipEnabled,
        tipRate: bill.charges.tipRate
      }
    }));
  }

  // Create a new bill
  createBill(name: string): string {
    const billId = this.generateId();
    const newBill: Bill = {
      id: billId,
      name,
      persons: [],
      items: [],
      settlementRecipientId: null,
      charges: {
        taxEnabled: false,
        taxRate: 0,
        serviceEnabled: false,
        serviceRate: 0,
        tipEnabled: false,
        tipRate: 0
      }
    };
    this.bills.push(newBill);
    return billId;
  }

  // Get all bills
  getBills(): Bill[] {
    return this.bills;
  }

  // Get a specific bill
  getBill(billId: string): Bill | undefined {
    return this.bills.find(bill => bill.id === billId);
  }

  // Delete a bill
  deleteBill(billId: string): boolean {
    const billIndex = this.bills.findIndex(bill => bill.id === billId);
    if (billIndex === -1) return false;

    this.bills.splice(billIndex, 1);
    return true;
  }

  // Add person to a bill
  addPerson(billId: string, name: string): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    const normalizedName = this.normalizeName(name);
    if (!normalizedName) return false;

    const personExists = bill.persons.some(person => person.name.toLowerCase() === normalizedName.toLowerCase());
    if (personExists) return false;

    const personId = this.generateId();
    const newPerson: Person = {
      id: personId,
      name: normalizedName
    };
    bill.persons.push(newPerson);
    return true;
  }

  addPeople(billId: string, names: string[]): number {
    let addedCount = 0;

    names.forEach(name => {
      if (this.addPerson(billId, name)) {
        addedCount += 1;
      }
    });

    return addedCount;
  }

  // Add item to a bill
  addItem(billId: string, name: string, price: number): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    const normalizedName = this.normalizeName(name);
    if (!normalizedName || !Number.isFinite(price) || price <= 0) return false;

    const itemId = this.generateId();
    const newItem: Item = {
      id: itemId,
      name: normalizedName,
      price,
      dividers: []
    };
    bill.items.push(newItem);
    return true;
  }

  addItems(billId: string, items: Array<{ name: string; price: number }>): number {
    let addedCount = 0;

    items.forEach(item => {
      if (this.addItem(billId, item.name, item.price)) {
        addedCount += 1;
      }
    });

    return addedCount;
  }

  // Toggle person as divider for an item
  togglePersonAsDivider(billId: string, itemId: string, personId: string): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    const item = bill.items.find(item => item.id === itemId);
    if (!item) return false;

    const person = bill.persons.find(person => person.id === personId);
    if (!person) return false;

    const dividerIndex = item.dividers.indexOf(personId);
    if (dividerIndex === -1) {
      item.dividers.push(personId);
    } else {
      item.dividers.splice(dividerIndex, 1);
    }
    return true;
  }

  // Calculate summary for each person in a bill
  calculateBillSummary(billId: string): PersonSummary[] {
    const bill = this.getBill(billId);
    if (!bill) return [];

    const summaries: PersonSummary[] = [];
    const subtotalByPerson: Record<string, number> = {};

    bill.persons.forEach(person => {
      const summary: PersonSummary = {
        personId: person.id,
        personName: person.name,
        totalAmount: 0,
        itemBreakdown: []
      };

      bill.items.forEach(item => {
        if (item.dividers.includes(person.id)) {
          const splitAmount = item.price / item.dividers.length;
          summary.totalAmount += splitAmount;
          subtotalByPerson[person.id] = (subtotalByPerson[person.id] ?? 0) + splitAmount;
          summary.itemBreakdown.push({
            itemName: item.name,
            itemPrice: item.price,
            splitAmount,
            splitWith: item.dividers.length
          });
        }
      });

      summaries.push(summary);
    });

    const subtotal = Object.values(subtotalByPerson).reduce((sum, total) => sum + total, 0);
    const serviceAmount = bill.charges.serviceEnabled ? subtotal * (bill.charges.serviceRate / 100) : 0;
    const subtotalAfterService = subtotal + serviceAmount;
    const taxAmount = bill.charges.taxEnabled ? subtotalAfterService * (bill.charges.taxRate / 100) : 0;
    const tipAmount = bill.charges.tipEnabled ? subtotalAfterService * (bill.charges.tipRate / 100) : 0;
    const totalCharges = serviceAmount + taxAmount + tipAmount;
    const proportionalChargeRate = subtotal > 0 ? totalCharges / subtotal : 0;

    summaries.forEach(summary => {
      summary.totalAmount += summary.totalAmount * proportionalChargeRate;
    });

    return summaries;
  }

  setSettlementRecipient(billId: string, personId: string | null): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    if (personId === null) {
      bill.settlementRecipientId = null;
      return true;
    }

    const personExists = bill.persons.some(person => person.id === personId);
    if (!personExists) return false;

    bill.settlementRecipientId = personId;
    return true;
  }

  updateBillCharges(billId: string, charges: BillCharges): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    const { taxEnabled, taxRate, serviceEnabled, serviceRate, tipEnabled, tipRate } = charges;
    if (![taxEnabled, serviceEnabled, tipEnabled].every(value => typeof value === 'boolean')) {
      return false;
    }
    const normalizedTaxRate = this.normalizeChargeRate(taxRate);
    const normalizedServiceRate = this.normalizeChargeRate(serviceRate);
    const normalizedTipRate = this.normalizeChargeRate(tipRate);
    if (![normalizedTaxRate, normalizedServiceRate, normalizedTipRate].every(value => Number.isInteger(value) && value >= 0 && value <= 1000)) {
      return false;
    }

    bill.charges = {
      taxEnabled,
      taxRate: normalizedTaxRate,
      serviceEnabled,
      serviceRate: normalizedServiceRate,
      tipEnabled,
      tipRate: normalizedTipRate
    };
    return true;
  }

  // Remove person from bill
  removePerson(billId: string, personId: string): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    const personIndex = bill.persons.findIndex(person => person.id === personId);
    if (personIndex === -1) return false;

    // Remove person from all item dividers
    bill.items.forEach(item => {
      const dividerIndex = item.dividers.indexOf(personId);
      if (dividerIndex !== -1) {
        item.dividers.splice(dividerIndex, 1);
      }
    });

    // Remove person from bill
    bill.persons.splice(personIndex, 1);
    if (bill.settlementRecipientId === personId) {
      bill.settlementRecipientId = bill.persons[0]?.id ?? null;
    }
    return true;
  }

  // Remove item from bill
  removeItem(billId: string, itemId: string): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    const itemIndex = bill.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return false;

    bill.items.splice(itemIndex, 1);
    return true;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeChargeRate(value: number | undefined): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const numericValue = value as number;
    return Math.min(Math.max(Math.round(numericValue), 0), 1000);
  }
}
