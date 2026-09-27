import trackApex from '@salesforce/apex/SlackBrixAnalytics.track';

/**
 * Shared analytics service for the Slack Mission Control LWCs.
 *
 *
 * @param {string} source Emitting component name, e.g. 'slackUsersList'.
 * @param {string} action One of the actions allowlisted in SlackBrixAnalytics.cls.
 * @param {object} [props] Optional extra properties, snake_case keys.
 */
export function track(source, action, props = {}) {
    try {
        const result = trackApex({ action, source, props });
        if (result && typeof result.then === 'function') {
            result.catch(() => {
                /* async tracking failure ignored by design */
            });
        }
    } catch {
        /* sync tracking failure ignored by design */
    }
}