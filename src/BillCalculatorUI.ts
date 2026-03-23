import { BillCalculator } from './BillCalculator';
import { Bill, PersonSummary } from './types';

export class BillCalculatorUI {
  private calculator: BillCalculator;
  private currentBillId: string | null = null;
  private isDarkTheme: boolean;

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
          /* Light theme colors */
          --bg-primary: #ffffff;
          --bg-secondary: #f8f9fa;
          --bg-tertiary: #e9ecef;
          --text-primary: #212529;
          --text-secondary: #6c757d;
          --text-tertiary: #495057;
          --border-color: #dee2e6;
          --border-light: #e9ecef;
          --shadow: rgba(0, 0, 0, 0.1);
          
          /* Table colors - Light theme with better contrast */
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
          
          /* Button colors */
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
          /* Dark theme colors */
          --bg-primary: #1a1a1a;
          --bg-secondary: #2d2d2d;
          --bg-tertiary: #404040;
          --text-primary: #ffffff;
          --text-secondary: #cccccc;
          --text-tertiary: #aaaaaa;
          --border-color: #404040;
          --border-light: #555555;
          --shadow: rgba(0, 0, 0, 0.3);
          
          /* Table colors - Dark theme */
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
          
          /* Button colors - keep same for consistency */
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
          overflow-x: auto;
          margin-top: 15px;
          border-radius: 12px;
          box-shadow: 0 10px 15px -3px var(--shadow);
        }
        
        table { 
          width: 100%; 
          border-collapse: collapse; 
          background-color: var(--table-bg);
          color: var(--table-person-text);
          border-radius: 12px;
          overflow: hidden;
        }
        
        th, td { 
          padding: 16px 12px;
          text-align: center; 
          border: none;
          font-size: 14px;
          vertical-align: middle;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        
        th { 
          background-color: var(--table-header-bg);
          color: var(--table-header-text);
          font-weight: 600; 
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
          border-bottom: 1px solid var(--table-border);
        }
        
        /* Striped Columns Effect */
        td:nth-child(odd) {
          background-color: var(--table-row-odd);
        }
        
        td:nth-child(even) {
          background-color: var(--table-row-even);
        }
        
        /* Hover effects */
        tbody tr:hover td {
          background-color: var(--table-row-hover) !important;
          transform: scale(1.01);
        }
        
        /* Person column styles */
        .person-header {
          background-color: var(--table-header-bg) !important;
          color: var(--table-header-text) !important;
          font-weight: 600;
          min-width: 180px;
          width: 100%;
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
          min-width: 180px;
          width: 100%;
          height: 100%;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          text-align: left;
          border: none;
          margin: 0;
          box-sizing: border-box;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }
        
        /* Parent td for person row */
        .person-cell {
          padding: 0 !important;
          position: relative;
          min-width: 180px;
          background-color: var(--table-person-bg) !important;
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
          min-width: 120px;
          padding: 12px 8px;
          text-align: center;
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
          min-width: 100px;
          padding: 16px;
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
        }
        
        .divider-checkbox {
          transform: scale(1.3);
          cursor: pointer;
          accent-color: var(--btn-success);
          margin-bottom: 8px;
        }
        
        .checkbox-cell small {
          display: block;
          font-size: 11px;
          font-weight: 500;
          margin-top: 4px;
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
          .app-header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
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
          
          .person-header, .person-row-cell {
            min-width: 140px;
            padding: 12px;
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
        }
      </style>
    `;

    // Make this instance globally available
    (window as any).billUI = this;
    this.attachModalKeyboardSupport();
    this.attachModalPreviewSupport();
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
    
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    // Clear previous values and errors
    input.value = '';
    bulkInput.value = '';
    this.clearModalErrors('person');
    this.updatePersonPreview();
    
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
    
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    
    // Clear form
    (document.getElementById('modalPersonName') as HTMLInputElement).value = '';
    (document.getElementById('modalPersonNames') as HTMLTextAreaElement).value = '';
    this.clearModalErrors('person');
    this.updatePersonPreview();
    
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
    
    // Remove loading state
    addButton.classList.remove('loading');
    addButton.disabled = false;
  }

  showItemModal(): void {
    const modal = document.getElementById('itemInputModal')!;
    const nameInput = document.getElementById('modalItemName') as HTMLInputElement;
    const bulkInput = document.getElementById('modalBulkItems') as HTMLTextAreaElement;
    
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    // Clear previous values and errors
    nameInput.value = '';
    (document.getElementById('modalItemPrice') as HTMLInputElement).value = '';
    bulkInput.value = '';
    this.clearModalErrors('item');
    this.updateItemPreview();
    
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
    
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    
    // Clear form
    (document.getElementById('modalItemName') as HTMLInputElement).value = '';
    (document.getElementById('modalItemPrice') as HTMLInputElement).value = '';
    (document.getElementById('modalBulkItems') as HTMLTextAreaElement).value = '';
    this.clearModalErrors('item');
    this.updateItemPreview();
    
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

    if (!personNameInput.value.trim() && !bulkPersonInput.value.trim()) {
      previewElement.style.display = 'none';
      previewElement.innerHTML = '';
      return;
    }

    const previewLines = [`<strong>Preview</strong>`];
    previewLines.push(`<div class="modal-preview-summary">Ready to add: ${Math.max(personEntries.names.length - existingNames.length, 0)} person(s)</div>`);

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
      return;
    }

    const previewLines = [`<strong>Preview</strong>`];
    previewLines.push(`<div class="modal-preview-summary">Ready to add: ${singleItemReady + itemEntriesCount} item(s)</div>`);

    if (singleItemIssues.length > 0) {
      previewLines.push(`<div class="modal-preview-warning">${singleItemIssues.join(' | ')}</div>`);
    }

    if (bulkResult.invalidLines.length > 0) {
      previewLines.push(`<div class="modal-preview-warning">Invalid rows: ${bulkResult.invalidLines.join(' | ')}</div>`);
    }

    previewElement.innerHTML = previewLines.join('');
    previewElement.style.display = 'block';
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
    }
  }

  removeItem(itemId: string): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    const item = bill?.items.find(i => i.id === itemId);
    
    if (confirm(`Remove "${item?.name}" ($${item?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) from this bill?`)) {
      this.calculator.removeItem(this.currentBillId, itemId);
      this.updateSummaryTable();
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
    const summaryTable = document.getElementById('summaryTable')!;
    const addPersonBtn = document.getElementById('addPersonBtn')!;
    const addItemBtn = document.getElementById('addItemBtn')!;
    const exportBtn = document.getElementById('exportBtn')!;
    
    if (!bill) {
      summaryTable.innerHTML = '<div class="no-data-message">Bill not found.</div>';
      addPersonBtn.style.display = 'none';
      addItemBtn.style.display = 'none';
      exportBtn.style.display = 'none';
      return;
    }

    // Always show all buttons when bill is selected
    addPersonBtn.style.display = 'inline-block';
    addItemBtn.style.display = 'inline-block';

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
        <div class="empty-persons-message">
          <h4>No persons added yet</h4>
          <p>Add people to split the bill costs</p>
          <p style="color: var(--btn-success); font-weight: bold;">↗ Use the "Add Person" button above</p>
        </div>
      `;
      exportBtn.style.display = 'none';
      return;
    }

    // Show export button when table has data
    exportBtn.style.display = 'inline-block';

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
      <div class="summary-table-container">
        <table>
          <thead>
            <tr>
              <th style="padding: 0;">
                <div class="person-header">
                  Person
                </div>
              </th>
              ${bill.items.map(item => `
                <th class="item-header">
                  <div class="item-header-content">
                    <div class="item-name-price">
                      ${item.name}<br>
                      <small style="font-weight: normal; color: var(--text-secondary);">($${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</small>
                    </div>
                    <button class="item-delete-btn" onclick="billUI.removeItem('${item.id}')" title="Delete ${item.name}">
                      Delete
                    </button>
                  </div>
                </th>
              `).join('')}
              <th class="total-column">Total</th>
            </tr>
          </thead>
          <tbody>
            ${bill.persons.map(person => `
              <tr>
                <td class="person-cell">
                  <div class="person-row-cell">
                    <span class="person-name">${person.name}</span>
                    <button class="person-delete-btn" onclick="billUI.removePerson('${person.id}')">
                      Delete
                    </button>
                  </div>
                </td>
                ${bill.items.map(item => {
                  const amount = matrix[person.id][item.id];
                  const isChecked = item.dividers.includes(person.id);
                  
                  return `
                    <td class="checkbox-cell">
                      <input type="checkbox" 
                             class="divider-checkbox" 
                             ${isChecked ? 'checked' : ''} 
                             onchange="billUI.toggleDividerFromTable('${item.id}', '${person.id}')"
                             id="checkbox_${person.id}_${item.id}">
                      <small style="color: ${amount > 0 ? 'var(--btn-success)' : 'var(--text-secondary)'}; font-weight: ${amount > 0 ? '600' : 'normal'};">
                        ${amount > 0 ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </small>
                    </td>
                  `;
                }).join('')}
                <td class="total-column">$${personTotals[person.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td class="person-cell">
                <div class="person-row-cell" style="background-color: var(--table-total-bg) !important;">
                  <span class="person-name" style="color: var(--table-total-text);">Total</span>
                </div>
              </td>
              ${bill.items.map(item => `
                <td class="total-column">$${itemTotals[item.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              `).join('')}
              <td class="total-column">$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

  }

    exportTableToImage(): void {
    if (!this.currentBillId) return;

    const bill = this.calculator.getBill(this.currentBillId);
    if (!bill || bill.items.length === 0 || bill.persons.length === 0) {
      alert('No data to export. Please add items and people first.');
      return;
    }

    // Create a temporary container for export
    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'absolute';
    exportContainer.style.left = '-10000px';
    exportContainer.style.top = '-10000px';
    exportContainer.style.background = this.isDarkTheme ? '#1f2937' : '#ffffff';
    exportContainer.style.padding = '20px';
    exportContainer.style.fontFamily = 'Arial, sans-serif';
    exportContainer.style.color = this.isDarkTheme ? '#f9fafb' : '#212529';

    // Get current date for export
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Create export content
    exportContainer.innerHTML = `
      <div style="margin-bottom: 20px; text-align: center;">
        <h2 style="margin: 0 0 10px 0; color: ${this.isDarkTheme ? '#f3f4f6' : '#212529'};">Bill Calculator Export</h2>
        <h3 style="margin: 0 0 5px 0; color: ${this.isDarkTheme ? '#f9fafb' : '#495057'};">${bill.name}</h3>
        <p style="margin: 0; font-size: 14px; color: ${this.isDarkTheme ? '#cccccc' : '#6c757d'};">Generated on ${currentDate}</p>
      </div>
      ${document.querySelector('.summary-table-container')?.outerHTML || ''}
    `;

    document.body.appendChild(exportContainer);

    // Use html2canvas alternative - create canvas manually
    this.createTableImageCanvas(exportContainer, bill.name);

    // Remove temporary container
    document.body.removeChild(exportContainer);
  }

  private createTableImageCanvas(container: HTMLElement, billName: string): void {
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get bill data for calculations
    const bill = this.calculator.getBill(this.currentBillId!);
    if (!bill) return;

    // Calculate dynamic canvas width based on content
    const minPersonColWidth = 180;
    const minItemColWidth = 100;
    const minTotalColWidth = 100;
    const padding = 40;
    const borderWidth = 2;
    
    // Calculate optimal width
    const minWidth = minPersonColWidth + (bill.items.length * minItemColWidth) + minTotalColWidth + padding;
    const maxWidth = 1400; // Maximum reasonable width
    const optimalWidth = Math.min(Math.max(minWidth, 800), maxWidth);

    // Set canvas size
    canvas.width = optimalWidth;
    canvas.height = Math.max(600, 200 + (bill.persons.length + 2) * 45); // Dynamic height

    // Calculate dynamic column widths
    const availableWidth = canvas.width - padding;
    const personColWidth = minPersonColWidth;
    const totalColWidth = minTotalColWidth;
    const availableForItems = availableWidth - personColWidth - totalColWidth;
    const itemColWidth = Math.max(minItemColWidth, availableForItems / bill.items.length);

    // Fill background
    ctx.fillStyle = this.isDarkTheme ? '#1f2937' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate matrix data
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

    // Draw header
    ctx.fillStyle = this.isDarkTheme ? '#f3f4f6' : '#212529';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Bill Calculator Export', canvas.width / 2, 40);

    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = this.isDarkTheme ? '#f9fafb' : '#495057';
    ctx.fillText(bill.name, canvas.width / 2, 70);

    ctx.font = '14px Arial';
    ctx.fillStyle = this.isDarkTheme ? '#cccccc' : '#6c757d';
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    ctx.fillText(`Generated on ${currentDate}`, canvas.width / 2, 90);

    // Table drawing parameters
    const startY = 120;
    const cellHeight = 45;
    const headerHeight = 55;
    const tableStartX = padding / 2;
    const tableWidth = canvas.width - padding;

    // Draw table border
    ctx.strokeStyle = this.isDarkTheme ? '#374151' : '#495057';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(tableStartX, startY, tableWidth, headerHeight + (bill.persons.length + 1) * cellHeight);

    // Draw table header background
    ctx.fillStyle = this.isDarkTheme ? '#111827' : '#343a40';
    ctx.fillRect(tableStartX, startY, tableWidth, headerHeight);

    // Draw column separators for header
    ctx.strokeStyle = this.isDarkTheme ? '#374151' : '#6c757d';
    ctx.lineWidth = 1;
    let currentX = tableStartX + personColWidth;
    ctx.moveTo(currentX, startY);
    ctx.lineTo(currentX, startY + headerHeight);
    ctx.stroke();

    bill.items.forEach((item, index) => {
      currentX += itemColWidth;
      ctx.moveTo(currentX, startY);
      ctx.lineTo(currentX, startY + headerHeight);
      ctx.stroke();
    });

    // Draw table header text
    ctx.fillStyle = this.isDarkTheme ? '#f3f4f6' : '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Person', tableStartX + 15, startY + 25);

    // Draw item headers with text wrapping
    currentX = tableStartX + personColWidth;
    bill.items.forEach(item => {
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px Arial';
      
      // Wrap text if too long
      const maxWidth = itemColWidth - 20;
      const words = item.name.split(' ');
      let line = '';
      let lines = [];
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
          lines.push(line);
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      // Draw wrapped text
      const lineHeight = 16;
      const startLineY = startY + 20 - ((lines.length - 1) * lineHeight / 2);
      lines.forEach((textLine, lineIndex) => {
        ctx.fillText(textLine.trim(), currentX + itemColWidth / 2, startLineY + (lineIndex * lineHeight));
      });

      // Draw price
      ctx.font = '12px Arial';
      ctx.fillStyle = this.isDarkTheme ? '#cccccc' : '#e9ecef';
      ctx.fillText(`($${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`, currentX + itemColWidth / 2, startY + 45);
      ctx.fillStyle = this.isDarkTheme ? '#f3f4f6' : '#ffffff';
      
      currentX += itemColWidth;
    });

    // Draw "Total" header
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Total', currentX + totalColWidth / 2, startY + 30);

    // Draw person rows
    let currentY = startY + headerHeight;
    bill.persons.forEach((person, personIndex) => {
      // Alternate row colors
      const rowColor = personIndex % 2 === 0 
        ? (this.isDarkTheme ? '#374151' : '#f8f9fa')
        : (this.isDarkTheme ? '#4b5563' : '#e9ecef');
      
      ctx.fillStyle = rowColor;
      ctx.fillRect(tableStartX, currentY, tableWidth, cellHeight);

      // Person name background
      ctx.fillStyle = this.isDarkTheme ? '#374151' : '#6c757d';
      ctx.fillRect(tableStartX, currentY, personColWidth, cellHeight);

      // Draw column separators for row
      ctx.strokeStyle = this.isDarkTheme ? '#4b5563' : '#dee2e6';
      ctx.lineWidth = 1;
      currentX = tableStartX + personColWidth;
      ctx.moveTo(currentX, currentY);
      ctx.lineTo(currentX, currentY + cellHeight);
      ctx.stroke();

      bill.items.forEach((item, index) => {
        currentX += itemColWidth;
        ctx.moveTo(currentX, currentY);
        ctx.lineTo(currentX, currentY + cellHeight);
        ctx.stroke();
      });

      // Person name text
      ctx.fillStyle = this.isDarkTheme ? '#f9fafb' : '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      
      // Truncate long names if needed
      let displayName = person.name;
      const maxNameWidth = personColWidth - 30;
      while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
        displayName = displayName.substring(0, displayName.length - 4) + '...';
      }
      ctx.fillText(displayName, tableStartX + 15, currentY + 28);

      // Item amounts
      currentX = tableStartX + personColWidth;
      bill.items.forEach(item => {
        const amount = matrix[person.id][item.id];
        const isChecked = item.dividers.includes(person.id);
        
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Arial';
        
        if (isChecked && amount > 0) {
          ctx.fillStyle = this.isDarkTheme ? '#10b981' : '#28a745';
          ctx.fillText('✓', currentX + itemColWidth / 2, currentY + 20);
          ctx.font = '12px Arial';
          ctx.fillText(`$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, currentX + itemColWidth / 2, currentY + 35);
        } else {
          ctx.fillStyle = this.isDarkTheme ? '#9ca3af' : '#6c757d';
          ctx.font = '16px Arial';
          ctx.fillText('-', currentX + itemColWidth / 2, currentY + 28);
        }
        
        currentX += itemColWidth;
      });

      // Person total
      ctx.fillStyle = this.isDarkTheme ? '#059669' : '#28a745';
      ctx.fillRect(currentX, currentY, totalColWidth, cellHeight);
      ctx.fillStyle = this.isDarkTheme ? '#f0fff4' : '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`$${personTotals[person.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, currentX + totalColWidth / 2, currentY + 28);

      currentY += cellHeight;
    });

    // Draw totals row
    ctx.fillStyle = this.isDarkTheme ? '#059669' : '#28a745';
    ctx.fillRect(tableStartX, currentY, tableWidth, cellHeight);

    // Draw column separators for totals row
    ctx.strokeStyle = this.isDarkTheme ? '#047857' : '#1e7e34';
    ctx.lineWidth = 1;
    currentX = tableStartX + personColWidth;
    ctx.moveTo(currentX, currentY);
    ctx.lineTo(currentX, currentY + cellHeight);
    ctx.stroke();

    bill.items.forEach((item, index) => {
      currentX += itemColWidth;
      ctx.moveTo(currentX, currentY);
      ctx.lineTo(currentX, currentY + cellHeight);
      ctx.stroke();
    });

    ctx.fillStyle = this.isDarkTheme ? '#f0fff4' : '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Total', tableStartX + 15, currentY + 30);

    // Item totals
    currentX = tableStartX + personColWidth;
    ctx.font = 'bold 16px Arial';
    bill.items.forEach(item => {
      ctx.textAlign = 'center';
      ctx.fillText(`$${itemTotals[item.id].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, currentX + itemColWidth / 2, currentY + 30);
      currentX += itemColWidth;
    });

    // Grand total
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, currentX + totalColWidth / 2, currentY + 30);

    // Download the image
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${billName.replace(/[^a-zA-Z0-9]/g, '_')}_summary_${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  }

}
