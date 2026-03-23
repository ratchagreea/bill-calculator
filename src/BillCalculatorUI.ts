import { BillCalculator } from './BillCalculator';
import { Bill, PersonSummary } from './types';

export class BillCalculatorUI {
  private calculator: BillCalculator;
  private currentBillId: string | null = null;
  private isDarkTheme: boolean;
  private toastTimeoutId: number | null = null;

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
          <div id="billsList"></div>
        </div>

        <!-- Current Bill Management -->
        <div id="currentBillSection" style="display: none;">
          <div class="section">
            <div class="bill-header">
              <h2 id="currentBillTitle">Current Bill</h2>
              <button class="delete-bill-btn" onclick="billUI.deleteCurrentBill()">Delete Bill</button>
            </div>

            <!-- Interactive Summary Table -->
            <div class="subsection">
              <div class="summary-header">
                <h3>Payment Summary & Management</h3>
                <div class="action-buttons">
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

        <!-- Person Input Modal -->
        <div id="personInputModal" class="modal-overlay" style="display: none;" aria-hidden="true">
          <div class="modal-content" data-modal="person">
            <div class="modal-header">
              <h3 class="modal-title">Add Person</h3>
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
                <div class="modal-form-hint">Who will be splitting the bill?</div>
                <div class="modal-error-message" id="personNameError"></div>
              </div>
              <div class="modal-form-group">
                <label class="modal-label" for="modalPersonNames">Add Multiple People</label>
                <textarea
                  id="modalPersonNames"
                  class="modal-input modal-textarea"
                  placeholder="One name per line or separate with commas&#10;Alice&#10;Bob&#10;Charlie"
                ></textarea>
                <div class="modal-form-hint">Optional. Paste several names at once.</div>
                <div class="modal-shortcut-hint">Press Cmd+Enter to submit on Mac, or Ctrl+Enter on other keyboards.</div>
                <div class="modal-error-message" id="personBulkError"></div>
                <div class="modal-preview" id="personPreview" style="display: none;"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="modal-btn modal-btn-secondary" onclick="billUI.closePersonModal()">
                Cancel
              </button>
              <button class="modal-btn modal-btn-primary" onclick="billUI.addPersonFromModal()" id="addPersonSubmitBtn">
                <span>Add Person</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Item Input Modal -->
        <div id="itemInputModal" class="modal-overlay" style="display: none;" aria-hidden="true">
          <div class="modal-content" data-modal="item">
            <div class="modal-header">
              <h3 class="modal-title">Add Item</h3>
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
                <div class="modal-form-hint">What item are you adding to the bill?</div>
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
                <div class="modal-form-hint">Enter the total cost of this item</div>
                <div class="modal-error-message" id="itemPriceError"></div>
              </div>
              <div class="modal-form-group">
                <label class="modal-label" for="modalBulkItems">Add Multiple Items</label>
                <textarea
                  id="modalBulkItems"
                  class="modal-input modal-textarea"
                  placeholder="One item per line using Name, Price&#10;Pizza, 24.50&#10;Drinks, 9.00&#10;Dessert, 12.25"
                ></textarea>
                <div class="modal-form-hint">Optional. Paste multiple lines in the format Name, Price.</div>
                <div class="modal-shortcut-hint">Press Cmd+Enter to submit on Mac, or Ctrl+Enter on other keyboards.</div>
                <div class="modal-error-message" id="itemBulkError"></div>
                <div class="modal-preview" id="itemPreview" style="display: none;"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="modal-btn modal-btn-secondary" onclick="billUI.closeItemModal()">
                Cancel
              </button>
              <button class="modal-btn modal-btn-primary" onclick="billUI.addItemFromModal()" id="addItemSubmitBtn">
                <span>Add Item</span>
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

