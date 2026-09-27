import { LightningElement, api, wire } from 'lwc';
import getBundleRecords from '@salesforce/apex/SlackDemoBundleRecordController.getBundleRecords';

// ========================================================================
// COLUMNS
// ========================================================================
const COLUMNS = [
    {
        label: 'Record',
        fieldName: 'recordUrl',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'recordName' },
            target: '_self'
        }
    },
    { label: 'Object API Name', fieldName: 'objectApiName', type: 'text' }
];

// ========================================================================
// CLASS
// ========================================================================
export default class SlackBundleRecords extends LightningElement {
    @api recordId;

    columns = COLUMNS;
    rows = [];
    error;
    loaded = false;

    @wire(getBundleRecords, { bundleId: '$recordId' })
    wiredRecords({ data, error }) {
        this.loaded = true;
        if (data) {
            this.rows = data.map((row) => ({
                ...row,
                recordUrl: `/${row.id}`
            }));
            this.error = undefined;
        } else if (error) {
            this.rows = [];
            this.error =
                error?.body?.message || 'Unable to load demo bundle records.';
        }
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    get hasRows() {
        return this.rows.length > 0;
    }

    get showEmptyState() {
        return this.loaded && !this.error && !this.hasRows;
    }
}