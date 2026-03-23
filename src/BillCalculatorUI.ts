import { BillCalculator } from './BillCalculator';
import { Bill, PersonSummary } from './types';

interface SavedDraftState {
  version: 1;
  currentBillId: string | null;
  bills: Bill[];
}

interface BillTransferFile {
  version: 1;
  source: 'bill-calculator';
  exportType: 'single-bill' | 'bill-list';
  exportedAt: string;
  currentBillId: string | null;
  bills: Bill[];
}

type BillImportMode = 'merge' | 'replace';

interface BillImportPreviewEntry {
  billId: string;
  originalName: string;
  finalName: string;
  personsCount: number;
  itemsCount: number;
  renamed: boolean;
  regeneratedId: boolean;
  invalidPersonsDropped: number;
  invalidItemsDropped: number;
  invalidDividerReferencesRemoved: number;
  selected: boolean;
}

interface PendingBillImportPreview {
  sourceName: string;
  importMode: BillImportMode;
  preferredImportedBillId: string | null;
  preparedBills: Bill[];
  entries: BillImportPreviewEntry[];
  currentBillCount: number;
  ignoredBillCount: number;
}

export class BillCalculatorUI {
  private calculator: BillCalculator;
  private currentBillId: string | null = null;
  private editingBillId: string | null = null;
  private editingPersonId: string | null = null;
  private currentItemAssignmentItemId: string | null = null;
  private editingItemId: string | null = null;
  private showOnlyUnassignedItems = false;
  private isDarkTheme: boolean;
  private toastTimeoutId: number | null = null;
  private readonly draftStorageKey = 'billCalculatorDraft';
  private readonly maxHistoryEntries = 50;
  private undoStack: SavedDraftState[] = [];
  private redoStack: SavedDraftState[] = [];
  private isApplyingHistory = false;
  private pendingBillImportPreview: PendingBillImportPreview | null = null;

  constructor() {
    this.calculator = new BillCalculator();
    // Load theme preference from localStorage
    this.isDarkTheme = localStorage.getItem('billCalculatorTheme') === 'dark' || 
                      (localStorage.getItem('billCalculatorTheme') === null && 
                       window.matchMedia('(prefers-color-scheme: dark)').matches);
    this.initializeUI();
    this.applyTheme();
  }