        .input-field {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid var(--border-color);
          border-radius: 8px;
          font-size: 16px;
          color: var(--text-primary);
          background: var(--bg-primary);
          transition: all 0.2s ease;
          max-width: 300px;
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
          max-height: 120px;
          padding: 15px; 
          background-color: var(--bg-tertiary); 
          border-radius: 8px; 
          cursor: pointer; 
          display: flex; 
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.2s ease;
          border: 2px solid transparent;
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
          flex-grow: 1; 
          margin-bottom: 10px;
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
          margin-top: 10px;
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
          display: flex;
          align-items: stretch;
          border-right: 1px solid var(--table-border);
          background-color: var(--table-header-bg);
          color: var(--table-header-text);
          box-shadow: 12px 0 18px -18px rgba(0, 0, 0, 0.55);
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
          min-width: var(--summary-person-col-width);
          width: var(--summary-person-col-width);
          max-width: var(--summary-person-col-width);
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
        
        .person-delete-btn {
          background-color: var(--btn-danger);
          color: white;
          border: none;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
          margin-left: 12px;
          flex-shrink: 0;
          font-weight: 500;
          transition: all 0.2s ease;
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
            gap: 15px;
            text-align: center;
          }

          .bill-overview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .mobile-summary-grid {
            display: grid;
          }

          #billsList {
            flex-direction: column;
          }
          .bill-item {
            max-width: none;
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
        }
        @media (max-width: 500px) {
          .summary-header {
            gap: 10px
          }
          .action-buttons {
            flex-direction: column;
          }
          .add-person-btn-external {
            padding: 4px 8px;
            font-size: 10px;
          }
          .add-item-btn-external {
            padding: 4px 8px;
            font-size: 10px;
          }
          .export-btn-external {
            padding: 4px 8px;
            font-size: 10px;
          }
        }
        @media (max-width: 410px) {
          .input-group {
            flex-direction: column;
          }

          .bill-overview-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;

    // Make this instance globally available
    (window as any).billUI = this;
    this.attachModalKeyboardSupport();
    this.attachModalPreviewSupport();
    this.attachSummaryTableResizeSupport();
    this.updateBillsList();
  }

