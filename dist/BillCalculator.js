export class BillCalculator {
    constructor() {
        this.bills = [];
    }
    // Create a new bill
    createBill(name) {
        const billId = this.generateId();
        const newBill = {
            id: billId,
            name,
            persons: [],
            items: []
        };
        this.bills.push(newBill);
        return billId;
    }
    // Get all bills
    getBills() {
        return this.bills;
    }
    // Get a specific bill
    getBill(billId) {
        return this.bills.find(bill => bill.id === billId);
    }
    // Delete a bill
    deleteBill(billId) {
        const billIndex = this.bills.findIndex(bill => bill.id === billId);
        if (billIndex === -1)
            return false;
        this.bills.splice(billIndex, 1);
        return true;
    }
    // Add person to a bill
    addPerson(billId, name) {
        const bill = this.getBill(billId);
        if (!bill)
            return false;
        const normalizedName = this.normalizeName(name);
        if (!normalizedName)
            return false;
        const personExists = bill.persons.some(person => person.name.toLowerCase() === normalizedName.toLowerCase());
        if (personExists)
            return false;
        const personId = this.generateId();
        const newPerson = {
            id: personId,
            name: normalizedName
        };
        bill.persons.push(newPerson);
        return true;
    }
    addPeople(billId, names) {
        let addedCount = 0;
        names.forEach(name => {
            if (this.addPerson(billId, name)) {
                addedCount += 1;
            }
        });
        return addedCount;
    }
    // Add item to a bill
    addItem(billId, name, price) {
        const bill = this.getBill(billId);
        if (!bill)
            return false;
        const normalizedName = this.normalizeName(name);
        if (!normalizedName || !Number.isFinite(price) || price <= 0)
            return false;
        const itemId = this.generateId();
        const newItem = {
            id: itemId,
            name: normalizedName,
            price,
            dividers: []
        };
        bill.items.push(newItem);
        return true;
    }
    addItems(billId, items) {
        let addedCount = 0;
        items.forEach(item => {
            if (this.addItem(billId, item.name, item.price)) {
                addedCount += 1;
            }
        });
        return addedCount;
    }
    // Toggle person as divider for an item
    togglePersonAsDivider(billId, itemId, personId) {
        const bill = this.getBill(billId);
        if (!bill)
            return false;
        const item = bill.items.find(item => item.id === itemId);
        if (!item)
            return false;
        const person = bill.persons.find(person => person.id === personId);
        if (!person)
            return false;
        const dividerIndex = item.dividers.indexOf(personId);
        if (dividerIndex === -1) {
            item.dividers.push(personId);
        }
        else {
            item.dividers.splice(dividerIndex, 1);
        }
        return true;
    }
    // Calculate summary for each person in a bill
    calculateBillSummary(billId) {
        const bill = this.getBill(billId);
        if (!bill)
            return [];
        const summaries = [];
        bill.persons.forEach(person => {
            const summary = {
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
    // Remove person from bill
    removePerson(billId, personId) {
        const bill = this.getBill(billId);
        if (!bill)
            return false;
        const personIndex = bill.persons.findIndex(person => person.id === personId);
        if (personIndex === -1)
            return false;
        // Remove person from all item dividers
        bill.items.forEach(item => {
            const dividerIndex = item.dividers.indexOf(personId);
            if (dividerIndex !== -1) {
                item.dividers.splice(dividerIndex, 1);
            }
        });
        // Remove person from bill
        bill.persons.splice(personIndex, 1);
        return true;
    }
    // Remove item from bill
    removeItem(billId, itemId) {
        const bill = this.getBill(billId);
        if (!bill)
            return false;
        const itemIndex = bill.items.findIndex(item => item.id === itemId);
        if (itemIndex === -1)
            return false;
        bill.items.splice(itemIndex, 1);
        return true;
    }
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
    normalizeName(value) {
        return value.trim().replace(/\s+/g, ' ');
    }
}
//# sourceMappingURL=BillCalculator.js.map