  private initializeUI(): void {
    document.body.innerHTML = `
      <div class="container">
        <div id="toastContainer" class="toast-container" aria-live="polite" aria-atomic="true"></div>
        <div class="app-header">
          <h1>💰 Bill Calculator</h1>
          <button id="themeToggle" class="theme-toggle" onclick="billUI.toggleTheme()">
            <span class="theme-icon">🌙</span>
            <span class="theme-text">Dark</span>
          </button>
        </div>
        
        <!-- Bill Management -->
        <div class="section">
          <h2>📋 Bill Management</h2>
          <div class="input-group">
            <input type="text" id="billName" class="input-field" placeholder="Enter bill name" maxlength="100">
            <button onclick="billUI.createNewBill()" class="btn btn-primary">Create Bill</button>
          </div>
          <div class="bill-management-actions">
            <button id="undoBtn" onclick="billUI.undoLastChange()" class="btn btn-secondary" disabled>Undo</button>
            <button id="redoBtn" onclick="billUI.redoLastChange()" class="btn btn-secondary" disabled>Redo</button>
            <button id="exportBillJsonBtn" onclick="billUI.exportCurrentBillJson()" class="btn btn-secondary" disabled>Export Bill JSON</button>
            <button id="exportAllBillsJsonBtn" onclick="billUI.exportAllBillsJson()" class="btn btn-secondary" disabled>Export All Bills JSON</button>
            <button id="importBillJsonBtn" onclick="billUI.openBillImportPicker('merge')" class="btn btn-secondary">Import Merge JSON</button>
            <button id="importReplaceBillJsonBtn" onclick="billUI.openBillImportPicker('replace')" class="btn btn-secondary">Import Replace JSON</button>
            <button id="clearDraftBtn" onclick="billUI.clearSavedDraft()" class="btn btn-secondary" disabled>Clear Saved Draft</button>
          </div>
          <input id="billImportInput" type="file" accept=".json,application/json" style="display: none;">
          <div id="billImportDropZone" class="bill-import-dropzone" tabindex="0" role="button" aria-label="Drop Bill Calculator JSON file here or click to import by merging">
            <div class="bill-import-dropzone-title">Drop Bill JSON here</div>
            <div class="bill-import-dropzone-text">Drop a .json export file to import it. Click to merge, use the replace button above to overwrite current bills, or hold Shift while dropping to replace directly.</div>
          </div>
          <div id="billsList"></div>
        </div>

        <!-- Current Bill Management -->
        <div id="currentBillSection" style="display: none;">
          <div class="section">
            <div class="bill-header">
              <h2 id="currentBillTitle">Current Bill</h2>
              <div class="bill-header-actions">
                <button class="edit-bill-btn" onclick="billUI.editCurrentBill()">Edit Bill</button>
                <button class="delete-bill-btn" onclick="billUI.deleteCurrentBill()">Delete Bill</button>
              </div>
            </div>

            <!-- Interactive Summary Table -->
            <div class="subsection">
              <div class="summary-header">
                <h3>Payment Summary & Management</h3>
                <div class="action-buttons">
                  <button id="toggleUnassignedFilterBtn" class="btn btn-secondary" onclick="billUI.toggleUnassignedItemsFilter()" style="display: none;">
                    Show Unassigned Only
                  </button>
                  <button id="assignAllUnassignedBtn" class="btn btn-secondary" onclick="billUI.assignAllUnassignedItems()" style="display: none;">
                    Assign All Unassigned
                  </button>
                  <button id="addPersonBtn" class="add-person-btn-external" onclick="billUI.showPersonModal()" style="display: none;">
                    + Person
                  </button>
                  <button id="addItemBtn" class="add-item-btn-external" onclick="billUI.showItemModal()" style="display: none;">
                    + Item
                  </button>
                  <button id="exportBtn" class="export-btn-external" onclick="billUI.exportTableToImage()" style="display: none;">
                    📷 Export
                  </button>
                  <button id="exportPdfBtn" class="export-pdf-btn-external" onclick="billUI.exportTableToPdf()" style="display: none;">
                    PDF Export
                  </button>
                  <button id="exportCsvBtn" class="export-csv-btn-external" onclick="billUI.exportTableToCsv()" style="display: none;">
                    CSV Export
                  </button>
                </div>
              </div>
              <p class="instructions-text">
                <strong>Instructions:</strong> Use "Add Person" and "Add Item" buttons to manage your bill. Check boxes to include a person in splitting an item's cost. 
                Use "Delete" buttons to remove people or items.
              </p>
              <div id="summaryTable"></div>
            </div>
          </div>
        </div>
      </div>

        <!-- Bill Edit Modal -->
        <div id="billEditModal" class="modal-overlay" style="display: none;" aria-hidden="true">
          <div class="modal-content" data-modal="bill">
            <div class="modal-header">
              <h3 class="modal-title" id="billModalTitle">Edit Bill</h3>
              <button class="modal-close" onclick="billUI.closeBillModal()" aria-label="Close modal">×</button>
            </div>
            <div class="modal-body">
              <div class="modal-form-group">
                <label class="modal-label" for="modalBillName">Bill Name</label>
                <input 
                  type="text"
                  id="modalBillName"
                  class="modal-input"
                  placeholder="Enter bill name"
                  maxlength="100"
                />
                <div class="modal-form-hint" id="billNameHint">Give this bill a clear name so it is easy to find later.</div>
                <div class="modal-error-message" id="billNameError"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="modal-btn modal-btn-secondary" onclick="billUI.closeBillModal()">
                Cancel
              </button>
              <button class="modal-btn modal-btn-primary" onclick="billUI.saveBillFromModal()" id="saveBillSubmitBtn">
                <span id="billSubmitButtonLabel">Save Changes</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Person Input Modal -->
        <div id="personInputModal" class="modal-overlay" style="display: none;" aria-hidden="true">
          <div class="modal-content" data-modal="person">
            <div class="modal-header">
              <h3 class="modal-title" id="personModalTitle">Add Person</h3>
              <button class="modal-close" onclick="billUI.closePersonModal()" aria-label="Close modal">×</button>
            </div>
            <div class="modal-body">
              <div class="modal-form-group">
                <label class="modal-label" for="modalPersonName">Person Name</label>
                <input 
                  type="text" 
                  id="modalPersonName" 
                  class="modal-input" 
                  placeholder="Enter person's name"
                  maxlength="50"
                  autocomplete="name"
                />
                <div class="modal-form-hint" id="personNameHint">Who will be splitting the bill?</div>
                <div class="modal-error-message" id="personNameError"></div>
              </div>
              <div class="modal-form-group" id="personBulkGroup">
                <label class="modal-label" for="modalPersonNames">Add Multiple People</label>
                <textarea
                  id="modalPersonNames"
                  class="modal-input modal-textarea"
                  placeholder="One name per line or separate with commas&#10;Alice&#10;Bob&#10;Charlie"
                ></textarea>
                <div class="modal-form-hint" id="personBulkHint">Optional. Paste several names at once.</div>
                <div class="modal-shortcut-hint" id="personShortcutHint">Press Cmd+Enter to submit on Mac, or Ctrl+Enter on other keyboards.</div>
                <div class="modal-error-message" id="personBulkError"></div>
                <div class="modal-preview" id="personPreview" style="display: none;"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="modal-btn modal-btn-secondary" onclick="billUI.closePersonModal()">
                Cancel
              </button>
              <button class="modal-btn modal-btn-primary" onclick="billUI.addPersonFromModal()" id="addPersonSubmitBtn">
                <span id="personSubmitButtonLabel">Add Person</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Item Input Modal -->
        <div id="itemInputModal" class="modal-overlay" style="display: none;" aria-hidden="true">
          <div class="modal-content" data-modal="item">
            <div class="modal-header">
              <h3 class="modal-title" id="itemModalTitle">Add Item</h3>
              <button class="modal-close" onclick="billUI.closeItemModal()" aria-label="Close modal">×</button>
            </div>
            <div class="modal-body">
              <div class="modal-form-group">
                <label class="modal-label" for="modalItemName">Item Name</label>
                <input 
                  type="text" 
                  id="modalItemName" 
                  class="modal-input" 
                  placeholder="e.g., Pizza, Drinks, Appetizer"
                  maxlength="100"
                />
                <div class="modal-form-hint" id="itemNameHint">What item are you adding to the bill?</div>
                <div class="modal-error-message" id="itemNameError"></div>
              </div>
              <div class="modal-form-group">
                <label class="modal-label" for="modalItemPrice">Price ($)</label>
                <input 
                  type="number" 
                  id="modalItemPrice" 
                  class="modal-input" 
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max="1000000"
                />
                <div class="modal-form-hint" id="itemPriceHint">Enter the total cost of this item</div>
                <div class="modal-error-message" id="itemPriceError"></div>
              </div>
              <div class="modal-form-group" id="itemBulkGroup">
                <label class="modal-label" for="modalBulkItems">Add Multiple Items</label>
                <textarea
                  id="modalBulkItems"
                  class="modal-input modal-textarea"
                  placeholder="One item per line using Name, Price&#10;Pizza, 24.50&#10;Drinks, 9.00&#10;Dessert, 12.25"
                ></textarea>
                <div class="modal-form-hint" id="itemBulkHint">Optional. Paste multiple lines in the format Name, Price.</div>
                <div class="modal-shortcut-hint" id="itemShortcutHint">Press Cmd+Enter to submit on Mac, or Ctrl+Enter on other keyboards.</div>
                <div class="modal-error-message" id="itemBulkError"></div>
                <div class="modal-preview" id="itemPreview" style="display: none;"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="modal-btn modal-btn-secondary" onclick="billUI.closeItemModal()">
                Cancel
              </button>
              <button class="modal-btn modal-btn-primary" onclick="billUI.addItemFromModal()" id="addItemSubmitBtn">
                <span id="itemSubmitButtonLabel">Add Item</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Item Assignment Modal -->
        <div id="itemAssignmentModal" class="modal-overlay" style="display: none;" aria-hidden="true">
          <div class="modal-content" data-modal="assignment">
            <div class="modal-header">
              <h3 class="modal-title">Assign Selected People</h3>
              <button class="modal-close" onclick="billUI.closeItemAssignmentModal()" aria-label="Close modal">×</button>
            </div>
            <div class="modal-body">
              <div class="modal-form-group">
                <label class="modal-label" id="itemAssignmentModalLabel">Choose People</label>
                <div class="modal-form-hint" id="itemAssignmentModalHint">Select who should share this item.</div>
              </div>
              <div class="assignment-modal-actions">
                <button type="button" class="modal-btn modal-btn-secondary assignment-modal-action-btn" onclick="billUI.selectAllPeopleForCurrentItem()">
                  Select All
                </button>
                <button type="button" class="modal-btn modal-btn-secondary assignment-modal-action-btn" onclick="billUI.clearSelectedPeopleForCurrentItem()">
                  Clear All
                </button>
              </div>
              <div class="assignment-modal-list" id="itemAssignmentList"></div>
              <div class="modal-error-message" id="itemAssignmentError"></div>
            </div>
            <div class="modal-footer">
              <div class="modal-selection-summary" id="itemAssignmentSelectionSummary">0 selected</div>
              <button class="modal-btn modal-btn-secondary" onclick="billUI.closeItemAssignmentModal()">
                Cancel
              </button>
              <button class="modal-btn modal-btn-primary" onclick="billUI.saveItemAssignmentFromModal()" id="saveItemAssignmentBtn">
                <span>Save Selection</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Bill Import Preview Modal -->
        <div id="billImportPreviewModal" class="modal-overlay" style="display: none;" aria-hidden="true">
          <div class="modal-content modal-content-wide" data-modal="import-preview">
            <div class="modal-header">
              <h3 class="modal-title">Review Bill Import</h3>
              <button class="modal-close" onclick="billUI.closeBillImportPreviewModal()" aria-label="Close modal">×</button>
            </div>
            <div class="modal-body">
              <div class="bill-import-preview-summary" id="billImportPreviewSummary"></div>
              <div class="assignment-modal-actions">
                <button type="button" class="modal-btn modal-btn-secondary assignment-modal-action-btn" onclick="billUI.selectAllBillsForImportPreview()">
                  Select All
                </button>
                <button type="button" class="modal-btn modal-btn-secondary assignment-modal-action-btn" onclick="billUI.clearBillImportPreviewSelection()">
                  Clear All
                </button>
              </div>
              <div class="bill-import-preview-list" id="billImportPreviewList"></div>
            </div>
            <div class="modal-footer">
              <div class="modal-selection-summary" id="billImportPreviewModeLabel"></div>
              <button class="modal-btn modal-btn-secondary" onclick="billUI.closeBillImportPreviewModal()">
                Cancel
              </button>
              <button class="modal-btn modal-btn-primary" onclick="billUI.confirmBillImportPreview()" id="confirmBillImportPreviewBtn">
                <span>Import Bills</span>
              </button>
            </div>
          </div>
        </div>


      <style>
        :root {
          --bg-primary: #ffffff;
          --bg-secondary: #f8f9fa;
          --bg-tertiary: #e9ecef;
          --text-primary: #212529;
          --text-secondary: #6c757d;
          --text-tertiary: #495057;
          --border-color: #dee2e6;
          --border-light: #e9ecef;
          --shadow: rgba(0, 0, 0, 0.1);
          --table-bg: #ffffff;
          --table-header-bg: #343a40;
          --table-header-text: #ffffff;
          --table-row-odd: #f8f9fa;
          --table-row-even: #e9ecef;
          --table-row-hover: #dee2e6;
          --table-border: #495057;
          --table-person-bg: #6c757d;
          --table-person-text: #ffffff;
          --table-total-bg: #28a745;
          --table-total-text: #ffffff;
          --btn-primary: #007bff;
          --btn-primary-hover: #0056b3;
          --btn-success: #28a745;
          --btn-success-hover: #218838;
          --btn-danger: #dc3545;
          --btn-danger-hover: #c82333;
          --btn-secondary: #6c757d;
          --btn-secondary-hover: #5a6268;
        }

        [data-theme="dark"] {
          --bg-primary: #1a1a1a;
          --bg-secondary: #2d2d2d;
          --bg-tertiary: #404040;
          --text-primary: #ffffff;
          --text-secondary: #cccccc;
          --text-tertiary: #aaaaaa;
          --border-color: #404040;
          --border-light: #555555;
          --shadow: rgba(0, 0, 0, 0.3);
          --table-bg: #1f2937;
          --table-header-bg: #111827;
          --table-header-text: #f3f4f6;
          --table-row-odd: #374151;
          --table-row-even: #4b5563;
          --table-row-hover: #6b7280;
          --table-border: #374151;
          --table-person-bg: #374151;
          --table-person-text: #f9fafb;
          --table-total-bg: #059669;
          --table-total-text: #f0fff4;
          --btn-primary: #007bff;
          --btn-primary-hover: #0056b3;
          --btn-success: #28a745;
          --btn-success-hover: #218838;
          --btn-danger: #ef4444;
          --btn-danger-hover: #dc2626;
          --btn-secondary: #6c757d;
          --btn-secondary-hover: #5a6268;
        }

        body {
          background-color: var(--bg-primary);
          color: var(--text-primary);
          transition: background-color 0.3s ease, color 0.3s ease;
          margin: 0;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid var(--border-color);
        }

        .app-header h1 {
          margin: 0;
          color: var(--text-primary);
        }

        .theme-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
          border: 2px solid var(--border-color);
          border-radius: 25px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .theme-toggle:hover {
          background-color: var(--border-color);
          transform: translateY(-1px);
        }

        .theme-icon {
          font-size: 16px;
          transition: transform 0.3s ease;
        }

        .section {
          margin-bottom: 30px;
          padding: 20px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 2000;
          pointer-events: none;
        }

        .toast {
          min-width: 240px;
          max-width: 360px;
          margin-bottom: 10px;
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--bg-primary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          box-shadow: 0 12px 24px var(--shadow);
          font-size: 14px;
          font-weight: 600;
          opacity: 0;
          transform: translateY(-8px);
          animation: toastIn 0.22s ease forwards;
        }

        .toast.toast-success {
          border-left: 4px solid var(--btn-success);
        }

        @keyframes toastIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .input-group {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }

        .bill-management-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-bottom: 15px;
        }

        .bill-import-dropzone {
          margin-bottom: 15px;
          padding: 14px 16px;
          border: 2px dashed var(--border-color);
          border-radius: 12px;
          background: var(--bg-secondary);
          color: var(--text-secondary);
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
          outline: none;
        }

        .bill-import-dropzone:hover,
        .bill-import-dropzone:focus,
        .bill-import-dropzone.is-drag-over {
          border-color: var(--btn-primary);
          background: var(--bg-tertiary);
          transform: translateY(-1px);
        }

        .bill-import-dropzone-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .bill-import-dropzone-text {
          font-size: 13px;
          line-height: 1.5;
        }

        .input-field {
          flex: 1;
          min-width: 0;
          width: 100%;
          padding: 12px 16px;
          border: 2px solid var(--border-color);
          border-radius: 8px;
          font-size: 16px;
          color: var(--text-primary);
          background: var(--bg-primary);
          transition: all 0.2s ease;
          max-width: 300px;
          box-sizing: border-box;
        }

        .input-field:focus {
          outline: none;
          border-color: var(--btn-primary);
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .btn {
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
          transform: none;
          box-shadow: none;
        }

        .btn-primary {
          background-color: var(--btn-primary);
          color: white;
        }

        .btn-primary:hover {
          background-color: var(--btn-primary-hover);
          transform: translateY(-2px);
        }

        .btn-success {
          background-color: var(--btn-success);
          color: white;
        }
        .btn-success:hover { 
          background-color: var(--btn-success-hover); 
          transform: translateY(-2px);
        }

        .btn-danger {
          background-color: var(--btn-danger);
          color: white;
        }
        .btn-danger:hover { 
          background-color: var(--btn-danger-hover); 
          transform: translateY(-2px);
        }

        .btn-secondary {
          background-color: var(--btn-secondary);
          color: white;
        }
        .btn-secondary:hover { 
          background-color: var(--btn-secondary-hover); 
          transform: translateY(-2px);
        }

        .btn-secondary:disabled:hover {
          background-color: var(--btn-secondary);
          transform: none;
        }

        .subsection { 
          margin-bottom: 20px; 
          padding: 15px; 
          background-color: var(--bg-tertiary); 
          border-radius: 5px; 
        }

        .form-group { margin-bottom: 10px; }
        .form-group input { 
          margin-right: 10px; 
          padding: 8px; 
          border: 1px solid var(--border-color); 
          border-radius: 4px; 
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        .form-group button { 
          padding: 8px 15px; 
          background-color: var(--btn-primary); 
          color: white; 
          border: none; 
          border-radius: 4px; 
          cursor: pointer; 
        }
        .form-group button:hover { background-color: var(--btn-primary-hover); }

        .instructions-text {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 15px;
        }

        .bill-overview-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .bill-overview-card {
          padding: 16px;
          border-radius: 12px;
          background: linear-gradient(180deg, var(--bg-primary), var(--bg-secondary));
          border: 1px solid var(--border-color);
          box-shadow: 0 8px 20px var(--shadow);
        }

        .bill-overview-label {
          display: block;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .bill-overview-value {
          display: block;
          color: var(--text-primary);
          font-size: 28px;
          line-height: 1;
          font-weight: 700;
        }

        .bill-overview-subtext {
          display: block;
          margin-top: 8px;
          color: var(--text-secondary);
          font-size: 12px;
        }

        .charges-card {
          margin-bottom: 18px;
          padding: 18px;
          border-radius: 14px;
          background: linear-gradient(180deg, var(--bg-primary), var(--bg-secondary));
          border: 1px solid var(--border-color);
          box-shadow: 0 10px 18px var(--shadow);
        }

        .charges-header {
          margin-bottom: 14px;
        }

        .charges-title {
          margin: 0;
          color: var(--text-primary);
          font-size: 20px;
        }

        .charges-subtext {
          margin: 6px 0 0 0;
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.5;
        }

        .charges-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .charges-field {
          display: grid;
          gap: 6px;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 700;
        }

        .charges-field-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .charges-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
        }

        .charges-toggle input {
          width: 16px;
          height: 16px;
          margin: 0;
          accent-color: var(--accent-primary);
        }

        .charges-field input {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid var(--border-color);
          border-radius: 10px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
          box-sizing: border-box;
        }

        .charges-field input:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          background: var(--bg-tertiary);
        }

        .charges-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
        }

        .charges-pill {
          padding: 10px 12px;
          border-radius: 10px;
          background: var(--bg-primary);
          border: 1px solid var(--border-light);
          color: var(--text-tertiary);
          font-size: 13px;
          font-weight: 700;
        }

        .charges-pill-total {
          background: var(--table-total-bg);
          border-color: var(--table-total-bg);
          color: var(--table-total-text);
        }

        .warning-banner {
          margin-bottom: 18px;
          padding: 16px 18px;
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(255, 243, 205, 0.92), rgba(255, 248, 230, 0.98));
          border: 1px solid #f2c46d;
          box-shadow: 0 10px 18px var(--shadow);
        }

        [data-theme="dark"] .warning-banner {
          background: linear-gradient(180deg, rgba(120, 73, 15, 0.34), rgba(79, 49, 12, 0.44));
          border-color: #b7791f;
        }

        .warning-banner-title {
          margin: 0 0 6px 0;
          color: #8a5a00;
          font-size: 16px;
          font-weight: 800;
        }

        [data-theme="dark"] .warning-banner-title {
          color: #f6ad55;
        }

        .warning-banner-text {
          margin: 0;
          color: #6b4b07;
          font-size: 13px;
          line-height: 1.6;
        }

        [data-theme="dark"] .warning-banner-text {
          color: #fbd38d;
        }

        .settlement-card {
          margin-bottom: 18px;
          padding: 18px;
          border-radius: 14px;
          background: linear-gradient(180deg, var(--bg-primary), var(--bg-secondary));
          border: 1px solid var(--border-color);
          box-shadow: 0 10px 18px var(--shadow);
        }

        .settlement-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 14px;
        }

        .settlement-title {
          margin: 0;
          color: var(--text-primary);
          font-size: 20px;
        }

        .settlement-subtext {
          margin: 6px 0 0 0;
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.5;
        }

        .settlement-controls {
          min-width: 240px;
        }

        .settlement-select {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid var(--border-color);
          border-radius: 10px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
        }

        .settlement-summary {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .settlement-stat {
          padding: 10px 12px;
          border-radius: 10px;
          background: var(--bg-primary);
          border: 1px solid var(--border-light);
          color: var(--text-tertiary);
          font-size: 13px;
          font-weight: 700;
        }

        .settlement-list {
          display: grid;
          gap: 10px;
        }

        .settlement-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--bg-primary);
          border: 1px solid var(--border-light);
        }

        .settlement-route {
          color: var(--text-primary);
          font-weight: 700;
          line-height: 1.4;
        }

        .settlement-amount {
          color: var(--btn-success);
          font-size: 18px;
          font-weight: 800;
          white-space: nowrap;
        }

        .settlement-empty {
          padding: 14px;
          border-radius: 12px;
          background: var(--bg-primary);
          border: 1px dashed var(--border-color);
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .secondary-btn {
          background-color: var(--btn-secondary) !important;
        }

        .secondary-btn:hover {
          background-color: var(--btn-secondary-hover) !important;
        }
        
        /* Bills List - Horizontal Layout */
        #billsList {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin-top: 15px;
        }
        .bill-item { 
          flex: 1 1 180px;
          min-width: 200px;
          max-width: 300px;
          min-height: 148px;
          padding: 15px; 
          background-color: var(--bg-tertiary); 
          border-radius: 8px; 
          display: flex; 
          flex-direction: column;
          justify-content: flex-start;
          gap: 12px;
          transition: all 0.2s ease;
          border: 2px solid transparent;
          box-sizing: border-box;
        }
        .bill-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px var(--shadow);
        }
        .bill-item.active { 
          background-color: var(--btn-primary); 
          color: white; 
          border-color: var(--btn-primary-hover);
        }
        .bill-item-content { 
          flex: 1 1 auto;
          min-height: 0;
          cursor: pointer;
        }
        .bill-item-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .bill-item-stats {
          font-size: 12px;
          line-height: 1.4;
        }
        .bill-item-actions { 
          display: flex; 
          justify-content: flex-end;
          gap: 8px;
          margin-top: auto;
          align-items: flex-end;
        }

        .bill-header-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .edit-bill-btn {
          background-color: var(--btn-secondary);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .edit-bill-btn:hover {
          background-color: var(--btn-secondary-hover);
        }

        .bill-edit-btn {
          background-color: transparent;
          color: var(--btn-primary);
          border: 1px solid color-mix(in srgb, var(--btn-primary) 45%, transparent);
          padding: 5px 12px;
          border-radius: 999px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          align-self: flex-end;
          transition: all 0.2s ease;
        }

        .bill-edit-btn:hover {
          background-color: color-mix(in srgb, var(--btn-primary) 12%, transparent);
          border-color: var(--btn-primary);
          transform: translateY(-1px);
        }

        .bill-item.active .bill-edit-btn {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.55);
          background-color: rgba(255, 255, 255, 0.12);
        }

        .bill-item.active .bill-edit-btn:hover {
          background-color: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.85);
        }
        
        .bill-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 20px; 
        }
        .delete-bill-btn { 
          background-color: var(--btn-danger); 
          color: white; 
          border: none; 
          padding: 10px 20px; 
          border-radius: 4px; 
          cursor: pointer; 
          font-size: 14px;
        }
        .delete-bill-btn:hover { background-color: var(--btn-danger-hover); }
        
        /* Summary header with action buttons */
        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .action-buttons {
          display: flex;
          gap: 10px;
        }
        .add-person-btn-external {
          background-color: var(--btn-success);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: normal;
        }
        .add-person-btn-external:hover { background-color: var(--btn-success-hover); }
        .add-item-btn-external {
          background-color: var(--btn-primary);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: normal;
        }
        .add-item-btn-external:hover { background-color: var(--btn-primary-hover); }
        
        .export-btn-external {
          background-color: #6f42c1;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: normal;
          transition: all 0.2s ease;
        }
        .export-btn-external:hover { 
          background-color: #5a32a3; 
          transform: translateY(-1px);
        }

        .export-pdf-btn-external {
          background-color: #c0392b;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: normal;
          transition: all 0.2s ease;
        }

        .export-pdf-btn-external:hover {
          background-color: #a93226;
          transform: translateY(-1px);
        }

        .export-csv-btn-external {
          background-color: #0f9d58;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: normal;
          transition: all 0.2s ease;
        }

        .export-csv-btn-external:hover {
          background-color: #0b8043;
          transform: translateY(-1px);
        }

        /* Modal Styles - Enhanced Design */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          opacity: 0;
          animation: modalFadeIn 0.2s ease-out forwards;
        }

        @keyframes modalFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes modalSlideIn {
          from {
            transform: translateY(-20px) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        .modal-content {
          background: var(--bg-primary);
          border-radius: 16px;
          padding: 0;
          width: 90%;
          max-width: 440px;
          max-height: 90vh;
          overflow: hidden;
          box-shadow: 
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04),
            0 0 0 1px var(--border-color);
          animation: modalSlideIn 0.2s ease-out forwards;
          position: relative;
        }

        .modal-content-wide {
          max-width: 680px;
        }

        [data-theme="dark"] .modal-content {
          box-shadow: 
            0 20px 25px -5px rgba(0, 0, 0, 0.4),
            0 10px 10px -5px rgba(0, 0, 0, 0.2),
            0 0 0 1px var(--border-color);
        }

        .modal-header {
          padding: 24px 24px 0 24px;
          border-bottom: 1px solid var(--border-light);
          background: var(--bg-secondary);
          position: relative;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-title::before {
          content: "👤";
        }

        .modal-content[data-modal="item"] .modal-title::before {
          content: "🧾";
        }

        .modal-content[data-modal="bill"] .modal-title::before {
          content: "📋";
        }

        .modal-content[data-modal="assignment"] .modal-title::before {
          content: "👥";
        }

        .modal-content[data-modal="import-preview"] .modal-title::before {
          content: "📥";
        }

        .modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 24px;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
        }

        .modal-close:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          transform: scale(1.1);
        }

        .modal-body {
          padding: 24px;
          background: var(--bg-primary);
        }

        .modal-form-group {
          margin-bottom: 20px;
        }

        .modal-form-group:last-child {
          margin-bottom: 0;
        }

        .modal-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .modal-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid var(--border-color);
          border-radius: 8px;
          font-size: 16px;
          color: var(--text-primary);
          background: var(--bg-primary);
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .modal-input:focus {
          outline: none;
          border-color: var(--btn-primary);
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
          transform: translateY(-1px);
        }

        .modal-input::placeholder {
          color: var(--text-secondary);
          font-style: italic;
        }

        .modal-textarea {
          min-height: 110px;
          resize: vertical;
          font-family: inherit;
          line-height: 1.5;
        }

        .modal-preview {
          margin-top: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          color: var(--text-primary);
          font-size: 13px;
          line-height: 1.5;
        }

        .assignment-modal-list {
          display: grid;
          gap: 10px;
          max-height: 320px;
          overflow-y: auto;
          margin-top: 8px;
        }

        .assignment-modal-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
        }

        .assignment-modal-action-btn {
          min-width: 0;
          padding: 10px 14px;
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        .assignment-modal-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .assignment-modal-item input {
          width: 18px;
          height: 18px;
          margin: 0;
          accent-color: var(--btn-success);
          cursor: pointer;
        }

        .modal-selection-summary {
          margin-right: auto;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 700;
          align-self: center;
        }

        .bill-import-preview-summary {
          display: grid;
          gap: 12px;
          margin-bottom: 16px;
        }

        .bill-import-preview-banner {
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          color: var(--text-primary);
          line-height: 1.5;
        }

        .bill-import-preview-banner strong {
          display: block;
          margin-bottom: 4px;
        }

        .bill-import-preview-banner.is-warning {
          border-color: rgba(255, 193, 7, 0.45);
          background: rgba(255, 243, 205, 0.45);
        }

        [data-theme="dark"] .bill-import-preview-banner.is-warning {
          border-color: rgba(245, 158, 11, 0.4);
          background: rgba(120, 73, 15, 0.28);
        }

        .bill-import-preview-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .bill-import-preview-stat {
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          color: var(--text-primary);
        }

        .bill-import-preview-stat-label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }

        .bill-import-preview-stat-value {
          font-size: 18px;
          font-weight: 800;
        }

        .bill-import-preview-list {
          display: grid;
          gap: 10px;
          max-height: 340px;
          overflow-y: auto;
        }

        .bill-import-preview-card {
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          display: grid;
          gap: 10px;
        }

        .bill-import-preview-card.is-unselected {
          opacity: 0.65;
        }

        .bill-import-preview-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .bill-import-preview-card-selector {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .bill-import-preview-card-checkbox {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          accent-color: var(--btn-success);
          cursor: pointer;
          flex: 0 0 auto;
        }

        .bill-import-preview-card-details {
          flex: 1;
          min-width: 0;
        }

        .bill-import-preview-card-title {
          font-size: 15px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .bill-import-preview-card-subtitle {
          margin-top: 4px;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .bill-import-preview-card-cleanup {
          padding-top: 2px;
          font-size: 12px;
          line-height: 1.45;
          color: var(--text-secondary);
        }

        .bill-import-preview-card-cleanup strong {
          color: var(--text-primary);
        }

        .bill-import-preview-card-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: flex-end;
        }

        .bill-import-preview-badge {
          padding: 5px 8px;
          border-radius: 999px;
          background: var(--bg-primary);
          border: 1px solid var(--border-light);
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .bill-import-preview-badge.is-renamed {
          color: #b7791f;
        }

        .bill-import-preview-badge.is-regenerated {
          color: var(--btn-primary);
        }

        .bill-import-preview-badge.is-invalid {
          color: #b7791f;
        }

        .modal-preview strong {
          display: block;
          margin-bottom: 4px;
        }

        .modal-preview-summary {
          color: var(--btn-success);
          font-weight: 600;
        }

        .modal-preview-warning {
          color: var(--btn-danger);
        }

        .modal-shortcut-hint {
          margin-top: 8px;
          color: var(--text-tertiary);
          font-size: 12px;
          font-weight: 600;
        }

        .modal-input.error {
          border-color: var(--btn-danger);
          box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
        }

        .modal-input-icon {
          position: relative;
        }

        .modal-input-icon::before {
          content: "";
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          background: var(--text-secondary);
          z-index: 1;
        }

        .modal-input-icon .modal-input {
          padding-left: 40px;
        }

        .modal-footer {
          padding: 16px 24px 24px 24px;
          background: var(--bg-secondary);
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          border-top: 1px solid var(--border-light);
        }

        .modal-btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          min-width: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .modal-btn-primary {
          background: var(--btn-primary);
          color: white;
        }

        .modal-btn-primary:hover {
          background: var(--btn-primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
        }

        .modal-btn-primary:disabled {
          background: var(--text-secondary);
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .modal-btn-secondary {
          background: transparent;
          color: var(--text-secondary);
          border: 2px solid var(--border-color);
        }

        .modal-btn-secondary:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-color: var(--text-secondary);
          transform: translateY(-1px);
        }

        .modal-form-hint {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 4px;
          font-style: italic;
        }

        .modal-error-message {
          color: var(--btn-danger);
          font-size: 12px;
          margin-top: 4px;
          font-weight: 500;
          display: none;
        }

        .modal-success-message {
          color: var(--btn-success);
          font-size: 12px;
          margin-top: 4px;
          font-weight: 500;
          display: none;
        }

        /* Mobile Responsiveness */
        @media (max-width: 768px) {
          .modal-content {
            width: 95%;
            margin: 20px;
            max-width: none;
          }

          .modal-header,
          .modal-body,
          .modal-footer {
            padding-left: 20px;
            padding-right: 20px;
          }

          .modal-title {
            font-size: 18px;
          }

          .modal-footer {
            flex-direction: column-reverse;
          }

          .modal-btn {
            width: 100%;
            justify-content: center;
          }

          .assignment-modal-actions {
            flex-direction: column;
          }

          .assignment-modal-action-btn {
            width: 100%;
          }

          .modal-selection-summary {
            margin-right: 0;
            width: 100%;
            text-align: center;
          }

          .bill-import-preview-stats {
            grid-template-columns: 1fr;
          }

          .bill-import-preview-card-header {
            flex-direction: column;
          }

          .bill-import-preview-card-badges {
            justify-content: flex-start;
          }
        }

        /* Loading States */
        .modal-btn.loading {
          position: relative;
          color: transparent;
        }

        .modal-btn.loading::after {
          content: "";
          position: absolute;
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          color: white;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Focus trap for accessibility */
        .modal-overlay[aria-hidden="false"] {
          pointer-events: auto;
        }

        .modal-overlay[aria-hidden="true"] {
          pointer-events: none;
        }
        
        /* Table Styles - Using CSS Variables */
        .summary-table-container {
          --summary-person-col-width: 220px;
          --summary-item-col-width: 120px;
          --summary-total-col-width: 100px;
          margin-top: 15px;
          border-radius: 12px;
          box-shadow: 0 10px 15px -3px var(--shadow);
          overflow: visible;
          background-color: var(--table-bg);
        }

        .summary-table-shell {
          display: grid;
          grid-template-columns: var(--summary-person-col-width) minmax(0, 1fr);
          align-items: start;
        }

        .summary-table-header-shell,
        .summary-table-body-shell {
          display: grid;
          grid-template-columns: var(--summary-person-col-width) minmax(0, 1fr);
          align-items: start;
        }

        .summary-table-header-shell {
          align-items: stretch;
          position: sticky;
          top: 0;
          z-index: 20;
          box-shadow: 0 10px 16px -16px rgba(0, 0, 0, 0.55);
        }

        .summary-table-fixed {
          box-sizing: border-box;
          border-right: 1px solid var(--table-border);
          background-color: var(--table-bg);
          position: relative;
          z-index: 2;
          box-shadow: 12px 0 18px -18px rgba(0, 0, 0, 0.55);
        }

        .summary-table-scroll {
          overflow-x: auto;
          overflow-y: hidden;
          background-color: var(--table-bg);
        }

        .summary-table-header-scroll {
          overflow: hidden;
          background-color: var(--table-bg);
          z-index: 11;
        }

        .summary-table-header-track {
          display: flex;
          width: max-content;
          min-width: 100%;
        }

        .summary-table-body-fixed,
        .summary-table-body-scroll {
          background-color: var(--table-bg);
        }

        .summary-table-header-fixed {
          width: var(--summary-person-col-width);
          min-width: var(--summary-person-col-width);
          max-width: var(--summary-person-col-width);
          display: flex;
          align-items: stretch;
          background-color: var(--table-header-bg);
          color: var(--table-header-text);
        }

        .summary-table-body-fixed {
          width: var(--summary-person-col-width);
          min-width: var(--summary-person-col-width);
          max-width: var(--summary-person-col-width);
        }

        .summary-table-body-fixed table,
        .summary-table-body-scroll table {
          border-collapse: collapse;
          border-spacing: 0;
          margin: 0;
        }

        .summary-table-body-fixed table {
          width: var(--summary-person-col-width);
          min-width: var(--summary-person-col-width);
          max-width: var(--summary-person-col-width);
          table-layout: fixed;
        }

        .summary-header-fixed-cell,
        .summary-table-header-cell {
          min-height: 94px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px 8px;
          box-sizing: border-box;
          border-bottom: 1px solid var(--table-border);
          color: var(--table-header-text);
          background-color: var(--table-header-bg);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 13px;
          font-weight: 600;
        }

        .summary-header-fixed-cell {
          min-height: 100%;
          height: 100%;
          min-width: 100%;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          justify-content: flex-start;
          padding: 16px;
        }

        .summary-table-header-cell {
          min-width: var(--summary-item-col-width);
          width: var(--summary-item-col-width);
          max-width: var(--summary-item-col-width);
          flex: 0 0 var(--summary-item-col-width);
        }

        .summary-table-header-cell.total-header-cell {
          min-width: var(--summary-total-col-width);
          width: var(--summary-total-col-width);
          max-width: var(--summary-total-col-width);
          flex: 0 0 var(--summary-total-col-width);
          background-color: var(--table-total-bg);
          color: var(--table-total-text);
        }

        .summary-table-header-cell.is-unassigned {
          background: linear-gradient(180deg, #fff4d6, #ffe7ad);
          color: #6f4a00;
          border-bottom-color: #e6b85c;
        }

        [data-theme="dark"] .summary-table-header-cell.is-unassigned {
          background: linear-gradient(180deg, #5a3b11, #7a5014);
          color: #fbd38d;
          border-bottom-color: #d69e2e;
        }

        .summary-table-header-cell.is-unassigned small {
          color: inherit !important;
        }

        .summary-table-header-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 6px;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(111, 74, 0, 0.14);
          color: inherit;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        [data-theme="dark"] .summary-table-header-badge {
          background: rgba(251, 211, 141, 0.16);
        }

        .summary-header-cell-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .summary-header-meta {
          line-height: 1.3;
          text-align: center;
        }
        
        td:nth-child(even) {
          background-color: var(--table-row-even);
        }
        
        /* Hover effects */
        tbody tr:hover td {
          background-color: var(--table-row-hover) !important;
        }

        tr.row-hover td,
        tr.row-hover th,
        tr.row-hover .person-row-cell {
          background-color: var(--table-row-hover) !important;
        }

        td.column-hover,
        th.column-hover {
          background-color: var(--table-row-hover) !important;
        }
        
        /* Person column styles */
        .person-header {
          background-color: var(--table-header-bg) !important;
          color: var(--table-header-text) !important;
          font-weight: 600;
          min-width: var(--summary-person-col-width);
          width: var(--summary-person-col-width);
          max-width: var(--summary-person-col-width);
          height: 100%;
          padding: 16px;
          display: flex;
          align-items: center;
          text-align: left;
          border: none;
          margin: 0;
          box-sizing: border-box;
        }

        /* Person row cell - Full expansion */
        .person-row-cell {
          background-color: var(--table-person-bg) !important;
          color: var(--table-person-text) !important;
          font-weight: 500;
          min-width: var(--summary-person-col-width);
          width: var(--summary-person-col-width);
          max-width: var(--summary-person-col-width);
          height: 100%;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          text-align: left;
          border: none;
          margin: 0;
          box-sizing: border-box;
        }
        
        /* Parent td for person row */
        .person-cell {
          padding: 0 !important;
          min-width: var(--summary-person-col-width);
          width: var(--summary-person-col-width);
          max-width: var(--summary-person-col-width);
          background-color: var(--table-person-bg) !important;
          box-sizing: border-box;
        }

        th[data-col-index="0"] {
          min-width: var(--summary-person-col-width);
          width: var(--summary-person-col-width);
          max-width: var(--summary-person-col-width);
        }

        td[data-col-index="0"] {
          padding: 0 !important;
          background-color: var(--table-person-bg) !important;
          min-width: var(--summary-person-col-width);
          width: var(--summary-person-col-width);
          max-width: var(--summary-person-col-width);
        }

        .person-cell.column-hover,
        th.column-hover,
        td.column-hover {
          background-color: var(--table-row-hover) !important;
        }
        
        .person-name-column { 
          text-align: left !important; 
          font-weight: 600; 
          background-color: var(--table-person-bg) !important;
          color: var(--table-person-text) !important;
          min-width: 180px;
          padding: 0 !important;
          position: relative;
        }
        
        /* Item column styles */
        .item-header {
          background-color: var(--table-header-bg) !important;
          color: var(--table-header-text) !important;
          font-weight: 600;
          min-width: var(--summary-item-col-width);
          width: var(--summary-item-col-width);
          max-width: var(--summary-item-col-width);
          padding: 12px 8px;
          text-align: center;
          box-sizing: border-box;
        }
        
        .item-header-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .item-header-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 6px;
          width: 100%;
        }

        .item-action-btn {
          border: none;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 600;
          transition: background-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
        }

        .item-action-btn:hover {
          transform: scale(1.05);
        }

        .item-action-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .item-action-assign {
          background-color: var(--btn-success);
          color: white;
        }

        .item-action-assign:hover {
          background-color: var(--btn-success-hover);
        }

        .item-action-select {
          background-color: var(--btn-primary);
          color: white;
        }

        .item-action-select:hover {
          background-color: var(--btn-primary-hover);
        }

        .item-action-edit {
          background-color: #0ea5a6;
          color: white;
        }

        .item-action-edit:hover {
          background-color: #0b7f80;
        }

        .item-action-clear {
          background-color: var(--btn-secondary);
          color: white;
        }

        .item-action-clear:hover {
          background-color: var(--btn-secondary-hover);
        }
        
        .item-name-price {
          text-align: center;
          line-height: 1.3;
          color: var(--table-header-text);
        }
        
        .item-delete-btn {
          background-color: var(--btn-danger);
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 500;
          transition: background-color 0.2s ease;
        }
        .item-delete-btn:hover { 
          background-color: var(--btn-danger-hover); 
          transform: scale(1.05);
        }
        
        /* Total column styles */
        .total-column {
          background-color: var(--table-total-bg) !important;
          color: var(--table-total-text) !important;
          font-weight: 700;
          min-width: var(--summary-total-col-width);
          width: var(--summary-total-col-width);
          max-width: var(--summary-total-col-width);
          padding: 16px;
          box-sizing: border-box;
          text-align: center;
          vertical-align: middle;
        }
        
        .total-row { 
          font-weight: 700; 
          background-color: var(--table-total-bg) !important;
        }
        
        .total-row td {
          background-color: var(--table-total-bg) !important;
          color: var(--table-total-text) !important;
          padding: 16px;
          font-weight: 600;
        }
        
        /* Checkbox cell styles */
        .checkbox-cell {
          padding: 16px;
          position: relative;
          min-width: var(--summary-item-col-width);
          width: var(--summary-item-col-width);
          max-width: var(--summary-item-col-width);
          box-sizing: border-box;
          text-align: center;
          vertical-align: middle;
        }

        .checkbox-cell.is-unassigned-column {
          background: rgba(255, 243, 205, 0.58) !important;
        }

        [data-theme="dark"] .checkbox-cell.is-unassigned-column {
          background: rgba(120, 73, 15, 0.28) !important;
        }

        .checkbox-cell-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 100%;
        }
        
        .divider-checkbox {
          transform: scale(1.3);
          cursor: pointer;
          accent-color: var(--btn-success);
          margin: 0;
        }
        
        .checkbox-cell small {
          display: block;
          font-size: 11px;
          font-weight: 500;
          margin: 0;
          text-align: center;
          width: 100%;
        }
        
        .person-name {
          flex-grow: 1;
          color: var(--table-person-text);
        }

        .person-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .person-edit-btn,
        .person-delete-btn {
          color: white;
          border: none;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
          flex-shrink: 0;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .person-edit-btn {
          background-color: #0ea5a6;
        }

        .person-edit-btn:hover {
          background-color: #0b7f80;
          transform: scale(1.05);
        }
        
        .person-delete-btn {
          background-color: var(--btn-danger);
          margin-left: 12px;
        }
        .person-delete-btn:hover { 
          background-color: var(--btn-danger-hover); 
          transform: scale(1.05);
        }
        
        .add-person-btn {
          background-color: var(--btn-success);
          color: white;
          border: none;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 500;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .add-person-btn:hover { 
          background-color: var(--btn-success-hover); 
          transform: scale(1.05);
        }
        
        .empty-cell {
          background-color: var(--table-row-even);
          color: var(--text-secondary);
          font-style: italic;
        }
        
        .amount-cell {
          font-weight: 600;
          background-color: var(--btn-success);
          color: white;
        }
        
        .item-info {
          display: inline-block;
          margin: 5px;
          padding: 6px 12px;
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .remove-btn { 
          background-color: var(--btn-danger); 
          color: white; 
          border: none; 
          padding: 4px 10px; 
          border-radius: 6px; 
          cursor: pointer; 
          margin-left: 8px;
          font-size: 11px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .remove-btn:hover { 
          background-color: var(--btn-danger-hover); 
          transform: scale(1.05);
        }
        
        .bill-delete-btn { 
          background-color: var(--btn-danger); 
          color: white; 
          border: none; 
          padding: 5px 10px; 
          border-radius: 3px; 
          cursor: pointer; 
          font-size: 12px;
          align-self: flex-end;
        }
        .bill-delete-btn:hover { background-color: var(--btn-danger-hover); }
        
        .empty-state { 
          text-align: center; 
          padding: 40px; 
          color: var(--text-secondary); 
          font-style: italic; 
          flex: 1 1 100%;
        }
        
        .no-data-message {
          text-align: center;
          padding: 30px;
          color: var(--text-secondary);
          font-style: italic;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          border: 2px dashed var(--border-color);
        }

        .empty-workflow-state {
          padding: 28px;
          border-radius: 16px;
          background: linear-gradient(180deg, var(--bg-primary), var(--bg-secondary));
          border: 1px solid var(--border-color);
          box-shadow: 0 12px 24px var(--shadow);
        }

        .empty-workflow-state h4 {
          margin: 0 0 10px 0;
          color: var(--text-primary);
          font-size: 22px;
        }

        .empty-workflow-state p {
          margin: 0 0 14px 0;
          color: var(--text-secondary);
        }

        .empty-workflow-steps {
          display: grid;
          gap: 10px;
          margin-top: 18px;
        }

        .empty-workflow-step {
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--bg-primary);
          border: 1px solid var(--border-light);
          color: var(--text-tertiary);
          font-weight: 600;
        }

        .mobile-summary-grid {
          display: none;
          margin-top: 16px;
          gap: 12px;
        }

        .mobile-summary-card {
          padding: 14px;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          box-shadow: 0 8px 18px var(--shadow);
        }

        .mobile-summary-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .mobile-summary-name {
          color: var(--text-primary);
          font-size: 16px;
          font-weight: 700;
        }

        .mobile-summary-total {
          color: var(--btn-success);
          font-size: 16px;
          font-weight: 700;
        }

        .mobile-summary-meta,
        .mobile-summary-items {
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.5;
        }
        
        .list-container {
          margin-top: 10px;
        }
        
        .empty-persons-message {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
          font-style: italic;
          border: 2px dashed var(--border-color);
          border-radius: 8px;
          margin: 20px 0;
          background-color: var(--bg-secondary);
        }
        
        .empty-items-message {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
          font-style: italic;
          border: 2px dashed var(--border-color);
          border-radius: 8px;
          margin: 20px 0;
          background-color: var(--bg-secondary);
        }
        
        /* Responsive design for smaller screens */
        @media (max-width: 768px) {
          .container {
            padding: 14px;
          }

          .section {
            padding: 16px;
            margin-bottom: 18px;
          }

          .toast-container {
            left: 16px;
            right: 16px;
            top: 16px;
          }

          .toast {
            min-width: auto;
            max-width: none;
          }

          .app-header {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            text-align: left;
            margin-bottom: 22px;
            padding-bottom: 16px;
          }

          .app-header h1 {
            font-size: 28px;
          }

          .theme-toggle {
            width: 100%;
            justify-content: center;
          }

          .input-group {
            flex-direction: column;
          }

          .input-field {
            max-width: none;
            width: 100%;
          }

          #billName {
            max-width: none;
            width: 100%;
          }

          .input-group .btn {
            width: 100%;
          }

          .bill-overview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .charges-grid {
            grid-template-columns: 1fr;
          }

          .settlement-header {
            flex-direction: column;
          }

          .settlement-controls {
            min-width: 0;
            width: 100%;
          }

          .settlement-item {
            flex-direction: column;
            align-items: flex-start;
          }

          .bill-header {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .bill-header-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .edit-bill-btn,
          .delete-bill-btn {
            width: 100%;
          }

          .summary-header {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .summary-header h3 {
            margin: 0;
          }

          .action-buttons {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            width: 100%;
          }

          .action-buttons > * {
            width: 100%;
            min-width: 0;
          }

          .add-person-btn-external,
          .add-item-btn-external,
          .export-btn-external,
          .export-pdf-btn-external,
          .export-csv-btn-external {
            min-height: 40px;
            padding: 10px 12px;
            font-size: 12px;
            line-height: 1.2;
            text-align: center;
          }

          .bill-management-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            justify-content: stretch;
            align-items: stretch;
            gap: 8px;
          }

          .bill-management-actions .btn {
            width: 100%;
            min-width: 0;
            min-height: 44px;
            padding: 10px 12px;
            white-space: normal;
            line-height: 1.25;
          }

          .bill-import-dropzone {
            padding: 12px;
            text-align: left;
          }

          .bill-import-dropzone-title {
            font-size: 14px;
          }

          .mobile-summary-grid {
            display: grid;
          }

          #billsList {
            flex-direction: column;
          }

          .bill-item {
            max-width: none;
            min-width: 0;
            min-height: 0;
            padding: 14px;
            gap: 10px;
          }

          .bill-item-title {
            font-size: 15px;
          }

          .bill-item-stats {
            font-size: 12px;
            line-height: 1.5;
          }

          .bill-item-actions {
            justify-content: stretch;
          }

          .bill-edit-btn,
          .bill-delete-btn {
            width: 100%;
          }

          .person-row-cell {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }

          .person-actions {
            width: 100%;
          }

          .person-edit-btn,
          .person-delete-btn {
            flex: 1 1 0;
            margin-left: 0;
          }

          .instructions-text {
            font-size: 13px;
            line-height: 1.6;
          }
          
          th, td {
            padding: 12px 8px;
            font-size: 13px;
          }
          
          .summary-table-container {
            --summary-person-col-width: 180px;
            --summary-item-col-width: 100px;
            --summary-total-col-width: 92px;
          }

          .person-header, .person-row-cell {
            padding: 12px;
          }

          .summary-table-shell {
            grid-template-columns: var(--summary-person-col-width) minmax(0, 1fr);
          }

          .summary-table-header-shell,
          .summary-table-body-shell {
            grid-template-columns: var(--summary-person-col-width) minmax(0, 1fr);
          }

          .summary-header-fixed-cell {
            width: var(--summary-person-col-width);
          }

          .summary-table-fixed table,
          .summary-table-body-fixed table {
            width: var(--summary-person-col-width);
            min-width: var(--summary-person-col-width);
          }

          .person-cell,
          th[data-col-index="0"],
          td[data-col-index="0"] {
            min-width: var(--summary-person-col-width);
            width: var(--summary-person-col-width);
            max-width: var(--summary-person-col-width);
          }
          
          .item-header {
            min-width: 100px;
            padding: 8px 6px;
          }

          .item-header-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .item-action-btn,
          .item-delete-btn {
            width: 100%;
          }
        }
        @media (max-width: 500px) {
          .container {
            padding: 10px;
          }

          .section {
            padding: 12px;
            border-radius: 12px;
          }

          .app-header h1 {
            font-size: 24px;
          }

          .bill-management-actions,
          .action-buttons,
          .bill-import-preview-stats {
            grid-template-columns: 1fr;
          }

          .add-person-btn-external {
            padding: 10px 12px;
            font-size: 12px;
          }
          .add-item-btn-external {
            padding: 10px 12px;
            font-size: 12px;
          }
          .export-btn-external,
          .export-pdf-btn-external,
          .export-csv-btn-external {
            padding: 10px 12px;
            font-size: 12px;
          }

          .modal-header,
          .modal-body,
          .modal-footer {
            padding-left: 16px;
            padding-right: 16px;
          }

          .modal-body {
            padding-top: 18px;
            padding-bottom: 18px;
          }

          .modal-footer {
            padding-bottom: 16px;
          }

          .bill-import-preview-card {
            padding: 12px;
          }

          .mobile-summary-card {
            padding: 12px;
          }
        }
        @media (max-width: 410px) {
          .bill-overview-grid {
            grid-template-columns: 1fr;
          }

          .app-header h1 {
            font-size: 22px;
          }

          .theme-toggle,
          .btn,
          .delete-bill-btn,
          .bill-delete-btn,
          .modal-btn {
            font-size: 12px;
          }

          .summary-table-container {
            --summary-person-col-width: 156px;
            --summary-item-col-width: 92px;
            --summary-total-col-width: 88px;
          }

          .person-header,
          .person-row-cell {
            padding: 10px;
          }
        }
      </style>
    `;

    // Make this instance globally available
    (window as any).billUI = this;
    this.attachBillTransferInputSupport();
    this.attachModalKeyboardSupport();
    this.attachModalPreviewSupport();
    this.attachSummaryTableResizeSupport();
    this.updateBillsList();
    this.updateBillTransferActionState();
    this.updateDraftActionState();
    this.updateHistoryActionState();
    this.restoreDraftState();
  }

