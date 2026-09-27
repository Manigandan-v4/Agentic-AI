import { LightningElement, api, wire } from 'lwc';
import getAvailableBundles from '@salesforce/apex/SlackBundleDeployController.getAvailableBundles';
import prepareBundleChannels from '@salesforce/apex/SlackBundleDeployController.prepareBundleChannels';
import deployBundle from '@salesforce/apex/SlackBundleDeployController.deployBundle';
import { track } from 'c/slackAnalytics';

// ========================================================================
// CONSTANTS & ICONS
// ========================================================================
const SOURCE = 'slackDeployBundles';
const STATUS_DISPLAY_MS = 3000;
const MIN_PROGRESS_MS = 1200;
const STATUS_BASE_CLASS = 'slack-deploy-bundles__status';
const STATUS_PROGRESS = 'progress';
const STATUS_SUCCESS = 'success';
const STATUS_ERROR = 'error';

const ERROR_CHANNEL_PREP = 'channel_prep_failed';
const ERROR_DEPLOY = 'bundle_deploy_failed';
const ERROR_ALREADY_ENABLED = 'bundle_already_enabled';

const DEFAULT_ICON = 'default';
const ICON_RULES = [
    { keyword: 'CRO', icon: 'trending' },
    { keyword: 'CMO', icon: 'target' },
    { keyword: 'OMEGA', icon: 'building' },
    { keyword: 'HSL', icon: 'target' },
    { keyword: 'CIO', icon: 'building' }
];

function iconFor(bundleLabel) {
    const name = String(bundleLabel || '').toUpperCase();
    return (
        ICON_RULES.find((rule) => name.includes(rule.keyword))?.icon ||
        DEFAULT_ICON
    );
}

// ========================================================================
// CLASS
// ========================================================================

export default class SlackDeployBundles extends LightningElement {
    @api orgDetails;

    bundles = [];
    deploying = false;
    deployStatus = '';
    deployStatusVariant = '';

    _clearStatusTimeout;
    _minProgressTimeout;

    @wire(getAvailableBundles)
    wiredBundles({ data, error }) {
        if (data) {
            this.bundles = data.map((bundle) => {
                const icon = iconFor(bundle.label); 
                return {
                    ...bundle,
                    icon,
                    isBuildingIcon: icon === 'building',
                    isTrendingIcon: icon === 'trending',
                    isTargetIcon: icon === 'target'
                };
            });
        } else if (error) {
            this.bundles = [];
        }
    }

// ========================================================================
// LIFECYCLE HOOKS
// ========================================================================

    disconnectedCallback() {
        clearTimeout(this._clearStatusTimeout);
        clearTimeout(this._minProgressTimeout);
    }

// ========================================================================
// GETTERS
// ========================================================================

    get hasOrgDetails() {
        return Boolean(this.orgDetails);
    }

    get hasBundles() {
        return this.bundles.length > 0;
    }

    get statusClass() {
        return `${STATUS_BASE_CLASS} ${STATUS_BASE_CLASS}_${this.deployStatusVariant}`;
    }

// ========================================================================
// EVENT HANDLERS
// ========================================================================

    async handleDeploy(event) {
        const bundleKey = event.currentTarget?.dataset?.bundleKey;
        if (!bundleKey || this.deploying) return;

        const label = this.labelFor(bundleKey);
        const startedAt = Date.now();
        this.deploying = true;
        
        this.setStatus(`Deploying ${label}...`, STATUS_PROGRESS);
        track(SOURCE, 'Bundle Deploy Requested', { bundle_key: bundleKey });

        let stageErrorCode = ERROR_CHANNEL_PREP;

        try {
            const channels = await prepareBundleChannels({ bundleKey });
            const channelsReady = channels?.success === true;

            let deployed = false;
            if (channelsReady) {
                stageErrorCode = ERROR_DEPLOY;
                deployed = await deployBundle({
                    bundleKey,
                    externalIds: channels.readyExternalIds
                });
            }

            await this.holdProgressBanner(startedAt);

            if (deployed) {
                track(SOURCE, 'Bundle Deploy Resolved', {
                    bundle_key: bundleKey,
                    outcome: 'success'
                });
                this.setStatus(
                    `${label} deployed successfully!`,
                    STATUS_SUCCESS,
                    true
                );
            } else {
                track(SOURCE, 'Bundle Deploy Resolved', {
                    bundle_key: bundleKey,
                    outcome: 'error',
                    error_code: ERROR_CHANNEL_PREP
                });
                this.setStatus(
                    `Unable to deploy ${label}.`,
                    STATUS_ERROR,
                    true
                );
            }
        } catch (error) {
            await this.holdProgressBanner(startedAt);

            const errorMessage = error?.body?.message || error?.message || '';
            let displayMessage = `Unable to deploy ${label}.`;
            let errorCode = stageErrorCode;

            if (errorMessage.includes('already enabled')) {
                displayMessage = `${label} is already deployed to this workspace!`;
                errorCode = ERROR_ALREADY_ENABLED;
            }

            track(SOURCE, 'Bundle Deploy Resolved', {
                bundle_key: bundleKey,
                outcome: 'error',
                error_code: errorCode
            });
            this.setStatus(displayMessage, STATUS_ERROR, true);
        } finally {
            this.deploying = false;
        }
    }

// ========================================================================
// HELPERS
// ========================================================================

    labelFor(bundleKey) {
        const bundle = this.bundles.find((b) => b.bundleKey === bundleKey);
        return bundle ? bundle.label : bundleKey;
    }

    holdProgressBanner(startedAt) {
        const remaining = MIN_PROGRESS_MS - (Date.now() - startedAt);
        if (remaining <= 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            this._minProgressTimeout = setTimeout(resolve, remaining);
        });
    }

    setStatus(message, variant, autoClear = false) {
        clearTimeout(this._clearStatusTimeout);
        this.deployStatus = message;
        this.deployStatusVariant = variant;

        if (!autoClear) return;

        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._clearStatusTimeout = setTimeout(() => {
            this.deployStatus = '';
            this.deployStatusVariant = '';
        }, STATUS_DISPLAY_MS);
    }
}