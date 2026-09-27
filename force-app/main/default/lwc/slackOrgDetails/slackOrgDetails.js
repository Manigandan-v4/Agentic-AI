import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningConfirm from 'lightning/confirm';
import disconnectSlackOrg from '@salesforce/apex/SlackOrgLinkController.disconnectSlackOrg';
import { track } from 'c/slackAnalytics';

const SOURCE = 'slackOrgDetails';

export default class SlackOrgDetails extends LightningElement {
    @api orgDetails;
    disconnecting = false;

    get headerTitle() {
        return this.orgDetails?.environmentName || 'No Slack Org Connected';
    }

    get hasOrgDetails() {
        return Boolean(this.orgDetails);
    }

    get hasError() {
        return Boolean(this.orgDetails?.error);
    }

    get errorMessage() {
        const err = this.orgDetails?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load Slack Org details.';
    }

    async handleOpenSlackSetup() {
        if (!this.orgDetails?.slackId) return;

        track(SOURCE, 'Slack Admin Opened');
        window.open(`https://app.slack.com/manage/${this.orgDetails.slackId}`, '_blank', 'noopener,noreferrer');
    }

    async handleOpenDemoZone() {
        if (!this.orgDetails?.orgId) return;

        track(SOURCE, 'Demo Zone Opened');
        window.open(`https://demo-zone.tinyspeck.com/orgs/${this.orgDetails.orgId}`, '_blank', 'noopener,noreferrer');
    }

    async handleConnectSlackOrg() {
        track(SOURCE, 'Connect Requested');
        window.open('https://www.solutionswork.space/demos/store/detail/a4yKi000000sa2AIAQ', '_blank', 'noopener,noreferrer');
    }

    async handleDisconnectSlackOrg() {
        if (this.disconnecting) return;

        track(SOURCE, 'Disconnect Requested');

        const confirmed = await LightningConfirm.open({
            message:
                'This will disconnect the current Slack org and clear mapped Salesforce user identifiers. Do you want to continue?',
            variant: 'headerless',
            label: 'Confirm Slack Disconnect'
        });
        if (!confirmed) {
            track(SOURCE, 'Disconnect Resolved', { outcome: 'cancelled' });
            return;
        }

        this.disconnecting = true;
        try {
            const result = await disconnectSlackOrg();
            const usersCleared = result?.usersCleared ?? 0;

            track(SOURCE, 'Disconnect Resolved', {
                outcome: 'success',
                users_cleared: usersCleared
            });

            const clearedNote = usersCleared
                ? ` Cleared ${usersCleared} mapped user identifier(s).`
                : '';
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Slack workspace disconnected',
                    message: `Disconnection executed successfully.${clearedNote} The page will reload in a few seconds.`,
                    variant: 'success'
                })
            );

            // reload the page so the header reconciles with the durably cleared
            // Slack__mdt record (blanked via an async Metadata API deployment)
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => {
                window.location.reload();
            }, 5000);
        } catch (err) {
            track(SOURCE, 'Disconnect Resolved', {
                outcome: 'error',
                error_code: 'disconnect_failed'
            });

            const message =
                err?.body?.message || err?.message || 'Unable to disconnect Slack org.';
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Disconnect failed',
                    message,
                    variant: 'error'
                })
            );
            this.disconnecting = false;
        }
    }
}