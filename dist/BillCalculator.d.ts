import { Bill, PersonSummary } from './types';
export declare class BillCalculator {
    private bills;
    createBill(name: string): string;
    getBills(): Bill[];
    getBill(billId: string): Bill | undefined;
    deleteBill(billId: string): boolean;
    addPerson(billId: string, name: string): boolean;
    addPeople(billId: string, names: string[]): number;
    addItem(billId: string, name: string, price: number): boolean;
    addItems(billId: string, items: Array<{
        name: string;
        price: number;
    }>): number;
    togglePersonAsDivider(billId: string, itemId: string, personId: string): boolean;
    calculateBillSummary(billId: string): PersonSummary[];
    removePerson(billId: string, personId: string): boolean;
    removeItem(billId: string, itemId: string): boolean;
    private generateId;
    private normalizeName;
}
//# sourceMappingURL=BillCalculator.d.ts.map