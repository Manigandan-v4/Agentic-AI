import { LightningElement } from 'lwc';
import { track } from 'c/slackAnalytics';

const SOURCE = 'slackResources'; // tracking purpose

const RESOURCES = [
    {
        key: 'demo-hub',
        label: 'Slack Demo Hub',
        description: 'Slack Demo Hub for the Simple Demo Org (SDO).',
        url: 'https://www.solutionswork.space/content/resource/kA0Ka000001YySMKA0/slack-demo-hub-for-the-simple-demo-org-sdo'
    },
    {
        key: 'demo-store',
        label: 'Demo Store - Slack Assets',
        description: 'Browse and find reusable Slack platform demo brix',
        url: 'https://www.solutionswork.space/demos/store?platform=slack'
    }
];

export default class SlackResources extends LightningElement {
    resources = RESOURCES;

    /**
     * Tracks the click and lets the anchor navigate natively 
     */
    handleResourceClick(event) {
        const resourceKey = event.currentTarget?.dataset?.resourceKey;
        if (!resourceKey) return;

        track(SOURCE, 'Resource Opened', { resource_key: resourceKey });
    }
}