  private createHistorySnapshot(): SavedDraftState {
    return {
      version: 1,
      currentBillId: this.currentBillId,
      bills: this.calculator.exportBills()
    };
  }

  private updateHistoryActionState(): void {
    const undoButton = document.getElementById('undoBtn') as HTMLButtonElement | null;
    const redoButton = document.getElementById('redoBtn') as HTMLButtonElement | null;

    if (undoButton) {
      undoButton.disabled = this.undoStack.length === 0;
    }

    if (redoButton) {
      redoButton.disabled = this.redoStack.length === 0;
    }
  }

  private recordHistorySnapshot(): void {
    if (this.isApplyingHistory) {
      return;
    }

    this.undoStack.push(this.createHistorySnapshot());
    if (this.undoStack.length > this.maxHistoryEntries) {
      this.undoStack.shift();
    }

    this.redoStack = [];
    this.updateHistoryActionState();
  }

  private applySnapshot(snapshot: SavedDraftState): void {
    this.isApplyingHistory = true;
    this.calculator.loadBills(snapshot.bills);

    const nextBillId = snapshot.currentBillId && this.calculator.getBill(snapshot.currentBillId)
      ? snapshot.currentBillId
      : snapshot.bills[0]?.id || null;

    if (nextBillId) {
      this.selectBill(nextBillId);
    } else {
      this.resetCurrentBillView();
      this.updateBillsList();
      this.saveDraftState();
    }

    this.isApplyingHistory = false;
    this.updateHistoryActionState();
  }

  private updateDraftActionState(): void {
    const clearDraftButton = document.getElementById('clearDraftBtn') as HTMLButtonElement | null;
    if (!clearDraftButton) {
      return;
    }

    clearDraftButton.disabled = !localStorage.getItem(this.draftStorageKey);
  }

  private updateBillTransferActionState(): void {
    const exportBillButton = document.getElementById('exportBillJsonBtn') as HTMLButtonElement | null;
    const exportAllBillsButton = document.getElementById('exportAllBillsJsonBtn') as HTMLButtonElement | null;
    const hasBills = this.calculator.getBills().length > 0;

    if (exportBillButton) {
      exportBillButton.disabled = !this.currentBillId || !this.calculator.getBill(this.currentBillId);
    }

    if (exportAllBillsButton) {
      exportAllBillsButton.disabled = !hasBills;
    }
  }