  private attachModalKeyboardSupport(): void {
    document.addEventListener('keydown', (e) => {
      const target = e.target;
      const isTextareaTarget = target instanceof HTMLTextAreaElement;
      const isModifiedEnter = (e.key === 'Enter' || e.key === 'NumpadEnter') && (e.metaKey || e.ctrlKey);

      if (isModifiedEnter && this.isPersonModalOpen()) {
        e.preventDefault();
        this.addPersonFromModal();
        return;
      }

      if (isModifiedEnter && this.isItemModalOpen()) {
        e.preventDefault();
        this.addItemFromModal();
        return;
      }

      if ((e.key === 'Enter' || e.key === 'NumpadEnter') && isTextareaTarget) {
        return;
      }

      if ((e.key === 'Enter' || e.key === 'NumpadEnter') && this.isPersonModalOpen()) {
        this.addPersonFromModal();
      }

      if ((e.key === 'Enter' || e.key === 'NumpadEnter') && this.isItemModalOpen()) {
        this.addItemFromModal();
      }

      if (e.key === 'Escape') {
        this.closePersonModal();
        this.closeItemModal();
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
    window.addEventListener('resize', () => this.syncSummaryTableRowHeights());
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
    const totalAmount = bill.items.reduce((sum, item) => sum + item.price, 0);
    const assignedItems = bill.items.filter(item => item.dividers.length > 0).length;

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
          <span class="bill-overview-subtext">Line items added so far</span>
        </div>
        <div class="bill-overview-card">
          <span class="bill-overview-label">Bill Total</span>
          <span class="bill-overview-value">$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span class="bill-overview-subtext">Combined cost before splitting</span>
        </div>
        <div class="bill-overview-card">
          <span class="bill-overview-label">Assigned Items</span>
          <span class="bill-overview-value">${assignedItems}</span>
          <span class="bill-overview-subtext">Items already split with people</span>
        </div>
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
    personTotals: { [personId: string]: number };
    grandTotal: number;
  } {
    const matrix: { [personId: string]: { [itemId: string]: number } } = {};
    const itemTotals: { [itemId: string]: number } = {};
    const personTotals: { [personId: string]: number } = {};

    bill.persons.forEach(person => {
      matrix[person.id] = {};
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
        personTotals[personId] += splitAmount;
        itemTotals[item.id] += splitAmount;
      });
    });

    const grandTotal = Object.values(personTotals).reduce((sum, total) => sum + total, 0);

    return { matrix, itemTotals, personTotals, grandTotal };
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

  private isPersonModalOpen(): boolean {
    return document.getElementById('personInputModal')?.style.display === 'flex';
  }

  private isItemModalOpen(): boolean {
    return document.getElementById('itemInputModal')?.style.display === 'flex';
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

  createNewBill(): void {
    const billNameInput = document.getElementById('billName') as HTMLInputElement;
    const billName = billNameInput.value.trim();
    
    if (!billName) {
      alert('Please enter a bill name');
      return;
    }

    const billId = this.calculator.createBill(billName);
    billNameInput.value = '';
    this.updateBillsList();
    this.selectBill(billId);
    this.showToast(`Bill "${billName}" created`);
  }

  selectBill(billId: string): void {
    this.currentBillId = billId;
    const bill = this.calculator.getBill(billId);
    if (!bill) return;

    document.getElementById('currentBillTitle')!.textContent = `Current Bill: ${bill.name}`;
    document.getElementById('currentBillSection')!.style.display = 'block';
    
    this.updateBillsList();
    this.updateSummaryTable();
  }

  deleteBill(billId: string): void {
    const bill = this.calculator.getBill(billId);
    if (!bill) return;

    const confirmMessage = `Are you sure you want to delete "${bill.name}"?\n\nThis will permanently remove:\n- ${bill.persons.length} person(s)\n- ${bill.items.length} item(s)\n- All associated data\n\nThis action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
      const success = this.calculator.deleteBill(billId);
      if (success) {
        if (this.currentBillId === billId) {
          this.currentBillId = null;
          document.getElementById('currentBillSection')!.style.display = 'none';
        }
        this.updateBillsList();
      } else {
        alert('Failed to delete bill. Please try again.');
      }
    }
  }

  deleteCurrentBill(): void {
    if (!this.currentBillId) return;
    this.deleteBill(this.currentBillId);
  }

  showPersonModal(): void {
    const modal = document.getElementById('personInputModal')!;
    const input = document.getElementById('modalPersonName') as HTMLInputElement;
    const bulkInput = document.getElementById('modalPersonNames') as HTMLTextAreaElement;
    const submitButton = document.getElementById('addPersonSubmitBtn') as HTMLButtonElement;
    
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    // Clear previous values and errors
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
    
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    
    // Clear form
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

    this.calculator.addPeople(this.currentBillId, personEntries.names);
    this.closePersonModal();
    this.updateSummaryTable();
    this.showToast(`Added ${personEntries.names.length} ${personEntries.names.length === 1 ? 'person' : 'people'}`);
    
    // Remove loading state
    addButton.classList.remove('loading');
    addButton.disabled = false;
  }

  showItemModal(): void {
    const modal = document.getElementById('itemInputModal')!;
    const nameInput = document.getElementById('modalItemName') as HTMLInputElement;
    const bulkInput = document.getElementById('modalBulkItems') as HTMLTextAreaElement;
    const submitButton = document.getElementById('addItemSubmitBtn') as HTMLButtonElement;
    
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    // Clear previous values and errors
    nameInput.value = '';
    (document.getElementById('modalItemPrice') as HTMLInputElement).value = '';
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
    
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    
    // Clear form
    (document.getElementById('modalItemName') as HTMLInputElement).value = '';
    (document.getElementById('modalItemPrice') as HTMLInputElement).value = '';
    (document.getElementById('modalBulkItems') as HTMLTextAreaElement).value = '';
    this.clearModalErrors('item');
    this.updateItemPreview();
    submitButton.disabled = true;
    
    // Restore body scroll
    document.body.style.overflow = '';
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

    this.calculator.addItems(this.currentBillId, itemEntries);
    this.closeItemModal();
    this.updateSummaryTable();
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

    const personEntries = this.parsePersonEntries(personNameInput.value, bulkPersonInput.value);
    const bill = this.currentBillId ? this.calculator.getBill(this.currentBillId) : undefined;
    const existingNames = personEntries.names.filter(name =>
      bill?.persons.some(person => person.name.toLowerCase() === name.toLowerCase())
    );
    const readyCount = Math.max(personEntries.names.length - existingNames.length, 0);

    if (!personNameInput.value.trim() && !bulkPersonInput.value.trim()) {
      previewElement.style.display = 'none';
      previewElement.innerHTML = '';
      this.updateModalSubmitState('person', false);
      return;
    }

    const previewLines = [`<strong>Preview</strong>`];
    previewLines.push(`<div class="modal-preview-summary">Ready to add: ${readyCount} person(s)</div>`);

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

    const bulkResult = this.parseBulkItemEntries(bulkItemsInput.value);
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
    previewLines.push(`<div class="modal-preview-summary">Ready to add: ${readyCount} item(s)</div>`);

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

    this.calculator.togglePersonAsDivider(this.currentBillId, itemId, personId);
    this.updateSummaryTable();
  }

  removePerson(personId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const person = bill?.persons.find(p => p.id === personId);
    
    if (confirm(`Remove "${person?.name}" from this bill?`)) {
      this.calculator.removePerson(this.currentBillId, personId);
      this.updateSummaryTable();
      this.showToast(`Removed ${person?.name || 'person'}`);
    }
  }

  removeItem(itemId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const item = bill?.items.find(i => i.id === itemId);
    
    if (confirm(`Remove "${item?.name}" ($${item?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) from this bill?`)) {
      this.calculator.removeItem(this.currentBillId, itemId);
      this.updateSummaryTable();
      this.showToast(`Removed ${item?.name || 'item'}`);
    }
  }

  private updateBillsList(): void {
    const billsList = document.getElementById('billsList')!;
    const bills = this.calculator.getBills();
    
    if (bills.length === 0) {
      billsList.innerHTML = '<div class="empty-state">No bills created yet. Create your first bill above!</div>';
      return;
    }

    billsList.innerHTML = bills.map(bill => {
      const totalAmount = this.calculator.calculateBillSummary(bill.id)
        .reduce((sum, summary) => sum + summary.totalAmount, 0);
      
      return `
        <div class="bill-item ${bill.id === this.currentBillId ? 'active' : ''}">
          <div class="bill-item-content" onclick="billUI.selectBill('${bill.id}')">
            <div class="bill-item-title">${bill.name}</div>
            <div class="bill-item-stats" style="color: ${bill.id === this.currentBillId ? '#ffffff' : 'var(--text-secondary)'};">
              👥 ${bill.persons.length} person(s)<br>
              🧾 ${bill.items.length} item(s)<br>
              💰 Total: $${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div class="bill-item-actions">
            <button class="bill-delete-btn" onclick="event.stopPropagation(); billUI.deleteBill('${bill.id}')">
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  private updateSummaryTable(): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const preservedScrollLeft = this.getSummaryTableScrollLeft();
    const summaryTable = document.getElementById('summaryTable')!;
    const addPersonBtn = document.getElementById('addPersonBtn')!;
    const addItemBtn = document.getElementById('addItemBtn')!;
    const exportBtn = document.getElementById('exportBtn')!;
    const exportPdfBtn = document.getElementById('exportPdfBtn')!;
    
    if (!bill) {
      summaryTable.innerHTML = '<div class="no-data-message">Bill not found.</div>';
      addPersonBtn.style.display = 'none';
      addItemBtn.style.display = 'none';
      exportBtn.style.display = 'none';
      exportPdfBtn.style.display = 'none';
      return;
    }

    // Always show all buttons when bill is selected
    addPersonBtn.style.display = 'inline-block';
    addItemBtn.style.display = 'inline-block';

    const overviewMarkup = this.renderBillOverview(bill);

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
        ${this.renderEmptyWorkflowState(
          'Start by adding people',
          'This bill is ready, but there is nobody to split it with yet.',
          ['Add the people joining this bill', 'Add your bill items', 'Check who shares each item cost']
        )}
      `;
      exportBtn.style.display = 'none';
      exportPdfBtn.style.display = 'none';
      return;
    }

    if (bill.items.length === 0) {
      summaryTable.innerHTML = `
        ${overviewMarkup}
        ${this.renderEmptyWorkflowState(
          'Add items to calculate totals',
          'People are ready. Add food, drinks, fees, or any shared cost to begin splitting.',
          ['Add one or many items', 'Assign who shares each item', 'Review totals in the summary table']
        )}
      `;
      exportBtn.style.display = 'none';
      exportPdfBtn.style.display = 'none';
      return;
    }

    // Show export button when table has data
    exportBtn.style.display = 'inline-block';
    exportPdfBtn.style.display = 'inline-block';

    // Create matrix data structure
    const matrix: { [personId: string]: { [itemId: string]: number } } = {};
    const itemTotals: { [itemId: string]: number } = {};
    const personTotals: { [personId: string]: number } = {};

    // Initialize matrix and totals
    bill.persons.forEach(person => {
      matrix[person.id] = {};
      personTotals[person.id] = 0;
      bill.items.forEach(item => {
        matrix[person.id][item.id] = 0;
        if (!itemTotals[item.id]) {
          itemTotals[item.id] = 0;
        }
      });
    });

    // Fill matrix with calculated amounts
    bill.items.forEach(item => {
      if (item.dividers.length > 0) {
        const splitAmount = item.price / item.dividers.length;
        item.dividers.forEach(personId => {
          if (matrix[personId]) {
            matrix[personId][item.id] = splitAmount;
            personTotals[personId] += splitAmount;
            itemTotals[item.id] += splitAmount;
          }
        });
      }
    });

    const grandTotal = Object.values(personTotals).reduce((sum, total) => sum + total, 0);

    summaryTable.innerHTML = `
      ${overviewMarkup}
      <div class="summary-table-container">
        <div class="summary-table-header-shell">
          <div class="summary-table-fixed summary-table-header-fixed">
            <div class="summary-header-fixed-cell">Person</div>
          </div>
          <div class="summary-table-header-scroll">
            <div class="summary-table-header-track">
              ${bill.items.map((item, index) => `
                <div class="summary-table-header-cell" data-col-index="${index + 1}">
                  <div class="summary-header-cell-content">
                    <div class="summary-header-meta">
                      ${item.name}<br>
                      <small style="font-weight: normal; color: var(--text-secondary);">($${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</small><br>
                      <small style="font-weight: normal; color: var(--text-secondary);">${item.dividers.length} ${item.dividers.length === 1 ? 'person' : 'people'}</small>
                    </div>
                    <button class="item-delete-btn" onclick="billUI.removeItem('${item.id}')" title="Delete ${item.name}">
                      Delete
                    </button>
                  </div>
                </div>
              `).join('')}
              <div class="summary-table-header-cell total-header-cell" data-col-index="${bill.items.length + 1}">Total</div>
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
                        <button class="person-delete-btn" onclick="billUI.removePerson('${person.id}')">
                          Delete
                        </button>
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
                    ${bill.items.map((item, index) => {
                      const amount = matrix[person.id][item.id];
                      const isChecked = item.dividers.includes(person.id);

                      return `
                        <td class="checkbox-cell" data-col-index="${index + 1}">
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
                    <td class="total-column" data-col-index="${bill.items.length + 1}">$${personTotals[person.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
                <tr class="total-row" data-row-index="total">
                  ${bill.items.map((item, index) => `
                    <td class="total-column" data-col-index="${index + 1}">$${itemTotals[item.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  `).join('')}
                  <td class="total-column" data-col-index="${bill.items.length + 1}">$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ${this.renderMobileSummaryCards(bill, personTotals)}
    `;

    this.attachSummaryTableScrollSync();
    this.attachSummaryTableHoverEffects();
    window.requestAnimationFrame(() => {
      this.restoreSummaryTableScrollLeft(preservedScrollLeft);
      this.syncSummaryTableRowHeights();
      this.restoreSummaryTableScrollLeft(preservedScrollLeft);
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
    const { matrix, itemTotals, personTotals, grandTotal } = this.calculateSummaryMatrix(bill);

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

  async exportTableToImage(): Promise<void> {
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
      link.download = `${bill.name.replace(/[^a-zA-Z0-9]/g, '_')}_summary_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  async exportTableToPdf(): Promise<void> {
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
    pdf.save(`${bill.name.replace(/[^a-zA-Z0-9]/g, '_')}_summary_${new Date().toISOString().split('T')[0]}.pdf`);
  }

}
