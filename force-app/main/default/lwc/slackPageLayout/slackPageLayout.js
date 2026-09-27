import { LightningElement, wire } from 'lwc';
import getSlackOrgDetails from '@salesforce/apex/SlackOrgLinkController.getSlackOrgDetails';
import { track } from 'c/slackAnalytics';

const SOURCE = 'slackPageLayout';

export default class SlackPageLayout extends LightningElement {
    _orgDetails;

    connectedCallback() {
        track(SOURCE, 'App Opened');
    }

    // Wired as a function rather than a bare property so both branches are
    // observable: getSlackOrgDetails throws when Slack__mdt has no row, and
    // that "not connected" state is exactly what we want to measure.
    @wire(getSlackOrgDetails)
    wiredOrgDetails({ data, error }) {
        if (data) {
            this._orgDetails = data;
            track(SOURCE, 'Org Details Loaded', { org_connected: true });
        } else if (error) {
            this._orgDetails = undefined;
            track(SOURCE, 'Org Details Loaded', { org_connected: false });
        }
    }

    get orgDetails() {
        return this._orgDetails;
    }
}