  private attachBillTransferInputSupport(): void {
    const importInput = document.getElementById('billImportInput') as HTMLInputElement | null;
    const dropZone = document.getElementById('billImportDropZone') as HTMLDivElement | null;

    if (!importInput) {
      return;
    }

    importInput.addEventListener('change', event => {
      void this.handleImportedBillFile(event);
    });

    if (!dropZone) {
      return;
    }

    dropZone.addEventListener('click', () => {
      this.openBillImportPicker('merge');
    });

    dropZone.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.openBillImportPicker('merge');
      }
    });

    const setDragState = (isDragOver: boolean) => {
      dropZone.classList.toggle('is-drag-over', isDragOver);
    };

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        setDragState(true);
      });
    });

    ['dragleave', 'dragend'].forEach(eventName => {
      dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        setDragState(false);
      });
    });

    dropZone.addEventListener('drop', event => {
      event.preventDefault();
      setDragState(false);

      const file = event.dataTransfer?.files?.[0];
      if (!file) {
        return;
      }

      const importMode = event.shiftKey ? 'replace' : 'merge';
      void this.importBillsFromFile(file, importMode);
    });
  }

  private resetCurrentBillView(): void {
    this.currentBillId = null;
    this.currentItemAssignmentItemId = null;
    this.pendingBillImportPreview = null;
    this.showOnlyUnassignedItems = false;
    document.getElementById('currentBillSection')!.style.display = 'none';
    document.getElementById('currentBillTitle')!.textContent = 'Current Bill';
    document.getElementById('summaryTable')!.innerHTML = '';
    document.body.style.overflow = '';
    this.closeBillModal();
    this.closePersonModal();
    this.closeItemModal();
    this.closeItemAssignmentModal();
    this.closeBillImportPreviewModal();
    this.updateBillTransferActionState();
  }

  undoLastChange(): void {
    const previousSnapshot = this.undoStack.pop();
    if (!previousSnapshot) {
      this.updateHistoryActionState();
      return;
    }

    this.redoStack.push(this.createHistorySnapshot());
    this.applySnapshot(previousSnapshot);
    this.showToast('Undid last change');
  }

  redoLastChange(): void {
    const nextSnapshot = this.redoStack.pop();
    if (!nextSnapshot) {
      this.updateHistoryActionState();
      return;
    }

    this.undoStack.push(this.createHistorySnapshot());
    this.applySnapshot(nextSnapshot);
    this.showToast('Redid last change');
  }

  private saveDraftState(): void {
    try {
      const draftState: SavedDraftState = {
        version: 1,
        currentBillId: this.currentBillId,
        bills: this.calculator.exportBills()
      };

      localStorage.setItem(this.draftStorageKey, JSON.stringify(draftState));
      this.updateDraftActionState();
    } catch (error) {
      console.error('Failed to save draft state:', error);
    }
  }

  private restoreDraftState(): void {
    const rawDraftState = localStorage.getItem(this.draftStorageKey);
    if (!rawDraftState) {
      this.updateDraftActionState();
      return;
    }

    try {
      const parsedDraft = JSON.parse(rawDraftState) as Partial<SavedDraftState>;
      const bills = Array.isArray(parsedDraft.bills) ? parsedDraft.bills : [];
      this.calculator.loadBills(bills);
      this.updateBillsList();

      if (bills.length === 0) {
        this.currentBillId = null;
        return;
      }

      const requestedBillId = typeof parsedDraft.currentBillId === 'string' ? parsedDraft.currentBillId : null;
      const hasRequestedBill = requestedBillId ? this.calculator.getBill(requestedBillId) : undefined;
      const selectedBillId = hasRequestedBill?.id || bills[0]?.id || null;

      if (selectedBillId) {
        this.selectBill(selectedBillId);
      }

      this.updateDraftActionState();
      this.showToast('Draft restored');
    } catch (error) {
      console.error('Failed to restore draft state:', error);
      localStorage.removeItem(this.draftStorageKey);
      this.updateDraftActionState();
    }
  }

  clearSavedDraft(): void {
    const hasDraft = !!localStorage.getItem(this.draftStorageKey);
    if (!hasDraft) {
      this.showToast('No saved draft to clear');
      this.updateDraftActionState();
      return;
    }

    const confirmed = confirm('Clear the saved draft and remove all currently restored bill data from this browser?\n\nThis keeps your theme preference, but removes saved bills and the last selected bill.');
    if (!confirmed) {
      return;
    }

    localStorage.removeItem(this.draftStorageKey);
    this.calculator.loadBills([]);
    this.undoStack = [];
    this.redoStack = [];
    this.resetCurrentBillView();
    this.updateBillsList();
    this.updateDraftActionState();
    this.updateHistoryActionState();
    this.showToast('Saved draft cleared');
  }

  private attachModalKeyboardSupport(): void {
    document.addEventListener('keydown', (e) => {
      const target = e.target;
      const isTextareaTarget = target instanceof HTMLTextAreaElement;
      const isTextInputTarget = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable);
      const isModifiedEnter = (e.key === 'Enter' || e.key === 'NumpadEnter') && (e.metaKey || e.ctrlKey);
      const isUndoShortcut = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
      const isRedoShortcut = ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')
        || (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'y');

      if (!isTextInputTarget && isUndoShortcut) {
        e.preventDefault();
        this.undoLastChange();
        return;
      }

      if (!isTextInputTarget && isRedoShortcut) {
        e.preventDefault();
        this.redoLastChange();
        return;
      }

      if (isModifiedEnter && this.isPersonModalOpen()) {
        e.preventDefault();
        this.addPersonFromModal();
        return;
      }

      if (isModifiedEnter && this.isBillModalOpen()) {
        e.preventDefault();
        this.saveBillFromModal();
        return;
      }

      if (isModifiedEnter && this.isItemModalOpen()) {
        e.preventDefault();
        this.addItemFromModal();
        return;
      }

      if (isModifiedEnter && this.isItemAssignmentModalOpen()) {
        e.preventDefault();
        this.saveItemAssignmentFromModal();
        return;
      }

      if (isModifiedEnter && this.isBillImportPreviewModalOpen()) {
        e.preventDefault();
        this.confirmBillImportPreview();
        return;
      }

      if ((e.key === 'Enter' || e.key === 'NumpadEnter') && isTextareaTarget) {
        return;
      }

      if ((e.key === 'Enter' || e.key === 'NumpadEnter') && this.isPersonModalOpen()) {
        this.addPersonFromModal();
      }

      if ((e.key === 'Enter' || e.key === 'NumpadEnter') && this.isBillModalOpen()) {
        this.saveBillFromModal();
      }

      if ((e.key === 'Enter' || e.key === 'NumpadEnter') && this.isItemModalOpen()) {
        this.addItemFromModal();
      }

      if ((e.key === 'Enter' || e.key === 'NumpadEnter') && this.isItemAssignmentModalOpen()) {
        this.saveItemAssignmentFromModal();
      }

      if ((e.key === 'Enter' || e.key === 'NumpadEnter') && this.isBillImportPreviewModalOpen()) {
        this.confirmBillImportPreview();
      }

      if (e.key === 'Escape') {
        this.closeBillModal();
        this.closePersonModal();
        this.closeItemModal();
        this.closeItemAssignmentModal();
        this.closeBillImportPreviewModal();
      }
    });
  }

  private attachModalPreviewSupport(): void {
    const personNameInput = document.getElementById('modalPersonName');
    const personBulkInput = document.getElementById('modalPersonNames');
    const itemNameInput = document.getElementById('modalItemName');
    const itemPriceInput = document.getElementById('modalItemPrice');
    const itemBulkInput = document.getElementById('modalBulkItems');

    personNameInput?.addEventListener('input', () => this.updatePersonPreview());
    personBulkInput?.addEventListener('input', () => this.updatePersonPreview());
    itemNameInput?.addEventListener('input', () => this.updateItemPreview());
    itemPriceInput?.addEventListener('input', () => this.updateItemPreview());
    itemBulkInput?.addEventListener('input', () => this.updateItemPreview());
  }

  private attachSummaryTableResizeSupport(): void {
    window.addEventListener('resize', () => {
      this.syncSummaryFixedColumnWidth();
      this.syncSummaryTableRowHeights();
    });
  }

  private syncSummaryFixedColumnWidth(): void {
    const summaryContainer = document.querySelector('.summary-table-container') as HTMLElement | null;
    const headerFixed = summaryContainer?.querySelector('.summary-table-header-fixed') as HTMLElement | null;
    const bodyFixed = summaryContainer?.querySelector('.summary-table-body-fixed') as HTMLElement | null;
    const bodyFixedTable = bodyFixed?.querySelector('table') as HTMLTableElement | null;
    const bodyPersonCell = bodyFixed?.querySelector('.person-cell') as HTMLElement | null;

    if (!summaryContainer || !headerFixed || !bodyFixed || !bodyFixedTable) {
      return;
    }

    const measuredWidth = Math.ceil(
      bodyFixedTable.getBoundingClientRect().width
      || bodyFixed.getBoundingClientRect().width
      || bodyPersonCell?.getBoundingClientRect().width
      || 0
    );

    if (measuredWidth <= 0) {
      return;
    }

    const resolvedWidth = `${measuredWidth}px`;
    summaryContainer.style.setProperty('--summary-person-col-width', resolvedWidth);
    headerFixed.style.width = resolvedWidth;
    headerFixed.style.minWidth = resolvedWidth;
    headerFixed.style.maxWidth = resolvedWidth;
    bodyFixed.style.width = resolvedWidth;
    bodyFixed.style.minWidth = resolvedWidth;
    bodyFixed.style.maxWidth = resolvedWidth;
    bodyFixedTable.style.width = resolvedWidth;
    bodyFixedTable.style.minWidth = resolvedWidth;
    bodyFixedTable.style.maxWidth = resolvedWidth;
  }

  private attachSummaryTableScrollSync(): void {
    const headerScroll = document.querySelector('.summary-table-header-scroll') as HTMLElement | null;
    const bodyScroll = document.querySelector('.summary-table-body-scroll') as HTMLElement | null;
    if (!headerScroll || !bodyScroll) return;

    const syncHeader = () => {
      headerScroll.scrollLeft = bodyScroll.scrollLeft;
    };

    bodyScroll.addEventListener('scroll', syncHeader);
    syncHeader();
  }

  private getSummaryTableScrollLeft(): number {
    const bodyScroll = document.querySelector('.summary-table-body-scroll') as HTMLElement | null;
    const headerScroll = document.querySelector('.summary-table-header-scroll') as HTMLElement | null;

    if (bodyScroll) {
      return bodyScroll.scrollLeft;
    }

    if (headerScroll) {
      return headerScroll.scrollLeft;
    }

    return 0;
  }

  private restoreSummaryTableScrollLeft(scrollLeft: number): void {
    const headerScroll = document.querySelector('.summary-table-header-scroll') as HTMLElement | null;
    const bodyScroll = document.querySelector('.summary-table-body-scroll') as HTMLElement | null;
    if (!headerScroll || !bodyScroll) return;

    bodyScroll.scrollLeft = scrollLeft;
    headerScroll.scrollLeft = scrollLeft;
  }

  private showToast(message: string): void {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    if (this.toastTimeoutId !== null) {
      window.clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }

    toastContainer.innerHTML = `<div class="toast toast-success">${message}</div>`;
    this.toastTimeoutId = window.setTimeout(() => {
      toastContainer.innerHTML = '';
      this.toastTimeoutId = null;
    }, 2400);
  }

  private renderBillOverview(bill: Bill): string {
    const { subtotal, unassignedItemsTotal, grandTotal } = this.calculateBillChargeTotals(bill);
    const assignedItems = bill.items.filter(item => item.dividers.length > 0).length;
    const unassignedItemsCount = bill.items.length - assignedItems;

    return `
      <div class="bill-overview-grid">
        <div class="bill-overview-card">
          <span class="bill-overview-label">People</span>
          <span class="bill-overview-value">${bill.persons.length}</span>
          <span class="bill-overview-subtext">Everyone sharing this bill</span>
        </div>
        <div class="bill-overview-card">
          <span class="bill-overview-label">Items</span>
          <span class="bill-overview-value">${bill.items.length}</span>
          <span class="bill-overview-subtext">${assignedItems} active, ${unassignedItemsCount} unassigned</span>
        </div>
        <div class="bill-overview-card">
          <span class="bill-overview-label">Split Total</span>
          <span class="bill-overview-value">$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span class="bill-overview-subtext">Active subtotal $${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} before service, tax, and tip</span>
        </div>
        <div class="bill-overview-card">
          <span class="bill-overview-label">Unassigned</span>
          <span class="bill-overview-value">$${unassignedItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span class="bill-overview-subtext">${unassignedItemsCount} item(s) not included in the split yet</span>
        </div>
      </div>
    `;
  }

  private calculateBillChargeTotals(bill: Bill): {
    totalItemsPrice: number;
    subtotal: number;
    unassignedItemsTotal: number;
    subtotalAfterService: number;
    taxAmount: number;
    serviceAmount: number;
    tipAmount: number;
    totalCharges: number;
    grandTotal: number;
  } {
    const totalItemsPrice = bill.items.reduce((sum, item) => sum + item.price, 0);
    const subtotal = bill.items.reduce((sum, item) => {
      if (item.dividers.length === 0) {
        return sum;
      }

      return sum + item.price;
    }, 0);
    const unassignedItemsTotal = totalItemsPrice - subtotal;
    const serviceAmount = bill.charges.serviceEnabled ? subtotal * (bill.charges.serviceRate / 100) : 0;
    const subtotalAfterService = subtotal + serviceAmount;
    const taxAmount = bill.charges.taxEnabled ? subtotalAfterService * (bill.charges.taxRate / 100) : 0;
    const tipAmount = bill.charges.tipEnabled ? subtotalAfterService * (bill.charges.tipRate / 100) : 0;
    const totalCharges = taxAmount + serviceAmount + tipAmount;
    const grandTotal = subtotal + totalCharges;

    return { totalItemsPrice, subtotal, unassignedItemsTotal, subtotalAfterService, taxAmount, serviceAmount, tipAmount, totalCharges, grandTotal };
  }

  private renderChargeControls(bill: Bill): string {
    const { subtotal, unassignedItemsTotal, subtotalAfterService, taxAmount, serviceAmount, tipAmount, grandTotal } = this.calculateBillChargeTotals(bill);

    return `
      <div class="charges-card">
        <div class="charges-header">
          <div>
            <h4 class="charges-title">Additional Charges</h4>
            <p class="charges-subtext">Apply bill-level tax, service, and tip to active items only. Service is calculated first, then tax and tip use the subtotal after service. Charges are split proportionally across each person based on their subtotal.</p>
          </div>
        </div>
        <div class="charges-grid">
          <label class="charges-field">
            <span class="charges-field-header">
              <span>Tax %</span>
              <span class="charges-toggle">
                <input
                  type="checkbox"
                  ${bill.charges.taxEnabled ? 'checked' : ''}
                  onchange="billUI.updateBillChargeToggle('taxEnabled', this.checked)"
                >
                Apply
              </span>
            </span>
            <input
              type="number"
              min="0"
              max="1000"
              step="1"
              value="${bill.charges.taxRate}"
              ${bill.charges.taxEnabled ? '' : 'disabled'}
              onchange="billUI.updateBillCharge('taxRate', this.value)"
            >
          </label>
          <label class="charges-field">
            <span class="charges-field-header">
              <span>Service %</span>
              <span class="charges-toggle">
                <input
                  type="checkbox"
                  ${bill.charges.serviceEnabled ? 'checked' : ''}
                  onchange="billUI.updateBillChargeToggle('serviceEnabled', this.checked)"
                >
                Apply
              </span>
            </span>
            <input
              type="number"
              min="0"
              max="1000"
              step="1"
              value="${bill.charges.serviceRate}"
              ${bill.charges.serviceEnabled ? '' : 'disabled'}
              onchange="billUI.updateBillCharge('serviceRate', this.value)"
            >
          </label>
          <label class="charges-field">
            <span class="charges-field-header">
              <span>Tip %</span>
              <span class="charges-toggle">
                <input
                  type="checkbox"
                  ${bill.charges.tipEnabled ? 'checked' : ''}
                  onchange="billUI.updateBillChargeToggle('tipEnabled', this.checked)"
                >
                Apply
              </span>
            </span>
            <input
              type="number"
              min="0"
              max="1000"
              step="1"
              value="${bill.charges.tipRate}"
              ${bill.charges.tipEnabled ? '' : 'disabled'}
              onchange="billUI.updateBillCharge('tipRate', this.value)"
            >
          </label>
        </div>
        <div class="charges-summary">
          <div class="charges-pill">Active Subtotal: $${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="charges-pill">Unassigned Items: $${unassignedItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="charges-pill">Service: $${serviceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="charges-pill">Subtotal After Service: $${subtotalAfterService.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="charges-pill">Tax: $${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="charges-pill">Tip: $${tipAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="charges-pill charges-pill-total">Final Total: $${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>
    `;
  }

  private renderUnassignedWarning(bill: Bill): string {
    const { unassignedItemsTotal } = this.calculateBillChargeTotals(bill);
    if (unassignedItemsTotal <= 0.009) {
      return '';
    }

    const unassignedItemsCount = bill.items.filter(item => item.dividers.length === 0).length;

    return `
      <div class="warning-banner">
        <h4 class="warning-banner-title">Unassigned items are excluded from the split</h4>
        <p class="warning-banner-text">${unassignedItemsCount} item(s) worth $${unassignedItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} are not assigned to anyone yet. They are excluded from the split total, charges, settlement instructions, and export summary until at least one person is selected for each item.</p>
      </div>
    `;
  }

  private renderEmptyWorkflowState(title: string, description: string, steps: string[]): string {
    return `
      <div class="empty-workflow-state">
        <h4>${title}</h4>
        <p>${description}</p>
        <div class="empty-workflow-steps">
          ${steps.map((step, index) => `<div class="empty-workflow-step">${index + 1}. ${step}</div>`).join('')}
        </div>
      </div>
    `;
  }

  private renderSettlementCard(bill: Bill, personTotals: { [personId: string]: number }): string {
    const settlementRecipient = bill.settlementRecipientId
      ? bill.persons.find(person => person.id === bill.settlementRecipientId) ?? null
      : null;
    const totalTracked = Object.values(personTotals).reduce((sum, total) => sum + total, 0);
    const settlementSteps = settlementRecipient
      ? bill.persons
          .filter(person => person.id !== settlementRecipient.id)
          .map(person => ({
            fromName: person.name,
            toName: settlementRecipient.name,
            amount: personTotals[person.id] ?? 0
          }))
          .filter(step => step.amount > 0.009)
          .sort((left, right) => right.amount - left.amount)
      : [];
    const collectAmount = settlementSteps.reduce((sum, step) => sum + step.amount, 0);

    let settlementBody = '<div class="settlement-empty">Select who paid the bill upfront to generate payback instructions.</div>';

    if (totalTracked <= 0.009) {
      settlementBody = '<div class="settlement-empty">Assign at least one person to an item before settlement instructions can be generated.</div>';
    } else if (settlementRecipient && settlementSteps.length === 0) {
      settlementBody = `<div class="settlement-empty">No one else needs to reimburse ${settlementRecipient.name}. Everyone else currently owes $0.00.</div>`;
    } else if (settlementSteps.length > 0) {
      settlementBody = `
        <div class="settlement-summary">
          <div class="settlement-stat">Collector: ${settlementRecipient?.name}</div>
          <div class="settlement-stat">To collect: $${collectAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="settlement-list">
          ${settlementSteps.map(step => `
            <div class="settlement-item">
              <div class="settlement-route">${step.fromName} pays ${step.toName}</div>
              <div class="settlement-amount">$${step.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="settlement-card">
        <div class="settlement-header">
          <div>
            <h4 class="settlement-title">Settlement Mode</h4>
            <p class="settlement-subtext">Pick who paid upfront, then use the suggested payback instructions below.</p>
          </div>
          <div class="settlement-controls">
            <select class="settlement-select" onchange="billUI.updateSettlementRecipient(this.value)">
              <option value="">Select collector</option>
              ${bill.persons.map(person => `
                <option value="${person.id}" ${person.id === bill.settlementRecipientId ? 'selected' : ''}>${person.name}</option>
              `).join('')}
            </select>
          </div>
        </div>
        ${settlementBody}
      </div>
    `;
  }

  private renderMobileSummaryCards(bill: Bill, personTotals: { [personId: string]: number }): string {
    return `
      <div class="mobile-summary-grid">
        ${bill.persons.map(person => {
          const sharedItems = bill.items.filter(item => item.dividers.includes(person.id));
          return `
            <div class="mobile-summary-card">
              <div class="mobile-summary-card-header">
                <span class="mobile-summary-name">${person.name}</span>
                <span class="mobile-summary-total">$${personTotals[person.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="mobile-summary-meta">${sharedItems.length} ${sharedItems.length === 1 ? 'item' : 'items'} shared</div>
              <div class="mobile-summary-items">${sharedItems.length > 0 ? sharedItems.map(item => item.name).join(', ') : 'No items assigned yet'}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private calculateSummaryMatrix(bill: Bill): {
    matrix: { [personId: string]: { [itemId: string]: number } };
    itemTotals: { [itemId: string]: number };
    personSubtotals: { [personId: string]: number };
    personTotals: { [personId: string]: number };
    subtotalAfterService: number;
    taxAmount: number;
    serviceAmount: number;
    tipAmount: number;
    totalCharges: number;
    subtotal: number;
    grandTotal: number;
  } {
    const matrix: { [personId: string]: { [itemId: string]: number } } = {};
    const itemTotals: { [itemId: string]: number } = {};
    const personSubtotals: { [personId: string]: number } = {};
    const personTotals: { [personId: string]: number } = {};

    bill.persons.forEach(person => {
      matrix[person.id] = {};
      personSubtotals[person.id] = 0;
      personTotals[person.id] = 0;
      bill.items.forEach(item => {
        matrix[person.id][item.id] = 0;
        if (!itemTotals[item.id]) {
          itemTotals[item.id] = 0;
        }
      });
    });

    bill.items.forEach(item => {
      if (item.dividers.length === 0) {
        return;
      }

      const splitAmount = item.price / item.dividers.length;
      item.dividers.forEach(personId => {
        if (!matrix[personId]) {
          return;
        }

        matrix[personId][item.id] = splitAmount;
        personSubtotals[personId] += splitAmount;
        itemTotals[item.id] += splitAmount;
      });
    });

    const { subtotal, subtotalAfterService, taxAmount, serviceAmount, tipAmount, totalCharges, grandTotal } = this.calculateBillChargeTotals(bill);
    const proportionalChargeRate = subtotal > 0 ? totalCharges / subtotal : 0;

    Object.entries(personSubtotals).forEach(([personId, subtotalAmount]) => {
      personTotals[personId] = subtotalAmount + (subtotalAmount * proportionalChargeRate);
    });

    return { matrix, itemTotals, personSubtotals, personTotals, subtotalAfterService, taxAmount, serviceAmount, tipAmount, totalCharges, subtotal, grandTotal };
  }

  private renderExportSummaryTable(
    bill: Bill,
    matrix: { [personId: string]: { [itemId: string]: number } },
    itemTotals: { [itemId: string]: number },
    personTotals: { [personId: string]: number },
    grandTotal: number,
    personColumnWidth: number,
    columnWidths: number[]
  ): string {
    const safeWidths = columnWidths.length === bill.items.length + 1
      ? columnWidths
      : [...bill.items.map(() => 120), 100];

    return `
      <div class="export-summary-table-shell">
        <table class="export-summary-table">
          <colgroup>
            <col style="width: ${personColumnWidth}px; min-width: ${personColumnWidth}px; max-width: ${personColumnWidth}px;">
            ${safeWidths.map(width => `<col style="width: ${width}px; min-width: ${width}px; max-width: ${width}px;">`).join('')}
          </colgroup>
          <thead>
            <tr>
              <th class="export-person-header">Person</th>
              ${bill.items.map(item => `
                <th class="export-item-header">
                  <div class="export-header-title">${item.name}</div>
                  <div class="export-header-meta">$${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div class="export-header-meta">${item.dividers.length} ${item.dividers.length === 1 ? 'person' : 'people'}</div>
                </th>
              `).join('')}
              <th class="export-total-header">Total</th>
            </tr>
          </thead>
          <tbody>
            ${bill.persons.map((person, personIndex) => `
              <tr class="${personIndex % 2 === 0 ? 'export-row-even' : 'export-row-odd'}">
                <th class="export-person-cell">${person.name}</th>
                ${bill.items.map(item => {
                  const amount = matrix[person.id][item.id];
                  const isChecked = item.dividers.includes(person.id);

                  return `
                    <td class="export-value-cell">
                      <div class="export-value-mark ${isChecked ? 'is-active' : ''}">${isChecked ? '✓' : '○'}</div>
                      <div class="export-value-amount ${amount > 0 ? 'has-amount' : ''}">${amount > 0 ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</div>
                    </td>
                  `;
                }).join('')}
                <td class="export-total-cell">$${personTotals[person.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th class="export-grand-label">Total</th>
              ${bill.items.map(item => `
                <td class="export-grand-total">$${itemTotals[item.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              `).join('')}
              <td class="export-grand-total">$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  private attachSummaryTableHoverEffects(): void {
    const summaryScroll = document.querySelector('.summary-table-body-scroll');
    const summaryFixed = document.querySelector('.summary-table-body-fixed');
    const summaryHeader = document.querySelector('.summary-table-header-scroll');
    if (!summaryScroll || !summaryFixed || !summaryHeader) return;

    const clearColumnHover = () => {
      summaryScroll.querySelectorAll('.column-hover').forEach(element => element.classList.remove('column-hover'));
      summaryHeader.querySelectorAll('.column-hover').forEach(element => element.classList.remove('column-hover'));
    };

    const clearRowHover = () => {
      document.querySelectorAll('.row-hover').forEach(element => element.classList.remove('row-hover'));
    };

    summaryScroll.querySelectorAll<HTMLElement>('[data-col-index]').forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        const columnIndex = cell.dataset.colIndex;
        if (!columnIndex) return;
        clearColumnHover();
        summaryScroll.querySelectorAll<HTMLElement>(`[data-col-index="${columnIndex}"]`).forEach(element => {
          element.classList.add('column-hover');
        });
        summaryHeader.querySelectorAll<HTMLElement>(`[data-col-index="${columnIndex}"]`).forEach(element => {
          element.classList.add('column-hover');
        });
      });
    });

    const attachRowHover = (container: Element) => {
      container.querySelectorAll<HTMLElement>('tr[data-row-index]').forEach(row => {
        row.addEventListener('mouseenter', () => {
          const rowIndex = row.dataset.rowIndex;
          if (!rowIndex) return;
          clearRowHover();
          document.querySelectorAll<HTMLElement>(`tr[data-row-index="${rowIndex}"]`).forEach(element => {
            element.classList.add('row-hover');
          });
        });
      });
    };

    attachRowHover(summaryScroll);
    attachRowHover(summaryFixed);

    summaryScroll.addEventListener('mouseleave', () => {
      clearColumnHover();
      clearRowHover();
    });
    summaryFixed.addEventListener('mouseleave', clearRowHover);
  }

  private syncSummaryTableRowHeights(): void {
    const fixedRows = document.querySelectorAll<HTMLElement>('.summary-table-body-fixed tr');
    const scrollRows = document.querySelectorAll<HTMLElement>('.summary-table-body-scroll tr');
    if (fixedRows.length === 0 || scrollRows.length === 0) return;

    fixedRows.forEach(row => {
      row.style.height = 'auto';
    });
    scrollRows.forEach(row => {
      row.style.height = 'auto';
    });

    const rowCount = Math.min(fixedRows.length, scrollRows.length);
    for (let index = 0; index < rowCount; index += 1) {
      const height = Math.max(fixedRows[index].offsetHeight, scrollRows[index].offsetHeight);
      fixedRows[index].style.height = `${height}px`;
      scrollRows[index].style.height = `${height}px`;
    }
  }

  private syncSummaryTableRowHeightsWithin(root: ParentNode): void {
    const fixedRows = root.querySelectorAll<HTMLElement>('.summary-table-body-fixed tr');
    const scrollRows = root.querySelectorAll<HTMLElement>('.summary-table-body-scroll tr');
    if (fixedRows.length === 0 || scrollRows.length === 0) return;

    fixedRows.forEach(row => {
      row.style.height = 'auto';
    });
    scrollRows.forEach(row => {
      row.style.height = 'auto';
    });

    const rowCount = Math.min(fixedRows.length, scrollRows.length);
    for (let index = 0; index < rowCount; index += 1) {
      const height = Math.max(fixedRows[index].offsetHeight, scrollRows[index].offsetHeight);
      fixedRows[index].style.height = `${height}px`;
      scrollRows[index].style.height = `${height}px`;
    }
  }

  private isBillModalOpen(): boolean {
    return document.getElementById('billEditModal')?.style.display === 'flex';
  }

  private isPersonModalOpen(): boolean {
    return document.getElementById('personInputModal')?.style.display === 'flex';
  }

  private isItemModalOpen(): boolean {
    return document.getElementById('itemInputModal')?.style.display === 'flex';
  }

  private isItemAssignmentModalOpen(): boolean {
    return document.getElementById('itemAssignmentModal')?.style.display === 'flex';
  }

  private isBillImportPreviewModalOpen(): boolean {
    return document.getElementById('billImportPreviewModal')?.style.display === 'flex';
  }

  private showBillImportPreviewModal(preview: PendingBillImportPreview): void {
    this.pendingBillImportPreview = preview;

    const modal = document.getElementById('billImportPreviewModal')!;
    const confirmButton = document.getElementById('confirmBillImportPreviewBtn') as HTMLButtonElement;

    this.renderBillImportPreviewModal();

    confirmButton.querySelector('span')!.textContent = preview.importMode === 'replace' ? 'Replace Bills' : 'Import Bills';

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      confirmButton.focus();
    }, 120);
  }

  closeBillImportPreviewModal(): void {
    const modal = document.getElementById('billImportPreviewModal');
    if (!modal) {
      return;
    }

    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    this.pendingBillImportPreview = null;
    document.body.style.overflow = '';
  }

  toggleBillImportPreviewSelection(billId: string, selected: boolean): void {
    if (!this.pendingBillImportPreview) {
      return;
    }

    const entry = this.pendingBillImportPreview.entries.find(candidate => candidate.billId === billId);
    if (!entry) {
      return;
    }

    entry.selected = selected;
    this.renderBillImportPreviewModal();
  }

  selectAllBillsForImportPreview(): void {
    if (!this.pendingBillImportPreview) {
      return;
    }

    this.pendingBillImportPreview.entries.forEach(entry => {
      entry.selected = true;
    });
    this.renderBillImportPreviewModal();
  }

  clearBillImportPreviewSelection(): void {
    if (!this.pendingBillImportPreview) {
      return;
    }

    this.pendingBillImportPreview.entries.forEach(entry => {
      entry.selected = false;
    });
    this.renderBillImportPreviewModal();
  }

  private renderBillImportPreviewModal(): void {
    const preview = this.pendingBillImportPreview;
    if (!preview) {
      return;
    }

    const summary = document.getElementById('billImportPreviewSummary')!;
    const list = document.getElementById('billImportPreviewList')!;
    const modeLabel = document.getElementById('billImportPreviewModeLabel')!;
    const confirmButton = document.getElementById('confirmBillImportPreviewBtn') as HTMLButtonElement;
    const selectedCount = preview.entries.filter(entry => entry.selected).length;
    const renamedCount = preview.entries.filter(entry => entry.renamed).length;
    const regeneratedIdCount = preview.entries.filter(entry => entry.regeneratedId).length;
    const invalidPersonsDropped = preview.entries.reduce((sum, entry) => sum + entry.invalidPersonsDropped, 0);
    const invalidItemsDropped = preview.entries.reduce((sum, entry) => sum + entry.invalidItemsDropped, 0);
    const invalidDividerReferencesRemoved = preview.entries.reduce((sum, entry) => sum + entry.invalidDividerReferencesRemoved, 0);

    summary.innerHTML = `
      <div class="bill-import-preview-banner ${preview.importMode === 'replace' ? 'is-warning' : ''}">
        <strong>${preview.importMode === 'replace' ? 'Replace current bills' : 'Merge imported bills'}</strong>
        ${preview.importMode === 'replace'
          ? `Importing from ${preview.sourceName} will replace the ${preview.currentBillCount} bill(s) currently stored in this browser.`
          : `Importing from ${preview.sourceName} will add selected bill(s) to the ${preview.currentBillCount} existing bill(s) in this browser.`}
      </div>
      ${preview.ignoredBillCount > 0 ? `
        <div class="bill-import-preview-banner is-warning">
          <strong>Ignored invalid bill records</strong>
          ${preview.ignoredBillCount} bill record(s) in this file could not be imported at all and will be skipped.
        </div>
      ` : ''}
      <div class="bill-import-preview-stats">
        <div class="bill-import-preview-stat">
          <span class="bill-import-preview-stat-label">Bills</span>
          <span class="bill-import-preview-stat-value">${preview.preparedBills.length}</span>
        </div>
        <div class="bill-import-preview-stat">
          <span class="bill-import-preview-stat-label">Selected</span>
          <span class="bill-import-preview-stat-value">${selectedCount}</span>
        </div>
        <div class="bill-import-preview-stat">
          <span class="bill-import-preview-stat-label">Renamed</span>
          <span class="bill-import-preview-stat-value">${renamedCount}</span>
        </div>
        <div class="bill-import-preview-stat">
          <span class="bill-import-preview-stat-label">New IDs</span>
          <span class="bill-import-preview-stat-value">${regeneratedIdCount}</span>
        </div>
        <div class="bill-import-preview-stat">
          <span class="bill-import-preview-stat-label">Invalid People</span>
          <span class="bill-import-preview-stat-value">${invalidPersonsDropped}</span>
        </div>
        <div class="bill-import-preview-stat">
          <span class="bill-import-preview-stat-label">Invalid Items</span>
          <span class="bill-import-preview-stat-value">${invalidItemsDropped}</span>
        </div>
        <div class="bill-import-preview-stat">
          <span class="bill-import-preview-stat-label">Bad References</span>
          <span class="bill-import-preview-stat-value">${invalidDividerReferencesRemoved}</span>
        </div>
      </div>
    `;

    list.innerHTML = preview.entries.map(entry => `
      <div class="bill-import-preview-card ${entry.selected ? '' : 'is-unselected'}">
        <div class="bill-import-preview-card-header">
          <div class="bill-import-preview-card-selector">
            <input
              class="bill-import-preview-card-checkbox"
              type="checkbox"
              ${entry.selected ? 'checked' : ''}
              onchange="billUI.toggleBillImportPreviewSelection('${entry.billId}', this.checked)"
              aria-label="Select ${entry.finalName} for import"
            >
            <div class="bill-import-preview-card-details">
              <div class="bill-import-preview-card-title">${entry.finalName}</div>
              <div class="bill-import-preview-card-subtitle">
                ${entry.personsCount} person(s) · ${entry.itemsCount} item(s)
                ${entry.renamed ? `<br>Original name: ${entry.originalName}` : ''}
              </div>
              ${entry.invalidPersonsDropped > 0 || entry.invalidItemsDropped > 0 || entry.invalidDividerReferencesRemoved > 0 ? `
                <div class="bill-import-preview-card-cleanup">
                  <strong>Cleanup:</strong>
                  ${[
                    entry.invalidPersonsDropped > 0 ? `${entry.invalidPersonsDropped} invalid person(s) dropped` : '',
                    entry.invalidItemsDropped > 0 ? `${entry.invalidItemsDropped} invalid item(s) dropped` : '',
                    entry.invalidDividerReferencesRemoved > 0 ? `${entry.invalidDividerReferencesRemoved} invalid divider reference(s) removed` : ''
                  ].filter(Boolean).join(' · ')}
                </div>
              ` : ''}
            </div>
          </div>
          <div class="bill-import-preview-card-badges">
            ${entry.renamed ? '<span class="bill-import-preview-badge is-renamed">Renamed</span>' : ''}
            ${entry.regeneratedId ? '<span class="bill-import-preview-badge is-regenerated">New ID</span>' : ''}
            ${entry.invalidPersonsDropped > 0 ? '<span class="bill-import-preview-badge is-invalid">People Cleaned</span>' : ''}
            ${entry.invalidItemsDropped > 0 ? '<span class="bill-import-preview-badge is-invalid">Items Cleaned</span>' : ''}
            ${entry.invalidDividerReferencesRemoved > 0 ? '<span class="bill-import-preview-badge is-invalid">Refs Cleaned</span>' : ''}
          </div>
        </div>
      </div>
    `).join('');

    modeLabel.textContent = `${preview.importMode === 'replace' ? 'Replace mode' : 'Merge mode'} · ${selectedCount} selected`;
    confirmButton.disabled = selectedCount === 0;
  }

  confirmBillImportPreview(): void {
    const preview = this.pendingBillImportPreview;
    if (!preview) {
      return;
    }

    const selectedBills = preview.preparedBills.filter(bill =>
      preview.entries.some(entry => entry.billId === bill.id && entry.selected)
    );
    if (selectedBills.length === 0) {
      this.showToast('Select at least one bill to import');
      return;
    }

    this.pendingBillImportPreview = null;
    this.recordHistorySnapshot();

    const preferredImportedBillId = preview.entries.some(entry => entry.billId === preview.preferredImportedBillId && entry.selected)
      ? preview.preferredImportedBillId
      : selectedBills[0]?.id || null;

    if (preview.importMode === 'replace') {
      this.closeBillImportPreviewModal();
      this.applyImportedBillsAsReplacement(selectedBills, preferredImportedBillId, preview.sourceName);
      return;
    }

    this.closeBillImportPreviewModal();
    this.applyImportedBillsAsMerge(selectedBills, preview.sourceName, true);
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    localStorage.setItem('billCalculatorTheme', this.isDarkTheme ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.querySelector('.theme-icon');
    const themeText = document.querySelector('.theme-text');

    if (this.isDarkTheme) {
      body.setAttribute('data-theme', 'dark');
      if (themeIcon) themeIcon.textContent = '☀️';
      if (themeText) themeText.textContent = 'Light';
    } else {
      body.removeAttribute('data-theme');
      if (themeIcon) themeIcon.textContent = '🌙';
      if (themeText) themeText.textContent = 'Dark';
    }
  }

  updateSettlementRecipient(personId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const nextRecipientId = personId || null;
    if (!bill || bill.settlementRecipientId === nextRecipientId) {
      return;
    }

    this.recordHistorySnapshot();
    this.calculator.setSettlementRecipient(this.currentBillId, nextRecipientId);
    this.updateSummaryTable();
    this.saveDraftState();
    this.showToast(nextRecipientId ? 'Settlement collector updated' : 'Settlement collector cleared');
  }

  updateBillCharge(chargeKey: 'taxRate' | 'serviceRate' | 'tipRate', value: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    if (!bill) return;

    const parsedValue = Number.parseFloat(value);
    const nextValue = Number.isFinite(parsedValue) ? Math.min(Math.max(Math.round(parsedValue), 0), 1000) : 0;
    if (bill.charges[chargeKey] === nextValue) {
      return;
    }

    this.recordHistorySnapshot();
    this.calculator.updateBillCharges(this.currentBillId, {
      ...bill.charges,
      [chargeKey]: nextValue
    });
    this.updateSummaryTable();
    this.saveDraftState();
    this.showToast('Additional charges updated');
  }

  updateBillChargeToggle(chargeKey: 'taxEnabled' | 'serviceEnabled' | 'tipEnabled', enabled: boolean): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    if (!bill || bill.charges[chargeKey] === enabled) return;

    this.recordHistorySnapshot();
    this.calculator.updateBillCharges(this.currentBillId, {
      ...bill.charges,
      [chargeKey]: enabled
    });
    this.updateSummaryTable();
    this.saveDraftState();
    this.showToast(enabled ? 'Charge enabled' : 'Charge disabled');
  }

  createNewBill(): void {
    const billNameInput = document.getElementById('billName') as HTMLInputElement;
    const billName = billNameInput.value.trim();

    if (!billName) {
      alert('Please enter a bill name');
      return;
    }

    this.recordHistorySnapshot();
    const billId = this.calculator.createBill(billName);
    billNameInput.value = '';
    this.updateBillsList();
    this.selectBill(billId);
    this.saveDraftState();
    this.showToast(`Bill "${billName}" created`);
  }

  editCurrentBill(): void {
    if (!this.currentBillId) return;
    this.editBill(this.currentBillId);
  }

  private showBillEditModal(billId: string): void {
    const bill = this.calculator.getBill(billId);
    if (!bill) return;

    const modal = document.getElementById('billEditModal')!;
    const title = document.getElementById('billModalTitle');
    const hint = document.getElementById('billNameHint');
    const input = document.getElementById('modalBillName') as HTMLInputElement;
    const submitButton = document.getElementById('saveBillSubmitBtn') as HTMLButtonElement;
    const submitButtonLabel = document.getElementById('billSubmitButtonLabel');

    this.editingBillId = billId;
    this.clearBillModalError();
    if (title) title.textContent = 'Edit Bill';
    if (hint) hint.textContent = 'Give this bill a clear name so it is easy to find later.';
    if (submitButtonLabel) submitButtonLabel.textContent = 'Save Changes';
    input.value = bill.name;
    submitButton.disabled = false;
    submitButton.classList.remove('loading');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      input.focus();
      input.select();
    }, 150);
  }

  closeBillModal(): void {
    const modal = document.getElementById('billEditModal');
    const title = document.getElementById('billModalTitle');
    const hint = document.getElementById('billNameHint');
    const input = document.getElementById('modalBillName') as HTMLInputElement | null;
    const submitButton = document.getElementById('saveBillSubmitBtn') as HTMLButtonElement | null;
    const submitButtonLabel = document.getElementById('billSubmitButtonLabel');

    this.editingBillId = null;
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    if (title) {
      title.textContent = 'Edit Bill';
    }
    if (hint) {
      hint.textContent = 'Give this bill a clear name so it is easy to find later.';
    }
    if (input) {
      input.value = '';
      input.classList.remove('error');
    }
    if (submitButtonLabel) {
      submitButtonLabel.textContent = 'Save Changes';
    }
    this.clearBillModalError();
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove('loading');
    }
    document.body.style.overflow = '';
  }

  saveBillFromModal(): void {
    if (!this.editingBillId) return;

    const input = document.getElementById('modalBillName') as HTMLInputElement;
    const submitButton = document.getElementById('saveBillSubmitBtn') as HTMLButtonElement;
    const nextBillName = input.value.trim();

    this.clearBillModalError();
    if (!nextBillName) {
      this.showBillModalError('Bill name cannot be empty.');
      input.focus();
      return;
    }

    const bill = this.calculator.getBill(this.editingBillId);
    if (!bill) {
      this.closeBillModal();
      return;
    }

    if (nextBillName === bill.name) {
      this.closeBillModal();
      return;
    }

    submitButton.classList.add('loading');
    submitButton.disabled = true;

    this.recordHistorySnapshot();
    const updated = this.calculator.updateBillName(this.editingBillId, nextBillName);
    if (!updated) {
      submitButton.classList.remove('loading');
      submitButton.disabled = false;
      this.showBillModalError('Unable to update the bill name. Please try again.');
      input.focus();
      return;
    }

    this.updateBillsList();
    if (this.currentBillId === this.editingBillId) {
      document.getElementById('currentBillTitle')!.textContent = `Current Bill: ${nextBillName}`;
      this.updateSummaryTable();
    }
    this.closeBillModal();
    this.saveDraftState();
    this.showToast(`Renamed bill to "${nextBillName}"`);
  }

  editBill(billId: string): void {
    this.showBillEditModal(billId);
  }

  exportCurrentBillJson(): void {
    if (!this.currentBillId) {
      this.showToast('Select a bill before exporting');
      return;
    }

    const bill = this.calculator.getBill(this.currentBillId);
    if (!bill) {
      this.showToast('Select a valid bill before exporting');
      this.updateBillTransferActionState();
      return;
    }

    this.downloadBillTransferFile(
      this.createBillTransferPayload('single-bill', [bill], bill.id),
      `${this.createDownloadSafeName(bill.name)}_bill.json`
    );
    this.showToast(`Exported ${bill.name}`);
  }

  exportAllBillsJson(): void {
    const bills = this.calculator.exportBills();
    if (bills.length === 0) {
      this.showToast('Create a bill before exporting all bills');
      this.updateBillTransferActionState();
      return;
    }

    const currentBillId = this.currentBillId && this.calculator.getBill(this.currentBillId)
      ? this.currentBillId
      : bills[0]?.id || null;

    this.downloadBillTransferFile(
      this.createBillTransferPayload('bill-list', bills, currentBillId),
      `all_bills_${new Date().toISOString().split('T')[0]}.json`
    );
    this.showToast(`Exported ${bills.length} ${bills.length === 1 ? 'bill' : 'bills'}`);
  }

  openBillImportPicker(importMode: BillImportMode = 'merge'): void {
    const importInput = document.getElementById('billImportInput') as HTMLInputElement | null;
    if (!importInput) {
      alert('Import control is not available right now. Please refresh and try again.');
      return;
    }

    importInput.dataset.importMode = importMode;
    importInput.value = '';
    importInput.click();
  }

  private async handleImportedBillFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    try {
      const importMode = input?.dataset.importMode === 'replace' ? 'replace' : 'merge';
      await this.importBillsFromFile(file, importMode);
    } catch (error) {
      console.error('Failed to import bill file:', error);
      alert('Unable to import that file. Please choose a valid Bill Calculator JSON export.');
    } finally {
      if (input) {
        delete input.dataset.importMode;
        input.value = '';
      }
    }
  }

  selectBill(billId: string): void {
    this.currentBillId = billId;
    this.showOnlyUnassignedItems = false;
    const bill = this.calculator.getBill(billId);
    if (!bill) return;

    document.getElementById('currentBillTitle')!.textContent = `Current Bill: ${bill.name}`;
    document.getElementById('currentBillSection')!.style.display = 'block';
    
    this.updateBillsList();
    this.updateBillTransferActionState();
    this.updateSummaryTable();
    this.saveDraftState();
  }

  deleteBill(billId: string): void {
    const bill = this.calculator.getBill(billId);
    if (!bill) return;

    const confirmMessage = `Are you sure you want to delete "${bill.name}"?\n\nThis will permanently remove:\n- ${bill.persons.length} person(s)\n- ${bill.items.length} item(s)\n- All associated data\n\nThis action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
      this.recordHistorySnapshot();
      const success = this.calculator.deleteBill(billId);
      if (success) {
        if (this.currentBillId === billId) {
          this.resetCurrentBillView();
        }
        this.updateBillsList();
        this.saveDraftState();
      } else {
        alert('Failed to delete bill. Please try again.');
      }
    }
  }

  deleteCurrentBill(): void {
    if (!this.currentBillId) return;
    this.deleteBill(this.currentBillId);
  }

  private clearBillModalError(): void {
    const errorElement = document.getElementById('billNameError');
    const input = document.getElementById('modalBillName') as HTMLInputElement | null;

    if (errorElement) {
      errorElement.style.display = 'none';
      errorElement.textContent = '';
    }
    if (input) {
      input.classList.remove('error');
    }
  }

  private showBillModalError(message: string): void {
    const errorElement = document.getElementById('billNameError');
    const input = document.getElementById('modalBillName') as HTMLInputElement | null;

    if (errorElement) {
      errorElement.style.display = 'block';
      errorElement.textContent = message;
    }
    if (input) {
      input.classList.add('error');
    }
  }

  showPersonModal(): void {
    const modal = document.getElementById('personInputModal')!;
    const input = document.getElementById('modalPersonName') as HTMLInputElement;
    const bulkInput = document.getElementById('modalPersonNames') as HTMLTextAreaElement;
    const submitButton = document.getElementById('addPersonSubmitBtn') as HTMLButtonElement;
    const title = document.getElementById('personModalTitle');
    const nameHint = document.getElementById('personNameHint');
    const bulkGroup = document.getElementById('personBulkGroup');
    const submitButtonLabel = document.getElementById('personSubmitButtonLabel');
    
    this.editingPersonId = null;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    // Clear previous values and errors
    if (title) title.textContent = 'Add Person';
    if (nameHint) nameHint.textContent = 'Who will be splitting the bill?';
    if (bulkGroup) bulkGroup.style.display = '';
    if (submitButtonLabel) submitButtonLabel.textContent = 'Add Person';
    input.value = '';
    bulkInput.value = '';
    this.clearModalErrors('person');
    this.updatePersonPreview();
    submitButton.disabled = true;
    
    // Focus with slight delay for animation
    setTimeout(() => {
      input.focus();
      input.select();
    }, 150);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  closePersonModal(): void {
    const modal = document.getElementById('personInputModal')!;
    const submitButton = document.getElementById('addPersonSubmitBtn') as HTMLButtonElement;
    const title = document.getElementById('personModalTitle');
    const nameHint = document.getElementById('personNameHint');
    const bulkGroup = document.getElementById('personBulkGroup');
    const submitButtonLabel = document.getElementById('personSubmitButtonLabel');
    
    this.editingPersonId = null;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    
    // Clear form
    if (title) title.textContent = 'Add Person';
    if (nameHint) nameHint.textContent = 'Who will be splitting the bill?';
    if (bulkGroup) bulkGroup.style.display = '';
    if (submitButtonLabel) submitButtonLabel.textContent = 'Add Person';
    (document.getElementById('modalPersonName') as HTMLInputElement).value = '';
    (document.getElementById('modalPersonNames') as HTMLTextAreaElement).value = '';
    this.clearModalErrors('person');
    this.updatePersonPreview();
    submitButton.disabled = true;
    
    // Restore body scroll
    document.body.style.overflow = '';
  }

  addPersonFromModal(): void {
    if (!this.currentBillId) return;

    const personNameInput = document.getElementById('modalPersonName') as HTMLInputElement;
    const bulkPersonInput = document.getElementById('modalPersonNames') as HTMLTextAreaElement;
    const addButton = document.getElementById('addPersonSubmitBtn')! as HTMLButtonElement;
    const personEntries = this.parsePersonEntries(personNameInput.value, bulkPersonInput.value);
    
    // Clear previous errors
    this.clearModalErrors('person');

    if (this.editingPersonId) {
      const nextPersonName = personNameInput.value.trim();

      if (!nextPersonName) {
        this.showModalError('person', 'personName', 'Enter a person name');
        personNameInput.focus();
        return;
      }

      const bill = this.calculator.getBill(this.currentBillId);
      const existingPerson = bill?.persons.find(person => person.id === this.editingPersonId);
      if (!existingPerson) {
        this.closePersonModal();
        return;
      }

      if (nextPersonName === existingPerson.name) {
        this.closePersonModal();
        return;
      }

      addButton.classList.add('loading');
      addButton.disabled = true;

      this.recordHistorySnapshot();
      const updated = this.calculator.updatePersonName(this.currentBillId, this.editingPersonId, nextPersonName);
      if (!updated) {
        addButton.classList.remove('loading');
        addButton.disabled = false;
        this.showModalError('person', 'personName', 'Unable to update the person name. Check for duplicates and try again.');
        personNameInput.focus();
        return;
      }

      this.closePersonModal();
      this.updateSummaryTable();
      this.saveDraftState();
      this.showToast(`Updated ${nextPersonName}`);
      addButton.classList.remove('loading');
      addButton.disabled = false;
      return;
    }
    
    if (personEntries.names.length === 0) {
      this.showModalError('person', 'personName', 'Enter one name or paste multiple names');
      personNameInput.focus();
      return;
    }

    if (personEntries.invalidNames.length > 0) {
      this.showModalError('person', 'personBulk', `Names cannot be empty: ${personEntries.invalidNames.join(', ')}`);
      bulkPersonInput.focus();
      return;
    }

    const bill = this.calculator.getBill(this.currentBillId);
    const existingNames = personEntries.names.filter(name =>
      bill?.persons.some(person => person.name.toLowerCase() === name.toLowerCase())
    );

    if (personEntries.duplicateNames.length > 0) {
      this.showModalError('person', 'personBulk', `Duplicate names in this batch: ${personEntries.duplicateNames.join(', ')}`);
      bulkPersonInput.focus();
      return;
    }

    if (existingNames.length > 0) {
      this.showModalError('person', 'personBulk', `Already added: ${existingNames.join(', ')}`);
      if (bulkPersonInput.value.trim()) {
        bulkPersonInput.focus();
      } else {
        personNameInput.focus();
      }
      return;
    }

    // Show loading state
    addButton.classList.add('loading');
    addButton.disabled = true;

    this.recordHistorySnapshot();
    this.calculator.addPeople(this.currentBillId, personEntries.names);
    this.closePersonModal();
    this.updateSummaryTable();
    this.saveDraftState();
    this.showToast(`Added ${personEntries.names.length} ${personEntries.names.length === 1 ? 'person' : 'people'}`);
    
    // Remove loading state
    addButton.classList.remove('loading');
    addButton.disabled = false;
  }

  showItemModal(): void {
    const modal = document.getElementById('itemInputModal')!;
    const nameInput = document.getElementById('modalItemName') as HTMLInputElement;
    const priceInput = document.getElementById('modalItemPrice') as HTMLInputElement;
    const bulkInput = document.getElementById('modalBulkItems') as HTMLTextAreaElement;
    const submitButton = document.getElementById('addItemSubmitBtn') as HTMLButtonElement;
    const title = document.getElementById('itemModalTitle');
    const nameHint = document.getElementById('itemNameHint');
    const priceHint = document.getElementById('itemPriceHint');
    const bulkGroup = document.getElementById('itemBulkGroup');
    const submitButtonLabel = document.getElementById('itemSubmitButtonLabel');
    
    this.editingItemId = null;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    // Clear previous values and errors
    if (title) title.textContent = 'Add Item';
    if (nameHint) nameHint.textContent = 'What item are you adding to the bill?';
    if (priceHint) priceHint.textContent = 'Enter the total cost of this item';
    if (bulkGroup) bulkGroup.style.display = '';
    if (submitButtonLabel) submitButtonLabel.textContent = 'Add Item';
    nameInput.value = '';
    priceInput.value = '';
    bulkInput.value = '';
    this.clearModalErrors('item');
    this.updateItemPreview();
    submitButton.disabled = true;
    
    // Focus with slight delay for animation
    setTimeout(() => {
      nameInput.focus();
      nameInput.select();
    }, 150);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  closeItemModal(): void {
    const modal = document.getElementById('itemInputModal')!;
    const submitButton = document.getElementById('addItemSubmitBtn') as HTMLButtonElement;
    const title = document.getElementById('itemModalTitle');
    const nameHint = document.getElementById('itemNameHint');
    const priceHint = document.getElementById('itemPriceHint');
    const bulkGroup = document.getElementById('itemBulkGroup');
    const submitButtonLabel = document.getElementById('itemSubmitButtonLabel');
    
    this.editingItemId = null;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    
    // Clear form
    if (title) title.textContent = 'Add Item';
    if (nameHint) nameHint.textContent = 'What item are you adding to the bill?';
    if (priceHint) priceHint.textContent = 'Enter the total cost of this item';
    if (bulkGroup) bulkGroup.style.display = '';
    if (submitButtonLabel) submitButtonLabel.textContent = 'Add Item';
    (document.getElementById('modalItemName') as HTMLInputElement).value = '';
    (document.getElementById('modalItemPrice') as HTMLInputElement).value = '';
    (document.getElementById('modalBulkItems') as HTMLTextAreaElement).value = '';
    this.clearModalErrors('item');
    this.updateItemPreview();
    submitButton.disabled = true;
    
    // Restore body scroll
    document.body.style.overflow = '';
  }

  showItemAssignmentModal(itemId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const item = bill?.items.find(existingItem => existingItem.id === itemId);
    if (!bill || !item) return;
    if (bill.persons.length === 0) {
      this.showToast('Add people before assigning this item');
      return;
    }

    this.currentItemAssignmentItemId = itemId;

    const modal = document.getElementById('itemAssignmentModal')!;
    const label = document.getElementById('itemAssignmentModalLabel')!;
    const hint = document.getElementById('itemAssignmentModalHint')!;
    const list = document.getElementById('itemAssignmentList')!;
    const error = document.getElementById('itemAssignmentError')!;
    const selectionSummary = document.getElementById('itemAssignmentSelectionSummary')!;
    const submitButton = document.getElementById('saveItemAssignmentBtn') as HTMLButtonElement;

    label.textContent = `Choose who shares ${item.name}`;
    hint.textContent = `Select the people who should split $${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
    list.innerHTML = bill.persons.map(person => `
      <label class="assignment-modal-item">
        <input type="checkbox" value="${person.id}" ${item.dividers.includes(person.id) ? 'checked' : ''} onchange="billUI.updateItemAssignmentSelectionSummary()">
        <span>${person.name}</span>
      </label>
    `).join('');
    error.textContent = '';
    error.style.display = 'none';
    selectionSummary.textContent = '';
    submitButton.disabled = false;
    this.updateItemAssignmentSelectionSummary();

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      const firstCheckbox = list.querySelector('input') as HTMLInputElement | null;
      firstCheckbox?.focus();
    }, 150);
  }

  closeItemAssignmentModal(): void {
    const modal = document.getElementById('itemAssignmentModal');
    const list = document.getElementById('itemAssignmentList');
    const error = document.getElementById('itemAssignmentError');
    const selectionSummary = document.getElementById('itemAssignmentSelectionSummary');
    const submitButton = document.getElementById('saveItemAssignmentBtn') as HTMLButtonElement | null;

    this.currentItemAssignmentItemId = null;
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    if (list) {
      list.innerHTML = '';
    }
    if (error) {
      error.textContent = '';
      error.style.display = 'none';
    }
    if (selectionSummary) {
      selectionSummary.textContent = '0 selected';
    }
    if (submitButton) {
      submitButton.disabled = false;
    }
    document.body.style.overflow = '';
  }

  updateItemAssignmentSelectionSummary(): void {
    const list = document.getElementById('itemAssignmentList');
    const selectionSummary = document.getElementById('itemAssignmentSelectionSummary');
    if (!list || !selectionSummary) return;

    const selectedCount = list.querySelectorAll('input[type="checkbox"]:checked').length;
    selectionSummary.textContent = `${selectedCount} selected`;
  }

  selectAllPeopleForCurrentItem(): void {
    const list = document.getElementById('itemAssignmentList');
    if (!list) return;

    list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => {
      input.checked = true;
    });
    this.updateItemAssignmentSelectionSummary();
  }

  clearSelectedPeopleForCurrentItem(): void {
    const list = document.getElementById('itemAssignmentList');
    const error = document.getElementById('itemAssignmentError');
    if (!list) return;

    list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => {
      input.checked = false;
    });
    if (error) {
      error.textContent = '';
      error.style.display = 'none';
    }
    this.updateItemAssignmentSelectionSummary();
  }

  saveItemAssignmentFromModal(): void {
    if (!this.currentBillId || !this.currentItemAssignmentItemId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const item = bill?.items.find(existingItem => existingItem.id === this.currentItemAssignmentItemId);
    const list = document.getElementById('itemAssignmentList');
    const error = document.getElementById('itemAssignmentError');
    if (!bill || !item || !list || !error) return;

    const selectedPersonIds = Array.from(list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')).map(input => input.value);
    error.textContent = '';
    error.style.display = 'none';

    this.recordHistorySnapshot();
    this.calculator.setItemDividers(this.currentBillId, this.currentItemAssignmentItemId, selectedPersonIds);
    this.closeItemAssignmentModal();
    this.updateSummaryTable();
    this.saveDraftState();
    this.showToast(selectedPersonIds.length > 0 ? `${item.name} updated for selected people` : `${item.name} assignments cleared`);
  }

  addItemFromModal(): void {
    if (!this.currentBillId) return;

    const itemNameInput = document.getElementById('modalItemName') as HTMLInputElement;
    const itemPriceInput = document.getElementById('modalItemPrice') as HTMLInputElement;
    const bulkItemsInput = document.getElementById('modalBulkItems') as HTMLTextAreaElement;
    const addButton = document.getElementById('addItemSubmitBtn')! as HTMLButtonElement;
    const itemEntries: Array<{ name: string; price: number }> = [];
    const itemName = itemNameInput.value.trim();
    const itemPrice = parseFloat(itemPriceInput.value);
    const hasSingleInput = itemName.length > 0 || itemPriceInput.value.trim().length > 0;
    const bulkResult = this.parseBulkItemEntries(bulkItemsInput.value);
    
    // Clear previous errors
    this.clearModalErrors('item');

    if (this.editingItemId) {
      if (!itemName) {
        this.showModalError('item', 'itemName', 'Please enter an item name');
        itemNameInput.focus();
        return;
      }

      if (!itemPriceInput.value || isNaN(itemPrice)) {
        this.showModalError('item', 'itemPrice', 'Please enter a valid price');
        itemPriceInput.focus();
        return;
      }

      if (itemPrice <= 0) {
        this.showModalError('item', 'itemPrice', 'Price must be greater than 0');
        itemPriceInput.focus();
        return;
      }

      if (itemPrice > 1000000.00) {
        this.showModalError('item', 'itemPrice', 'Price cannot exceed $1,000,000');
        itemPriceInput.focus();
        return;
      }

      const bill = this.calculator.getBill(this.currentBillId);
      const existingItem = bill?.items.find(candidate => candidate.id === this.editingItemId);
      if (!existingItem) {
        this.closeItemModal();
        return;
      }

      if (itemName === existingItem.name && Math.abs(itemPrice - existingItem.price) < 0.000001) {
        this.closeItemModal();
        return;
      }

      addButton.classList.add('loading');
      addButton.disabled = true;

      this.recordHistorySnapshot();
      const updated = this.calculator.updateItem(this.currentBillId, this.editingItemId, itemName, itemPrice);
      if (!updated) {
        addButton.classList.remove('loading');
        addButton.disabled = false;
        this.showModalError('item', 'itemName', 'Unable to update the item. Please try again.');
        itemNameInput.focus();
        return;
      }

      this.closeItemModal();
      this.updateSummaryTable();
      this.saveDraftState();
      this.showToast(`Updated ${itemName}`);

      addButton.classList.remove('loading');
      addButton.disabled = false;
      return;
    }
    
    let hasErrors = false;
    
    if (!hasSingleInput && bulkResult.items.length === 0) {
      this.showModalError('item', 'itemName', 'Enter one item or paste multiple lines');
      itemNameInput.focus();
      return;
    }

    if (hasSingleInput) {
      if (!itemName) {
        this.showModalError('item', 'itemName', 'Please enter an item name');
        hasErrors = true;
      } else if (itemName.length < 1) {
        this.showModalError('item', 'itemName', 'Item name cannot be empty');
        hasErrors = true;
      }
      
      if (!itemPriceInput.value || isNaN(itemPrice)) {
        this.showModalError('item', 'itemPrice', 'Please enter a valid price');
        hasErrors = true;
      } else if (itemPrice <= 0) {
        this.showModalError('item', 'itemPrice', 'Price must be greater than 0');
        hasErrors = true;
      } else if (itemPrice > 1000000.00) {
        this.showModalError('item', 'itemPrice', 'Price cannot exceed $1,000,000');
        hasErrors = true;
      }

      if (!hasErrors) {
        itemEntries.push({ name: itemName, price: itemPrice });
      }
    }

    if (bulkResult.invalidLines.length > 0) {
      this.showModalError('item', 'itemBulk', `Invalid lines: ${bulkResult.invalidLines.join(' | ')}`);
      hasErrors = true;
    }

    itemEntries.push(...bulkResult.items);

    if (hasErrors) {
      if (document.getElementById('itemNameError')!.textContent) {
        itemNameInput.focus();
      } else if (document.getElementById('itemPriceError')!.textContent) {
        itemPriceInput.focus();
      } else {
        bulkItemsInput.focus();
      }
      return;
    }

    // Show loading state
    addButton.classList.add('loading');
    addButton.disabled = true;

    this.recordHistorySnapshot();
    this.calculator.addItems(this.currentBillId, itemEntries);
    this.closeItemModal();
    this.updateSummaryTable();
    this.saveDraftState();
    this.showToast(`Added ${itemEntries.length} ${itemEntries.length === 1 ? 'item' : 'items'}`);
    
    // Remove loading state
    addButton.classList.remove('loading');
    addButton.disabled = false;
  }

  private parsePersonEntries(singleValue: string, bulkValue: string): { names: string[]; invalidNames: string[]; duplicateNames: string[] } {
    const rawEntries = [
      ...singleValue.split(','),
      ...bulkValue.split(/[\n,]+/)
    ];
    const names: string[] = [];
    const invalidNames: string[] = [];
    const duplicateNames: string[] = [];
    const seenNames = new Set<string>();

    rawEntries.forEach(rawEntry => {
      const normalizedName = rawEntry.trim().replace(/\s+/g, ' ');
      if (!normalizedName) return;

      if (normalizedName.length < 1) {
        invalidNames.push(normalizedName);
        return;
      }

      const duplicateKey = normalizedName.toLowerCase();
      if (seenNames.has(duplicateKey)) {
        duplicateNames.push(normalizedName);
        return;
      }

      seenNames.add(duplicateKey);
      names.push(normalizedName);
    });

    return { names, invalidNames, duplicateNames };
  }

  private parseBulkItemEntries(rawValue: string): { items: Array<{ name: string; price: number }>; invalidLines: string[] } {
    const items: Array<{ name: string; price: number }> = [];
    const invalidLines: string[] = [];

    rawValue
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .forEach(line => {
        const separatorIndex = line.lastIndexOf(',');
        if (separatorIndex === -1) {
          invalidLines.push(line);
          return;
        }

        const parsedName = line.slice(0, separatorIndex).trim().replace(/\s+/g, ' ');
        const priceText = line.slice(separatorIndex + 1).trim().replace(/^\$/, '');
        const parsedPrice = parseFloat(priceText);

        if (!parsedName || parsedName.length < 1 || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || parsedPrice > 1000000.00) {
          invalidLines.push(line);
          return;
        }

        items.push({ name: parsedName, price: parsedPrice });
      });

    return { items, invalidLines };
  }

  private updatePersonPreview(): void {
    const previewElement = document.getElementById('personPreview');
    const personNameInput = document.getElementById('modalPersonName') as HTMLInputElement | null;
    const bulkPersonInput = document.getElementById('modalPersonNames') as HTMLTextAreaElement | null;
    if (!previewElement || !personNameInput || !bulkPersonInput) return;

    const isEditingPerson = this.editingPersonId !== null;
    const personEntries = isEditingPerson
      ? { names: personNameInput.value.trim() ? [personNameInput.value.trim()] : [], invalidNames: [] as string[], duplicateNames: [] as string[] }
      : this.parsePersonEntries(personNameInput.value, bulkPersonInput.value);
    const bill = this.currentBillId ? this.calculator.getBill(this.currentBillId) : undefined;
    const existingNames = personEntries.names.filter(name =>
      bill?.persons.some(person => person.id !== this.editingPersonId && person.name.toLowerCase() === name.toLowerCase())
    );
    const readyCount = Math.max(personEntries.names.length - existingNames.length, 0);

    if (!personNameInput.value.trim() && !bulkPersonInput.value.trim()) {
      previewElement.style.display = 'none';
      previewElement.innerHTML = '';
      this.updateModalSubmitState('person', false);
      return;
    }

    const previewLines = [`<strong>Preview</strong>`];
  previewLines.push(`<div class="modal-preview-summary">${isEditingPerson ? `Ready to save: ${readyCount} person` : `Ready to add: ${readyCount} person(s)`}</div>`);

    if (personEntries.invalidNames.length > 0) {
      previewLines.push(`<div class="modal-preview-warning">Empty names are not allowed: ${personEntries.invalidNames.join(', ')}</div>`);
    }

    if (personEntries.duplicateNames.length > 0) {
      previewLines.push(`<div class="modal-preview-warning">Duplicate in batch: ${personEntries.duplicateNames.join(', ')}</div>`);
    }

    if (existingNames.length > 0) {
      previewLines.push(`<div class="modal-preview-warning">Already in bill: ${existingNames.join(', ')}</div>`);
    }

    previewElement.innerHTML = previewLines.join('');
    previewElement.style.display = 'block';
    this.updateModalSubmitState('person', readyCount > 0);
  }

  private updateItemPreview(): void {
    const previewElement = document.getElementById('itemPreview');
    const itemNameInput = document.getElementById('modalItemName') as HTMLInputElement | null;
    const itemPriceInput = document.getElementById('modalItemPrice') as HTMLInputElement | null;
    const bulkItemsInput = document.getElementById('modalBulkItems') as HTMLTextAreaElement | null;
    if (!previewElement || !itemNameInput || !itemPriceInput || !bulkItemsInput) return;

    const isEditingItem = this.editingItemId !== null;
    const bulkResult = isEditingItem ? { items: [], invalidLines: [] as string[] } : this.parseBulkItemEntries(bulkItemsInput.value);
    const itemEntriesCount = bulkResult.items.length;
    const hasSingleInput = itemNameInput.value.trim().length > 0 || itemPriceInput.value.trim().length > 0;
    const singleItemIssues: string[] = [];
    let singleItemReady = 0;

    if (hasSingleInput) {
      const itemName = itemNameInput.value.trim();
      const itemPrice = parseFloat(itemPriceInput.value);

      if (!itemName) {
        singleItemIssues.push('Single item is missing a name');
      } else if (itemName.length < 1) {
        singleItemIssues.push('Single item name cannot be empty');
      }

      if (!itemPriceInput.value || isNaN(itemPrice)) {
        singleItemIssues.push('Single item is missing a valid price');
      } else if (itemPrice <= 0 || itemPrice > 1000000.00) {
        singleItemIssues.push(`Single item price is out of range: ${itemPriceInput.value}`);
      }

      if (singleItemIssues.length === 0) {
        singleItemReady = 1;
      }
    }

    if (!hasSingleInput && !bulkItemsInput.value.trim()) {
      previewElement.style.display = 'none';
      previewElement.innerHTML = '';
      this.updateModalSubmitState('item', false);
      return;
    }

    const previewLines = [`<strong>Preview</strong>`];
    const readyCount = singleItemReady + itemEntriesCount;
    previewLines.push(`<div class="modal-preview-summary">${isEditingItem ? `Ready to save: ${readyCount} item` : `Ready to add: ${readyCount} item(s)`}</div>`);

    if (singleItemIssues.length > 0) {
      previewLines.push(`<div class="modal-preview-warning">${singleItemIssues.join(' | ')}</div>`);
    }

    if (bulkResult.invalidLines.length > 0) {
      previewLines.push(`<div class="modal-preview-warning">Invalid rows: ${bulkResult.invalidLines.join(' | ')}</div>`);
    }

    previewElement.innerHTML = previewLines.join('');
    previewElement.style.display = 'block';
    this.updateModalSubmitState('item', readyCount > 0);
  }

  private updateModalSubmitState(modalType: 'person' | 'item', hasValidEntries: boolean): void {
    const buttonId = modalType === 'person' ? 'addPersonSubmitBtn' : 'addItemSubmitBtn';
    const button = document.getElementById(buttonId) as HTMLButtonElement | null;
    if (!button || button.classList.contains('loading')) return;
    button.disabled = !hasValidEntries;
  }

  private clearModalErrors(modalType: 'person' | 'item'): void {
    if (modalType === 'person') {
      const errorElement = document.getElementById('personNameError');
      const bulkErrorElement = document.getElementById('personBulkError');
      if (errorElement) {
        errorElement.style.display = 'none';
        errorElement.textContent = '';
      }
      if (bulkErrorElement) {
        bulkErrorElement.style.display = 'none';
        bulkErrorElement.textContent = '';
      }
      const input = document.getElementById('modalPersonName') as HTMLInputElement;
      const bulkInput = document.getElementById('modalPersonNames') as HTMLTextAreaElement;
      if (input) input.classList.remove('error');
      if (bulkInput) bulkInput.classList.remove('error');
    } else {
      const nameError = document.getElementById('itemNameError');
      const priceError = document.getElementById('itemPriceError');
      const bulkError = document.getElementById('itemBulkError');
      
      if (nameError) {
        nameError.style.display = 'none';
        nameError.textContent = '';
      }
      if (priceError) {
        priceError.style.display = 'none';
        priceError.textContent = '';
      }
      if (bulkError) {
        bulkError.style.display = 'none';
        bulkError.textContent = '';
      }
      
      const nameInput = document.getElementById('modalItemName') as HTMLInputElement;
      const priceInput = document.getElementById('modalItemPrice') as HTMLInputElement;
      const bulkInput = document.getElementById('modalBulkItems') as HTMLTextAreaElement;
      
      if (nameInput) nameInput.classList.remove('error');
      if (priceInput) priceInput.classList.remove('error');
      if (bulkInput) bulkInput.classList.remove('error');
    }
  }

  private showModalError(modalType: 'person' | 'item', field: string, message: string): void {
    if (modalType === 'person') {
      const isBulkField = field === 'personBulk';
      const errorElement = document.getElementById(isBulkField ? 'personBulkError' : 'personNameError');
      const input = document.getElementById(isBulkField ? 'modalPersonNames' : 'modalPersonName') as HTMLInputElement | HTMLTextAreaElement;
      
      if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
      }
      if (input) input.classList.add('error');
    } else {
      const errorElementId = field === 'itemName' ? 'itemNameError' : field === 'itemPrice' ? 'itemPriceError' : 'itemBulkError';
      const inputId = field === 'itemName' ? 'modalItemName' : field === 'itemPrice' ? 'modalItemPrice' : 'modalBulkItems';
      const errorElement = document.getElementById(errorElementId);
      const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement;
      
      if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
      }
      if (input) input.classList.add('error');
    }
  }


  addItem(): void {
    // This method is kept for backward compatibility but now redirects to modal
    this.showItemModal();
  }

  toggleDividerFromTable(itemId: string, personId: string): void {
    if (!this.currentBillId) return;

    this.recordHistorySnapshot();
    this.calculator.togglePersonAsDivider(this.currentBillId, itemId, personId);
    this.updateSummaryTable(`checkbox_${personId}_${itemId}`);
    this.saveDraftState();
  }

  removePerson(personId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const person = bill?.persons.find(p => p.id === personId);
    
    if (confirm(`Remove "${person?.name}" from this bill?`)) {
      this.recordHistorySnapshot();
      this.calculator.removePerson(this.currentBillId, personId);
      this.updateSummaryTable();
      this.saveDraftState();
      this.showToast(`Removed ${person?.name || 'person'}`);
    }
  }

  editPerson(personId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const person = bill?.persons.find(existingPerson => existingPerson.id === personId);
    if (!bill || !person) return;

    const modal = document.getElementById('personInputModal')!;
    const title = document.getElementById('personModalTitle');
    const nameHint = document.getElementById('personNameHint');
    const input = document.getElementById('modalPersonName') as HTMLInputElement;
    const bulkInput = document.getElementById('modalPersonNames') as HTMLTextAreaElement;
    const bulkGroup = document.getElementById('personBulkGroup');
    const submitButton = document.getElementById('addPersonSubmitBtn') as HTMLButtonElement;
    const submitButtonLabel = document.getElementById('personSubmitButtonLabel');

    this.editingPersonId = personId;
    if (title) title.textContent = 'Edit Person';
    if (nameHint) nameHint.textContent = 'Update the name used in this bill.';
    if (bulkGroup) bulkGroup.style.display = 'none';
    if (submitButtonLabel) submitButtonLabel.textContent = 'Save Changes';

    input.value = person.name;
    bulkInput.value = '';
    this.clearModalErrors('person');
    this.updatePersonPreview();
    submitButton.disabled = false;

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      input.focus();
      input.select();
    }, 150);
  }

  removeItem(itemId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const item = bill?.items.find(i => i.id === itemId);
    
    if (confirm(`Remove "${item?.name}" ($${item?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) from this bill?`)) {
      this.recordHistorySnapshot();
      this.calculator.removeItem(this.currentBillId, itemId);
      this.updateSummaryTable();
      this.saveDraftState();
      this.showToast(`Removed ${item?.name || 'item'}`);
    }
  }

  editItem(itemId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const item = bill?.items.find(existingItem => existingItem.id === itemId);
    if (!bill || !item) return;

    const modal = document.getElementById('itemInputModal')!;
    const title = document.getElementById('itemModalTitle');
    const nameHint = document.getElementById('itemNameHint');
    const priceHint = document.getElementById('itemPriceHint');
    const nameInput = document.getElementById('modalItemName') as HTMLInputElement;
    const priceInput = document.getElementById('modalItemPrice') as HTMLInputElement;
    const bulkInput = document.getElementById('modalBulkItems') as HTMLTextAreaElement;
    const bulkGroup = document.getElementById('itemBulkGroup');
    const submitButton = document.getElementById('addItemSubmitBtn') as HTMLButtonElement;
    const submitButtonLabel = document.getElementById('itemSubmitButtonLabel');

    this.editingItemId = itemId;
    if (title) title.textContent = 'Edit Item';
    if (nameHint) nameHint.textContent = 'Update the item name for this bill.';
    if (priceHint) priceHint.textContent = 'Update the full price for this item.';
    if (bulkGroup) bulkGroup.style.display = 'none';
    if (submitButtonLabel) submitButtonLabel.textContent = 'Save Changes';

    nameInput.value = item.name;
    priceInput.value = item.price.toFixed(2);
    bulkInput.value = '';
    this.clearModalErrors('item');
    this.updateItemPreview();
    submitButton.disabled = false;

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      nameInput.focus();
      nameInput.select();
    }, 150);
  }

  private updateBillsList(): void {
    const billsList = document.getElementById('billsList')!;
    const bills = this.calculator.getBills();
    this.updateBillTransferActionState();
    
    if (bills.length === 0) {
      billsList.innerHTML = '<div class="empty-state">No bills created yet. Create your first bill above!</div>';
      return;
    }

    billsList.innerHTML = bills.map(bill => {
      const totalAmount = this.calculator.calculateBillSummary(bill.id)
        .reduce((sum, summary) => sum + summary.totalAmount, 0);
      const { unassignedItemsTotal } = this.calculateBillChargeTotals(bill);
      
      return `
        <div class="bill-item ${bill.id === this.currentBillId ? 'active' : ''}">
          <div class="bill-item-content" onclick="billUI.selectBill('${bill.id}')">
            <div class="bill-item-title">${bill.name}</div>
            <div class="bill-item-stats" style="color: ${bill.id === this.currentBillId ? '#ffffff' : 'var(--text-secondary)'};">
              👥 ${bill.persons.length} person(s)<br>
              🧾 ${bill.items.length} item(s)<br>
              💰 Split total: $${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br>
              ⏳ Unassigned: $${unassignedItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div class="bill-item-actions">
            <button class="bill-edit-btn" onclick="event.stopPropagation(); billUI.editBill('${bill.id}')">
              Edit
            </button>
            <button class="bill-delete-btn" onclick="event.stopPropagation(); billUI.deleteBill('${bill.id}')">
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  private extractBillsFromTransferPayload(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const record = payload as { bills?: unknown; bill?: unknown };
    if (Array.isArray(record.bills)) {
      return record.bills;
    }

    if (record.bill) {
      return [record.bill];
    }

    return [];
  }

  private extractPreferredBillIdFromTransferPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const record = payload as { currentBillId?: unknown };
    return typeof record.currentBillId === 'string' ? record.currentBillId : null;
  }

  private createBillTransferPayload(exportType: 'single-bill' | 'bill-list', bills: Bill[], currentBillId: string | null): BillTransferFile {
    return {
      version: 1,
      source: 'bill-calculator',
      exportType,
      exportedAt: new Date().toISOString(),
      currentBillId,
      bills
    };
  }

  private downloadBillTransferFile(payload: BillTransferFile, fileName: string): void {
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private async importBillsFromFile(file: File, importMode: BillImportMode): Promise<void> {
    const rawContent = await file.text();
    const parsedPayload = JSON.parse(rawContent) as unknown;
    const extractedBills = this.extractBillsFromTransferPayload(parsedPayload);
    const importAnalysis = this.calculator.analyzeBillImport(extractedBills);
    const importedBills = importAnalysis.sanitizedBills;

    if (importedBills.length === 0) {
      alert('No valid bills were found in that file. Please use a Bill Calculator JSON export.');
      return;
    }

    const preview = this.buildBillImportPreview(
      importAnalysis,
      importMode,
      file.name,
      this.extractPreferredBillIdFromTransferPayload(parsedPayload)
    );

    this.showBillImportPreviewModal(preview);
  }

  private buildBillImportPreview(
    importAnalysis: ReturnType<BillCalculator['analyzeBillImport']>,
    importMode: BillImportMode,
    sourceName: string,
    preferredImportedBillId: string | null
  ): PendingBillImportPreview {
    const importedBills = importAnalysis.sanitizedBills;
    const currentBillCount = this.calculator.getBills().length;

    if (importMode === 'replace') {
      return {
        sourceName,
        importMode,
        preferredImportedBillId,
        preparedBills: importedBills,
        currentBillCount,
        ignoredBillCount: importAnalysis.ignoredBillCount,
        entries: importAnalysis.reports.map(report => ({
          billId: report.bill.id,
          originalName: report.bill.name,
          finalName: report.bill.name,
          personsCount: report.bill.persons.length,
          itemsCount: report.bill.items.length,
          renamed: false,
          regeneratedId: false,
          invalidPersonsDropped: report.invalidPersonsDropped,
          invalidItemsDropped: report.invalidItemsDropped,
          invalidDividerReferencesRemoved: report.invalidDividerReferencesRemoved,
          selected: true
        }))
      };
    }

    const existingBills = this.calculator.exportBills();
    const existingBillIds = new Set(existingBills.map(bill => bill.id));
    const existingBillNames = new Set(existingBills.map(bill => bill.name.toLowerCase()));
    const entries: BillImportPreviewEntry[] = [];
    const preparedBills = importAnalysis.reports.map(report => {
      const preparedBill = this.prepareImportedBillForMerge(report.bill, existingBillIds, existingBillNames);
      entries.push({
        billId: preparedBill.id,
        originalName: report.bill.name,
        finalName: preparedBill.name,
        personsCount: preparedBill.persons.length,
        itemsCount: preparedBill.items.length,
        renamed: preparedBill.name !== report.bill.name,
        regeneratedId: preparedBill.id !== report.bill.id,
        invalidPersonsDropped: report.invalidPersonsDropped,
        invalidItemsDropped: report.invalidItemsDropped,
        invalidDividerReferencesRemoved: report.invalidDividerReferencesRemoved,
        selected: true
      });
      return preparedBill;
    });

    return {
      sourceName,
      importMode,
      preferredImportedBillId,
      preparedBills,
      entries,
      currentBillCount,
      ignoredBillCount: importAnalysis.ignoredBillCount
    };
  }

  private applyImportedBillsAsReplacement(importedBills: Bill[], preferredBillId: string | null, sourceName: string): void {
    this.calculator.loadBills(importedBills);
    this.updateBillsList();

    const selectedBillId = preferredBillId && this.calculator.getBill(preferredBillId)
      ? preferredBillId
      : importedBills[0]?.id || null;

    if (selectedBillId) {
      this.selectBill(selectedBillId);
    } else {
      this.resetCurrentBillView();
      this.updateBillsList();
      this.saveDraftState();
    }

    this.showToast(`Replaced current bills with ${importedBills.length} ${importedBills.length === 1 ? 'bill' : 'bills'} from ${sourceName}`);
  }

  private applyImportedBillsAsMerge(importedBills: Bill[], sourceName: string, billsArePrepared = false): void {
    const existingBills = this.calculator.exportBills();
    const preparedImportedBills = billsArePrepared
      ? importedBills
      : (() => {
          const existingBillIds = new Set(existingBills.map(existingBill => existingBill.id));
          const existingBillNames = new Set(existingBills.map(existingBill => existingBill.name.toLowerCase()));
          return importedBills.map(bill => this.prepareImportedBillForMerge(bill, existingBillIds, existingBillNames));
        })();

    this.calculator.loadBills([...existingBills, ...preparedImportedBills]);
    this.updateBillsList();

    if (preparedImportedBills[0]) {
      this.selectBill(preparedImportedBills[0].id);
    } else {
      this.saveDraftState();
    }

    this.showToast(`Imported ${preparedImportedBills.length} ${preparedImportedBills.length === 1 ? 'bill' : 'bills'} from ${sourceName}`);
  }

  private prepareImportedBillForMerge(bill: Bill, existingBillIds: Set<string>, existingBillNames: Set<string>): Bill {
    let nextBillId = bill.id;
    while (existingBillIds.has(nextBillId)) {
      nextBillId = this.generateTransferId();
    }
    existingBillIds.add(nextBillId);

    const nextBillName = this.getUniqueImportedBillName(bill.name, existingBillNames);
    existingBillNames.add(nextBillName.toLowerCase());

    return {
      ...bill,
      id: nextBillId,
      name: nextBillName
    };
  }

  private getUniqueImportedBillName(baseName: string, existingBillNames: Set<string>): string {
    const normalizedBaseName = baseName.trim() || 'Imported Bill';
    if (!existingBillNames.has(normalizedBaseName.toLowerCase())) {
      return normalizedBaseName;
    }

    let attempt = `${normalizedBaseName} (Imported)`;
    let suffix = 2;
    while (existingBillNames.has(attempt.toLowerCase())) {
      attempt = `${normalizedBaseName} (Imported ${suffix})`;
      suffix += 1;
    }

    return attempt;
  }

  private createDownloadSafeName(value: string): string {
    return value
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      || 'bill';
  }

  private generateTransferId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2, 11);
  }

  toggleUnassignedItemsFilter(): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    if (!bill) return;

    const hasUnassignedItems = bill.items.some(item => item.dividers.length === 0);
    if (!hasUnassignedItems) {
      this.showOnlyUnassignedItems = false;
      this.updateSummaryTable();
      this.showToast('No unassigned items to filter');
      return;
    }

    this.showOnlyUnassignedItems = !this.showOnlyUnassignedItems;
    this.updateSummaryTable();
    this.showToast(this.showOnlyUnassignedItems ? 'Showing unassigned items only' : 'Showing all items');
  }

  assignAllUnassignedItems(): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    if (!bill) return;

    if (bill.persons.length === 0) {
      this.showToast('Add people before assigning unassigned items');
      return;
    }

    const unassignedItems = bill.items.filter(item => item.dividers.length === 0);
    if (unassignedItems.length === 0) {
      this.showToast('No unassigned items to assign');
      return;
    }

    const confirmed = confirm(`Assign ${unassignedItems.length} unassigned item(s) to all ${bill.persons.length} people in this bill?`);
    if (!confirmed) {
      return;
    }

    this.recordHistorySnapshot();
    unassignedItems.forEach(item => {
      bill.persons.forEach(person => {
        this.calculator.togglePersonAsDivider(this.currentBillId!, item.id, person.id);
      });
    });

    this.showOnlyUnassignedItems = false;
    this.updateSummaryTable();
    this.saveDraftState();
    this.showToast(`Assigned ${unassignedItems.length} item(s) to everyone`);
  }

  assignItemToAllPeople(itemId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const item = bill?.items.find(existingItem => existingItem.id === itemId);
    if (!bill || !item) return;

    const allPersonIds = bill.persons.map(person => person.id);
    const alreadyAssignedToAll = allPersonIds.length > 0
      && allPersonIds.every(personId => item.dividers.includes(personId))
      && item.dividers.length === allPersonIds.length;
    if (allPersonIds.length === 0) {
      this.showToast('Add people before assigning this item');
      return;
    }
    if (alreadyAssignedToAll) {
      this.showToast(`${item.name} is already assigned to everyone`);
      return;
    }

    this.recordHistorySnapshot();
    this.calculator.setItemDividers(this.currentBillId, itemId, allPersonIds);
    this.updateSummaryTable();
    this.saveDraftState();
    this.showToast(`${item.name} assigned to everyone`);
  }

  clearItemAssignments(itemId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const item = bill?.items.find(existingItem => existingItem.id === itemId);
    if (!bill || !item) return;
    if (item.dividers.length === 0) {
      this.showToast(`${item.name} is already unassigned`);
      return;
    }

    this.recordHistorySnapshot();
    this.calculator.setItemDividers(this.currentBillId, itemId, []);
    this.updateSummaryTable();
    this.saveDraftState();
    this.showToast(`${item.name} assignments cleared`);
  }

  private updateSummaryTable(focusElementId?: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    if (bill && this.showOnlyUnassignedItems && !bill.items.some(item => item.dividers.length === 0)) {
      this.showOnlyUnassignedItems = false;
    }
    const preservedScrollLeft = this.getSummaryTableScrollLeft();
    const preservedWindowScrollY = window.scrollY;
    const summaryTable = document.getElementById('summaryTable')!;
    const toggleUnassignedFilterBtn = document.getElementById('toggleUnassignedFilterBtn') as HTMLButtonElement | null;
    const assignAllUnassignedBtn = document.getElementById('assignAllUnassignedBtn') as HTMLButtonElement | null;
    const addPersonBtn = document.getElementById('addPersonBtn')!;
    const addItemBtn = document.getElementById('addItemBtn')!;
    const exportBtn = document.getElementById('exportBtn')!;
    const exportPdfBtn = document.getElementById('exportPdfBtn')!;
    const exportCsvBtn = document.getElementById('exportCsvBtn')!;
    
    if (!bill) {
      summaryTable.innerHTML = '<div class="no-data-message">Bill not found.</div>';
      if (toggleUnassignedFilterBtn) toggleUnassignedFilterBtn.style.display = 'none';
      if (assignAllUnassignedBtn) assignAllUnassignedBtn.style.display = 'none';
      addPersonBtn.style.display = 'none';
      addItemBtn.style.display = 'none';
      exportBtn.style.display = 'none';
      exportPdfBtn.style.display = 'none';
      exportCsvBtn.style.display = 'none';
      return;
    }

    const unassignedItems = bill.items.filter(item => item.dividers.length === 0);
    const visibleItems = this.showOnlyUnassignedItems ? unassignedItems : bill.items;

    // Always show all buttons when bill is selected
    if (toggleUnassignedFilterBtn) {
      toggleUnassignedFilterBtn.style.display = bill.items.length > 0 ? 'inline-flex' : 'none';
      toggleUnassignedFilterBtn.textContent = this.showOnlyUnassignedItems ? 'Show All Items' : 'Show Unassigned Only';
      toggleUnassignedFilterBtn.disabled = unassignedItems.length === 0;
    }
    if (assignAllUnassignedBtn) {
      assignAllUnassignedBtn.style.display = bill.items.length > 0 ? 'inline-flex' : 'none';
      assignAllUnassignedBtn.disabled = bill.persons.length === 0 || unassignedItems.length === 0;
    }
    addPersonBtn.style.display = 'inline-block';
    addItemBtn.style.display = 'inline-block';

    const overviewMarkup = this.renderBillOverview(bill);
    const unassignedWarningMarkup = this.renderUnassignedWarning(bill);

    // if (bill.items.length === 0) {
    //   summaryTable.innerHTML = `
    //     <div class="no-data-message">
    //       No items to split yet. Add items first to see the payment summary.
    //     </div>
    //   `;
    //   exportBtn.style.display = 'none';
    //   return;
    // }

    // If no persons, show special message with add person option
    if (bill.persons.length === 0) {
      summaryTable.innerHTML = `
        ${overviewMarkup}
        ${unassignedWarningMarkup}
        ${this.renderEmptyWorkflowState(
          'Start by adding people',
          'This bill is ready, but there is nobody to split it with yet.',
          ['Add the people joining this bill', 'Add your bill items', 'Check who shares each item cost']
        )}
      `;
      exportBtn.style.display = 'none';
      exportPdfBtn.style.display = 'none';
      exportCsvBtn.style.display = 'none';
      return;
    }

    if (bill.items.length === 0) {
      summaryTable.innerHTML = `
        ${overviewMarkup}
        ${unassignedWarningMarkup}
        ${this.renderEmptyWorkflowState(
          'Add items to calculate totals',
          'People are ready. Add food, drinks, fees, or any shared cost to begin splitting.',
          ['Add one or many items', 'Assign who shares each item', 'Review totals in the summary table']
        )}
      `;
      exportBtn.style.display = 'none';
      exportPdfBtn.style.display = 'none';
      exportCsvBtn.style.display = 'none';
      return;
    }

    // Show export button when table has data
    exportBtn.style.display = 'inline-block';
    exportPdfBtn.style.display = 'inline-block';
    exportCsvBtn.style.display = 'inline-block';

    const { matrix, itemTotals, personTotals, grandTotal } = this.calculateSummaryMatrix(bill);
    const chargesMarkup = this.renderChargeControls(bill);
    const settlementMarkup = this.renderSettlementCard(bill, personTotals);

    summaryTable.innerHTML = `
      ${overviewMarkup}
      ${unassignedWarningMarkup}
      ${chargesMarkup}
      <div class="summary-table-container">
        <div class="summary-table-header-shell">
          <div class="summary-table-fixed summary-table-header-fixed">
            <div class="summary-header-fixed-cell">Person</div>
          </div>
          <div class="summary-table-header-scroll">
            <div class="summary-table-header-track">
              ${visibleItems.map((item, index) => {
                const allAssigned = bill.persons.length > 0
                  && bill.persons.every(person => item.dividers.includes(person.id))
                  && item.dividers.length === bill.persons.length;

                return `
                  <div class="summary-table-header-cell ${item.dividers.length === 0 ? 'is-unassigned' : ''}" data-col-index="${index + 1}">
                    <div class="summary-header-cell-content">
                      <div class="summary-header-meta">
                        ${item.name}<br>
                        <small style="font-weight: normal; color: var(--text-secondary);">($${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</small><br>
                        <small style="font-weight: normal; color: var(--text-secondary);">${item.dividers.length} ${item.dividers.length === 1 ? 'person' : 'people'}</small>
                        ${item.dividers.length === 0 ? '<div class="summary-table-header-badge">Unassigned</div>' : ''}
                      </div>
                      <div class="item-header-actions">
                          <button class="item-action-btn item-action-edit" onclick="billUI.editItem('${item.id}')" title="Edit ${item.name}">
                            Edit
                          </button>
                        <button class="item-action-btn item-action-select" onclick="billUI.showItemAssignmentModal('${item.id}')" title="Select people for ${item.name}">
                          Select
                        </button>
                        <button class="item-action-btn item-action-assign" onclick="billUI.assignItemToAllPeople('${item.id}')" title="Assign ${item.name} to everyone" ${allAssigned ? 'disabled' : ''}>
                          All
                        </button>
                        <button class="item-action-btn item-action-clear" onclick="billUI.clearItemAssignments('${item.id}')" title="Clear everyone from ${item.name}" ${item.dividers.length === 0 ? 'disabled' : ''}>
                          Clear
                        </button>
                        <button class="item-delete-btn" onclick="billUI.removeItem('${item.id}')" title="Delete ${item.name}">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
              <div class="summary-table-header-cell total-header-cell" data-col-index="${visibleItems.length + 1}">Total</div>
            </div>
          </div>
        </div>
        <div class="summary-table-body-shell">
          <div class="summary-table-fixed summary-table-body-fixed">
            <table>
              <tbody>
                ${bill.persons.map((person, index) => `
                  <tr data-row-index="person-${index}">
                    <td class="person-cell">
                      <div class="person-row-cell">
                        <span class="person-name">${person.name}</span>
                        <div class="person-actions">
                          <button class="person-edit-btn" onclick="billUI.editPerson('${person.id}')">
                            Edit
                          </button>
                          <button class="person-delete-btn" onclick="billUI.removePerson('${person.id}')">
                            Delete
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                `).join('')}
                <tr class="total-row" data-row-index="total">
                  <td class="person-cell">
                    <div class="person-row-cell" style="background-color: var(--table-total-bg) !important;">
                      <span class="person-name" style="color: var(--table-total-text);">Total</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="summary-table-scroll summary-table-body-scroll">
            <table>
              <tbody>
                ${bill.persons.map((person, index) => `
                  <tr data-row-index="person-${index}">
                    ${visibleItems.map((item, index) => {
                      const amount = matrix[person.id][item.id];
                      const isChecked = item.dividers.includes(person.id);
                      const isUnassignedColumn = item.dividers.length === 0;

                      return `
                        <td class="checkbox-cell ${isUnassignedColumn ? 'is-unassigned-column' : ''}" data-col-index="${index + 1}">
                          <div class="checkbox-cell-content">
                            <input type="checkbox"
                                   class="divider-checkbox"
                                   ${isChecked ? 'checked' : ''}
                                   onchange="billUI.toggleDividerFromTable('${item.id}', '${person.id}')"
                                   id="checkbox_${person.id}_${item.id}">
                            <small style="color: ${amount > 0 ? 'var(--btn-success)' : 'var(--text-secondary)'}; font-weight: ${amount > 0 ? '600' : 'normal'};">
                              ${amount > 0 ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                            </small>
                          </div>
                        </td>
                      `;
                    }).join('')}
                    <td class="total-column" data-col-index="${visibleItems.length + 1}">$${personTotals[person.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
                <tr class="total-row" data-row-index="total">
                  ${visibleItems.map((item, index) => `
                    <td class="total-column" data-col-index="${index + 1}">$${itemTotals[item.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  `).join('')}
                  <td class="total-column" data-col-index="${visibleItems.length + 1}">$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ${settlementMarkup}
      ${this.renderMobileSummaryCards(bill, personTotals)}
    `;

    this.attachSummaryTableScrollSync();
    this.attachSummaryTableHoverEffects();
    window.requestAnimationFrame(() => {
      this.syncSummaryFixedColumnWidth();
      this.restoreSummaryTableScrollLeft(preservedScrollLeft);
      this.syncSummaryTableRowHeights();
      this.restoreSummaryTableScrollLeft(preservedScrollLeft);
      if (focusElementId) {
        const focusTarget = document.getElementById(focusElementId) as HTMLInputElement | null;
        focusTarget?.focus({ preventScroll: true });
      }
      window.scrollTo({ top: preservedWindowScrollY, behavior: 'auto' });
    });

  }

  private async generateExportCanvas(): Promise<{ canvas: HTMLCanvasElement; bill: Bill } | null> {
    if (!this.currentBillId) return null;

    const bill = this.calculator.getBill(this.currentBillId);
    if (!bill || bill.items.length === 0 || bill.persons.length === 0) {
      alert('No data to export. Please add items and people first.');
      return null;
    }

    const summaryRoot = document.getElementById('summaryTable');
    const summaryContainer = summaryRoot?.querySelector('.summary-table-container') as HTMLElement | null;
    const headerFixed = summaryContainer?.querySelector('.summary-table-header-fixed') as HTMLElement | null;
    const bodyScroll = summaryContainer?.querySelector('.summary-table-body-scroll') as HTMLElement | null;
    const sourceBodyRow = summaryRoot?.querySelector('.summary-table-body-scroll tr[data-row-index^="person-"]') as HTMLTableRowElement | null
      || summaryRoot?.querySelector('.summary-table-body-scroll tr[data-row-index="total"]') as HTMLTableRowElement | null;

    if (!summaryRoot || !summaryContainer || !headerFixed || !bodyScroll) {
      alert('Summary table is not ready to export. Please try again.');
      return null;
    }

    const fixedWidth = Math.ceil(headerFixed.offsetWidth);
    const sourceBodyColumnWidths = sourceBodyRow
      ? Array.from(sourceBodyRow.querySelectorAll<HTMLElement>('[data-col-index]')).map(cell => Math.ceil(cell.getBoundingClientRect().width))
      : [];
    const sourceHeaderCellWidths = Array.from(summaryRoot.querySelectorAll<HTMLElement>('.summary-table-header-cell')).map(cell => Math.ceil(cell.getBoundingClientRect().width));
    const resolvedColumnWidths = sourceBodyColumnWidths.length === sourceHeaderCellWidths.length && sourceBodyColumnWidths.length > 0
      ? sourceBodyColumnWidths
      : sourceHeaderCellWidths;
    const resolvedScrollWidth = resolvedColumnWidths.reduce((sum, width) => sum + width, 0);
    const scrollWidth = Math.max(Math.ceil(bodyScroll.scrollWidth), resolvedScrollWidth);
    const totalSummaryWidth = fixedWidth + scrollWidth;
    const { matrix, itemTotals, personTotals, subtotal, subtotalAfterService, taxAmount, serviceAmount, tipAmount, grandTotal } = this.calculateSummaryMatrix(bill);
    const { unassignedItemsTotal } = this.calculateBillChargeTotals(bill);

    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'absolute';
    exportContainer.style.left = '-10000px';
    exportContainer.style.top = '-10000px';
    exportContainer.style.background = this.isDarkTheme ? '#1f2937' : '#ffffff';
    exportContainer.style.padding = '20px';
    exportContainer.style.fontFamily = 'Arial, sans-serif';
    exportContainer.style.color = this.isDarkTheme ? '#f9fafb' : '#212529';
    exportContainer.style.width = `${totalSummaryWidth + 40}px`;
    exportContainer.style.boxSizing = 'border-box';

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    exportContainer.innerHTML = `
      <div style="margin-bottom: 20px; text-align: center;">
        <h2 style="margin: 0 0 10px 0; color: ${this.isDarkTheme ? '#f3f4f6' : '#212529'};">Bill Calculator Export</h2>
        <h3 style="margin: 0 0 5px 0; color: ${this.isDarkTheme ? '#f9fafb' : '#495057'};">${bill.name}</h3>
        <p style="margin: 0; font-size: 14px; color: ${this.isDarkTheme ? '#cccccc' : '#6c757d'};">Generated on ${currentDate}</p>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 18px 0; justify-content: center;">
        <div style="padding: 10px 12px; border-radius: 10px; border: 1px solid ${this.isDarkTheme ? '#374151' : '#dee2e6'}; background: ${this.isDarkTheme ? '#111827' : '#f8f9fa'}; font-size: 13px; font-weight: 700;">Active Subtotal: $${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div style="padding: 10px 12px; border-radius: 10px; border: 1px solid ${this.isDarkTheme ? '#374151' : '#dee2e6'}; background: ${this.isDarkTheme ? '#111827' : '#f8f9fa'}; font-size: 13px; font-weight: 700;">Unassigned Items: $${unassignedItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div style="padding: 10px 12px; border-radius: 10px; border: 1px solid ${this.isDarkTheme ? '#374151' : '#dee2e6'}; background: ${this.isDarkTheme ? '#111827' : '#f8f9fa'}; font-size: 13px; font-weight: 700;">Service: $${serviceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div style="padding: 10px 12px; border-radius: 10px; border: 1px solid ${this.isDarkTheme ? '#374151' : '#dee2e6'}; background: ${this.isDarkTheme ? '#111827' : '#f8f9fa'}; font-size: 13px; font-weight: 700;">Subtotal After Service: $${subtotalAfterService.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div style="padding: 10px 12px; border-radius: 10px; border: 1px solid ${this.isDarkTheme ? '#374151' : '#dee2e6'}; background: ${this.isDarkTheme ? '#111827' : '#f8f9fa'}; font-size: 13px; font-weight: 700;">Tax: $${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div style="padding: 10px 12px; border-radius: 10px; border: 1px solid ${this.isDarkTheme ? '#374151' : '#dee2e6'}; background: ${this.isDarkTheme ? '#111827' : '#f8f9fa'}; font-size: 13px; font-weight: 700;">Tip: $${tipAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div style="padding: 10px 12px; border-radius: 10px; border: 1px solid ${this.isDarkTheme ? '#059669' : '#28a745'}; background: ${this.isDarkTheme ? '#059669' : '#28a745'}; color: #ffffff; font-size: 13px; font-weight: 800;">Final Total: $${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <style>
        .export-summary-table-shell {
          width: ${totalSummaryWidth}px;
          border: 1px solid ${this.isDarkTheme ? '#374151' : '#495057'};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 15px -3px ${this.isDarkTheme ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.1)'};
        }

        .export-summary-table {
          width: ${totalSummaryWidth}px;
          border-collapse: collapse;
          table-layout: fixed;
          background: ${this.isDarkTheme ? '#1f2937' : '#ffffff'};
          color: ${this.isDarkTheme ? '#f9fafb' : '#212529'};
        }

        .export-summary-table th,
        .export-summary-table td {
          border: 1px solid ${this.isDarkTheme ? '#374151' : '#dee2e6'};
          box-sizing: border-box;
        }

        .export-summary-table thead th {
          background: ${this.isDarkTheme ? '#111827' : '#343a40'};
          color: ${this.isDarkTheme ? '#f3f4f6' : '#ffffff'};
          padding: 12px 10px;
          text-align: center;
          vertical-align: middle;
        }

        .export-person-header,
        .export-person-cell,
        .export-grand-label {
          width: ${fixedWidth}px;
          min-width: ${fixedWidth}px;
          max-width: ${fixedWidth}px;
          text-align: left;
          padding: 14px 16px;
        }

        .export-person-cell {
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .export-item-header {
          padding: 12px 8px;
        }

        .export-total-header,
        .export-total-cell,
        .export-grand-total,
        .export-grand-label {
          background: ${this.isDarkTheme ? '#059669' : '#28a745'};
          color: #ffffff;
          font-weight: 700;
        }

        .export-summary-table tfoot th,
        .export-summary-table tfoot td {
          background: ${this.isDarkTheme ? '#059669' : '#28a745'};
          color: #ffffff;
          font-weight: 700;
        }

        .export-header-title {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.35;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .export-header-meta {
          margin-top: 4px;
          font-size: 11px;
          line-height: 1.3;
          color: ${this.isDarkTheme ? '#d1d5db' : '#e9ecef'};
        }

        .export-row-even td,
        .export-row-even .export-person-cell {
          background: ${this.isDarkTheme ? '#374151' : '#f8f9fa'};
          color: ${this.isDarkTheme ? '#f9fafb' : '#212529'};
        }

        .export-row-odd td,
        .export-row-odd .export-person-cell {
          background: ${this.isDarkTheme ? '#4b5563' : '#e9ecef'};
          color: ${this.isDarkTheme ? '#f9fafb' : '#212529'};
        }

        .export-value-cell {
          padding: 10px 8px;
          text-align: center;
          vertical-align: middle;
        }

        .export-value-mark {
          font-size: 16px;
          font-weight: 700;
          line-height: 1;
          color: ${this.isDarkTheme ? '#9ca3af' : '#6c757d'};
        }

        .export-value-mark.is-active {
          color: ${this.isDarkTheme ? '#10b981' : '#28a745'};
        }

        .export-value-amount {
          margin-top: 6px;
          font-size: 11px;
          line-height: 1.3;
          color: ${this.isDarkTheme ? '#d1d5db' : '#6c757d'};
        }

        .export-value-amount.has-amount {
          color: ${this.isDarkTheme ? '#6ee7b7' : '#218838'};
          font-weight: 700;
        }

        .export-total-cell,
        .export-grand-total {
          padding: 12px 8px;
          text-align: center;
        }

        .export-grand-label,
        .export-grand-total {
          box-shadow: none;
        }
      </style>
      ${this.renderExportSummaryTable(bill, matrix, itemTotals, personTotals, grandTotal, fixedWidth, resolvedColumnWidths)}
    `;

    document.body.appendChild(exportContainer);

    try {
      const fontSet = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
      if (fontSet) {
        await fontSet.ready;
      }

      const { default: html2canvas } = await import('html2canvas');

      const canvas = await html2canvas(exportContainer, {
        backgroundColor: this.isDarkTheme ? '#1f2937' : '#ffffff',
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        logging: false,
        width: Math.ceil(exportContainer.scrollWidth),
        height: Math.ceil(exportContainer.scrollHeight),
        windowWidth: Math.ceil(exportContainer.scrollWidth),
        windowHeight: Math.ceil(exportContainer.scrollHeight),
        scrollX: 0,
        scrollY: 0
      });

      return { canvas, bill };
    } catch (error) {
      console.error('Export failed:', error);
      alert('Unable to export the summary right now. Please try again.');
      return null;
    } finally {
      document.body.removeChild(exportContainer);
    }
  }

  private confirmExportWithUnassignedItems(): boolean {
    if (!this.currentBillId) {
      return false;
    }

    const bill = this.calculator.getBill(this.currentBillId);
    if (!bill) {
      return false;
    }

    const { unassignedItemsTotal } = this.calculateBillChargeTotals(bill);
    if (unassignedItemsTotal <= 0.009) {
      return true;
    }

    const unassignedItemsCount = bill.items.filter(item => item.dividers.length === 0).length;
    return confirm(
      `This bill still has ${unassignedItemsCount} unassigned item(s) worth $${unassignedItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.\n\n` +
      'Those items are excluded from the split total, charges, settlement, and export summary.\n\n' +
      'Continue exporting anyway?'
    );
  }

  private getExportFileBaseName(bill: Bill): string {
    return `${bill.name.replace(/[^a-zA-Z0-9]/g, '_')}_summary_${new Date().toISOString().split('T')[0]}`;
  }

  private escapeCsvCell(value: string | number): string {
    const text = String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  }

  private formatCsvAmount(amount: number): string {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false
    });
  }

  private buildCsvExportContent(bill: Bill): string {
    const {
      matrix,
      itemTotals,
      personTotals,
      subtotal,
      subtotalAfterService,
      taxAmount,
      serviceAmount,
      tipAmount,
      totalCharges,
      grandTotal
    } = this.calculateSummaryMatrix(bill);
    const { unassignedItemsTotal } = this.calculateBillChargeTotals(bill);

    const currentDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const rows: Array<Array<string | number>> = [
      ['Bill Name', bill.name],
      ['Generated On', currentDate],
      [],
      ['Summary Metric', 'Amount'],
      ['Active Subtotal', this.formatCsvAmount(subtotal)],
      ['Unassigned Items', this.formatCsvAmount(unassignedItemsTotal)],
      ['Service', this.formatCsvAmount(serviceAmount)],
      ['Subtotal After Service', this.formatCsvAmount(subtotalAfterService)],
      ['Tax', this.formatCsvAmount(taxAmount)],
      ['Tip', this.formatCsvAmount(tipAmount)],
      ['Total Charges', this.formatCsvAmount(totalCharges)],
      ['Final Total', this.formatCsvAmount(grandTotal)],
      [],
      [
        'Person',
        ...bill.items.map(item => `${item.name} ($${this.formatCsvAmount(item.price)}, ${item.dividers.length} ${item.dividers.length === 1 ? 'person' : 'people'})`),
        'Total'
      ],
      ...bill.persons.map(person => [
        person.name,
        ...bill.items.map(item => {
          const amount = matrix[person.id][item.id];
          return amount > 0 ? this.formatCsvAmount(amount) : '';
        }),
        this.formatCsvAmount(personTotals[person.id])
      ]),
      ['Total', ...bill.items.map(item => this.formatCsvAmount(itemTotals[item.id])), this.formatCsvAmount(grandTotal)],
      [],
      ['Item', 'Price', 'Assigned People', 'Assigned Count', 'Status'],
      ...bill.items.map(item => {
        const assignedPeople = bill.persons
          .filter(person => item.dividers.includes(person.id))
          .map(person => person.name)
          .join('; ');

        return [
          item.name,
          this.formatCsvAmount(item.price),
          assignedPeople,
          item.dividers.length,
          item.dividers.length === 0 ? 'Unassigned' : 'Assigned'
        ];
      })
    ];

    return rows
      .map(row => row.map(cell => this.escapeCsvCell(cell)).join(','))
      .join('\r\n');
  }

  async exportTableToImage(): Promise<void> {
    if (!this.confirmExportWithUnassignedItems()) return;

    const exportResult = await this.generateExportCanvas();
    if (!exportResult) return;

    const { canvas, bill } = exportResult;
    canvas.toBlob(blob => {
      if (!blob) {
        alert('Unable to create export image. Please try again.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.getExportFileBaseName(bill)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  async exportTableToPdf(): Promise<void> {
    if (!this.confirmExportWithUnassignedItems()) return;

    const exportResult = await this.generateExportCanvas();
    if (!exportResult) return;

    const { canvas, bill } = exportResult;
    const { jsPDF } = await import('jspdf');

    const pdf = new jsPDF({
      orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });

    const imageData = canvas.toDataURL('image/png');
    pdf.addImage(imageData, 'PNG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');
    pdf.save(`${this.getExportFileBaseName(bill)}.pdf`);
  }

  async exportTableToCsv(): Promise<void> {
    if (!this.confirmExportWithUnassignedItems()) return;
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    if (!bill || bill.items.length === 0 || bill.persons.length === 0) {
      alert('No data to export. Please add items and people first.');
      return;
    }

    const csvContent = this.buildCsvExportContent(bill);
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.getExportFileBaseName(bill)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

}
