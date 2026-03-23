import { Bill, Person, Item, PersonSummary } from './types';

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
      settlementRecipientId: bill.settlementRecipientId ?? null
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
      settlementRecipientId: bill.settlementRecipientId
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
      settlementRecipientId: null
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
}
