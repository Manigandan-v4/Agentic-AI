import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getOrgUsers from '@salesforce/apex/SlackOrgLinkController.getOrgUsers';
import getUserMagicLink from '@salesforce/apex/SlackOrgLinkController.getUserMagicLink';
import { track } from 'c/slackAnalytics';

// Stable prefix of SlackOrgLinkController.DETAILS_MISSING_MESSAGE — used to
// distinguish "Slack Org not connected" from a real callout failure.
const NOT_CONNECTED_MESSAGE_PREFIX = 'No Slack Org details';

const SOURCE = 'slackUsersList'; // tracking purpose

const SEARCH_TRACK_DEBOUNCE_MS = 500; 

export default class SlackUsersList extends LightningElement {
    usersData;
    usersError;
    loading = true;
    // true once getOrgUsers returns successfully; false when the controller
    // signals Slack__mdt has no row (brix not installed); undefined while
    // loading or on a generic error so neither empty state shows.
    slackOrgConnected;
    loginInFlight = new Set();
    searchTerm = '';
    _searchTrackTimer;

    connectedCallback() {
        this.loadUsers();
    }

    disconnectedCallback() {
        clearTimeout(this._searchTrackTimer);
    }

    async loadUsers() {
        this.loading = true;
        this.usersError = undefined;
        const startedAt = Date.now();
        let outcome = 'success';
        let errorCode;
        try {
            this.usersData = await getOrgUsers();
            this.slackOrgConnected = true;
        } catch (err) {
            const msg = err?.body?.message || err?.message || '';
            if (msg.startsWith(NOT_CONNECTED_MESSAGE_PREFIX)) {
                this.slackOrgConnected = false;
                this.usersData = [];
                outcome = 'not_connected';
                errorCode = 'not_connected';
            } else {
                this.usersError = err;
                this.usersData = undefined;
                outcome = 'error';
                errorCode = 'callout_failed';
            }
        } finally {
            this.loading = false;
            track(SOURCE, 'Users Loaded', {
                outcome,
                error_code: errorCode,
                user_count: this.users.length,
                duration_ms: Date.now() - startedAt
            });
        }
    }

    get isLoading() {
        return this.loading;
    }

    get hasError() {
        return Boolean(this.usersError);
    }

    get errorMessage() {
        const err = this.usersError;
        if (!err) return null;
        return err.body?.message || err.message || 'Unknown error loading Slack users.';
    }

    get users() {
        return this.usersData ?? [];
    }

    get hasUsers() {
        return this.users.length > 0;
    }

    get visibleUsers() {
        const term = this.searchTerm.trim().toLowerCase();
        if (!term) return this.users;
        return this.users.filter((u) => {
            const haystack = [u.displayName, u.slackUserName, u.email]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(term);
        });
    }

    get hasVisibleUsers() {
        return this.visibleUsers.length > 0;
    }

    get isSearchDisabled() {
        return this.isLoading || this.hasError || !this.hasUsers;
    }

    // Brix-not-installed empty state: shown when the gate returned false.
    get showBrixMissing() {
        return !this.isLoading && !this.hasError && this.slackOrgConnected === false;
    }

    // Connected-but-no-users empty state: distinct from the brix-missing case
    // so presenters know whether the issue is install vs. data.
    get showEmpty() {
        return (
            !this.isLoading &&
            !this.hasError &&
            this.slackOrgConnected === true &&
            !this.hasUsers
        );
    }

    get showNoMatches() {
        return this.hasUsers && !this.hasVisibleUsers && this.searchTerm.trim().length > 0;
    }

    get titleLabel() {
        const total = this.users.length;
        return `Users (${total})`;
    }

    handleSearchChange(event) {
        // 
        this.searchTerm = event.target.value ?? '';

        clearTimeout(this._searchTrackTimer);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._searchTrackTimer = setTimeout(() => {
            const term = this.searchTerm.trim();
            track(SOURCE, 'Users Searched', {
                has_term: term.length > 0,
                term_length: term.length,
                result_count: this.visibleUsers.length
            });
        }, SEARCH_TRACK_DEBOUNCE_MS);
    }

    async handleLoginAs(event) {
        const slackUserName = event.currentTarget?.dataset?.slackUserName;
        if (!slackUserName) return;
        if (this.loginInFlight.has(slackUserName)) return;

        this.loginInFlight.add(slackUserName);
        // re-clicks don't inflate the count
        track(SOURCE, 'Login As Started');
        const startedAt = Date.now();
        try {
            const link = await getUserMagicLink({ slackUserName });
            track(SOURCE, 'Login As Resolved', {
                outcome: 'success',
                duration_ms: Date.now() - startedAt
            });
            window.open(link, '_blank', 'noopener,noreferrer');
        } catch (err) {
            track(SOURCE, 'Login As Resolved', {
                outcome: 'error',
                error_code: 'magic_link_failed',
                duration_ms: Date.now() - startedAt
            });

            const message =
                err?.body?.message || err?.message || 'Could not generate Slack magic login link.';
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Login failed',
                    message,
                    variant: 'error'
                })
            );
        } finally {
            this.loginInFlight.delete(slackUserName);
        }
    }

}