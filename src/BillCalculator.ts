import { Bill, Person, Item, PersonSummary, BillCharges } from './types';

export interface BillImportSanitizationReport {
  bill: Bill;
  invalidPersonsDropped: number;
  invalidItemsDropped: number;
  invalidDividerReferencesRemoved: number;
}

export interface BillImportAnalysis {
  sanitizedBills: Bill[];
  reports: BillImportSanitizationReport[];
  ignoredBillCount: number;
  totalInvalidPersonsDropped: number;
  totalInvalidItemsDropped: number;
  totalInvalidDividerReferencesRemoved: number;
}

export class BillCalculator {
  private bills: Bill[] = [];

  loadBills(bills: Bill[]): void {
    this.bills = this.sanitizeBills(bills);
  }

  sanitizeBills(rawBills: unknown): Bill[] {
    return this.analyzeBillImport(rawBills).sanitizedBills;
  }

  analyzeBillImport(rawBills: unknown): BillImportAnalysis {
    if (!Array.isArray(rawBills)) {
      return {
        sanitizedBills: [],
        reports: [],
        ignoredBillCount: 0,
        totalInvalidPersonsDropped: 0,
        totalInvalidItemsDropped: 0,
        totalInvalidDividerReferencesRemoved: 0
      };
    }

    const usedBillIds = new Set<string>();
    const sanitizedBills: Bill[] = [];
    const reports: BillImportSanitizationReport[] = [];
    let ignoredBillCount = 0;

    rawBills.forEach(rawBill => {
      const sanitizedBill = this.sanitizeBillWithReport(rawBill, usedBillIds);
      if (sanitizedBill) {
        sanitizedBills.push(sanitizedBill.bill);
        reports.push(sanitizedBill.report);
      } else {
        ignoredBillCount += 1;
      }
    });

    return {
      sanitizedBills,
      reports,
      ignoredBillCount,
      totalInvalidPersonsDropped: reports.reduce((sum, report) => sum + report.invalidPersonsDropped, 0),
      totalInvalidItemsDropped: reports.reduce((sum, report) => sum + report.invalidItemsDropped, 0),
      totalInvalidDividerReferencesRemoved: reports.reduce((sum, report) => sum + report.invalidDividerReferencesRemoved, 0)
    };
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

  updateBillName(billId: string, name: string): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    const normalizedName = this.normalizeName(name);
    if (!normalizedName) return false;

    bill.name = normalizedName;
    return true;
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

  updatePersonName(billId: string, personId: string, name: string): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    const person = bill.persons.find(existingPerson => existingPerson.id === personId);
    if (!person) return false;

    const normalizedName = this.normalizeName(name);
    if (!normalizedName) return false;

    const duplicateNameExists = bill.persons.some(existingPerson =>
      existingPerson.id !== personId && existingPerson.name.toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicateNameExists) return false;

    person.name = normalizedName;
    return true;
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

  updateItem(billId: string, itemId: string, name: string, price: number): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    const item = bill.items.find(existingItem => existingItem.id === itemId);
    if (!item) return false;

    const normalizedName = this.normalizeName(name);
    if (!normalizedName || !Number.isFinite(price) || price <= 0) return false;

    item.name = normalizedName;
    item.price = price;
    return true;
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

  setItemDividers(billId: string, itemId: string, personIds: string[]): boolean {
    const bill = this.getBill(billId);
    if (!bill) return false;

    const item = bill.items.find(existingItem => existingItem.id === itemId);
    if (!item) return false;

    const validPersonIds = bill.persons.map(person => person.id);
    const uniqueRequestedIds = Array.from(new Set(personIds));
    if (!uniqueRequestedIds.every(personId => validPersonIds.includes(personId))) {
      return false;
    }

    item.dividers = validPersonIds.filter(personId => uniqueRequestedIds.includes(personId));
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

  private sanitizeBillWithReport(
    rawBill: unknown,
    usedBillIds: Set<string>
  ): { bill: Bill; report: BillImportSanitizationReport } | null {
    if (!rawBill || typeof rawBill !== 'object') {
      return null;
    }

    const billRecord = rawBill as Partial<Bill>;
    const requestedBillId = typeof billRecord.id === 'string' && billRecord.id.trim()
      ? billRecord.id.trim()
      : this.generateId();
    let billId = requestedBillId;
    while (usedBillIds.has(billId)) {
      billId = this.generateId();
    }
    usedBillIds.add(billId);

    const name = this.normalizeName(typeof billRecord.name === 'string' ? billRecord.name : '');
    const normalizedName = name || 'Imported Bill';

    const personIdSet = new Set<string>();
    let invalidPersonsDropped = 0;
    const persons = Array.isArray(billRecord.persons)
      ? billRecord.persons.reduce<Person[]>((result, rawPerson) => {
          const person = this.sanitizePerson(rawPerson, personIdSet);
          if (person) {
            result.push(person);
          } else {
            invalidPersonsDropped += 1;
          }
          return result;
        }, [])
      : [];

    const validPersonIds = new Set(persons.map(person => person.id));
    const itemIdSet = new Set<string>();
    let invalidItemsDropped = 0;
    let invalidDividerReferencesRemoved = 0;
    const items = Array.isArray(billRecord.items)
      ? billRecord.items.reduce<Item[]>((result, rawItem) => {
          const item = this.sanitizeItem(rawItem, itemIdSet, validPersonIds);
          if (item) {
            result.push(item.item);
            invalidDividerReferencesRemoved += item.invalidDividerReferencesRemoved;
          } else {
            invalidItemsDropped += 1;
          }
          return result;
        }, [])
      : [];

    const settlementRecipientId = typeof billRecord.settlementRecipientId === 'string'
      && validPersonIds.has(billRecord.settlementRecipientId)
      ? billRecord.settlementRecipientId
      : null;

    const bill = {
      id: billId,
      name: normalizedName,
      persons,
      items,
      settlementRecipientId,
      charges: this.sanitizeCharges(billRecord.charges)
    };

    return {
      bill,
      report: {
        bill,
        invalidPersonsDropped,
        invalidItemsDropped,
        invalidDividerReferencesRemoved
      }
    };
  }

  private sanitizePerson(rawPerson: unknown, usedPersonIds: Set<string>): Person | null {
    if (!rawPerson || typeof rawPerson !== 'object') {
      return null;
    }

    const personRecord = rawPerson as Partial<Person>;
    const name = this.normalizeName(typeof personRecord.name === 'string' ? personRecord.name : '');
    if (!name) {
      return null;
    }

    const requestedPersonId = typeof personRecord.id === 'string' && personRecord.id.trim()
      ? personRecord.id.trim()
      : this.generateId();
    let personId = requestedPersonId;
    while (usedPersonIds.has(personId)) {
      personId = this.generateId();
    }
    usedPersonIds.add(personId);

    return {
      id: personId,
      name
    };
  }

  private sanitizeItem(
    rawItem: unknown,
    usedItemIds: Set<string>,
    validPersonIds: Set<string>
  ): { item: Item; invalidDividerReferencesRemoved: number } | null {
    if (!rawItem || typeof rawItem !== 'object') {
      return null;
    }

    const itemRecord = rawItem as Partial<Item>;
    const name = this.normalizeName(typeof itemRecord.name === 'string' ? itemRecord.name : '');
    const price = Number(itemRecord.price);
    if (!name || !Number.isFinite(price) || price <= 0) {
      return null;
    }

    const requestedItemId = typeof itemRecord.id === 'string' && itemRecord.id.trim()
      ? itemRecord.id.trim()
      : this.generateId();
    let itemId = requestedItemId;
    while (usedItemIds.has(itemId)) {
      itemId = this.generateId();
    }
    usedItemIds.add(itemId);

    const validDividerIds = new Set<string>();
    let invalidDividerReferencesRemoved = 0;
    if (Array.isArray(itemRecord.dividers)) {
      itemRecord.dividers.forEach(personId => {
        if (typeof personId === 'string' && validPersonIds.has(personId)) {
          validDividerIds.add(personId);
          return;
        }

        invalidDividerReferencesRemoved += 1;
      });
    }

    const dividers = Array.from(validDividerIds);

    return {
      item: {
        id: itemId,
        name,
        price,
        dividers
      },
      invalidDividerReferencesRemoved
    };
  }

  private sanitizeCharges(rawCharges: unknown): BillCharges {
    const charges = rawCharges && typeof rawCharges === 'object'
      ? rawCharges as Partial<BillCharges>
      : undefined;

    return {
      taxEnabled: typeof charges?.taxEnabled === 'boolean' ? charges.taxEnabled : (Number.isFinite(charges?.taxRate) ? (charges?.taxRate as number) > 0 : false),
      taxRate: this.normalizeChargeRate(charges?.taxRate),
      serviceEnabled: typeof charges?.serviceEnabled === 'boolean' ? charges.serviceEnabled : (Number.isFinite(charges?.serviceRate) ? (charges?.serviceRate as number) > 0 : false),
      serviceRate: this.normalizeChargeRate(charges?.serviceRate),
      tipEnabled: typeof charges?.tipEnabled === 'boolean' ? charges.tipEnabled : (Number.isFinite(charges?.tipRate) ? (charges?.tipRate as number) > 0 : false),
      tipRate: this.normalizeChargeRate(charges?.tipRate)
    };
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
