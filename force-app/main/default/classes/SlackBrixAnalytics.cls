/**
 * Sends Slack Mission Control usage events to Mixpanel. Called from the LWCs
 * through the c/SlackAnalytics module. Publishes a Reporting/Conversion event
 * to the xDO tracking framework (DemoBrix-2-xDO-Tool-EventTracking), which owns
 * the Mixpanel project token, the Named Credentials and the async delivery
 * pipeline. Never throws, so a tracking problem can't break a demo.
 *
 * See details about the actions tracked in docs/mixpanelactions.md
 * See details about the usability and design rules on docs/mixpanelusability.md
 *
 */
public with sharing class SlackBrixAnalytics {
    @TestVisible
    private static final String ASSET_IDENTIFIER = 'SlackMissionControl_v1';

    @TestVisible
    private static final String SOURCE_REPO = 'QBrix-3-xDO-SlackMissionControl';

    private static final Integer PROP_STRING_MAX = 4000;

    @TestVisible
    private static final Set<String> ALLOWED_ACTIONS = new Set<String>{
        'App Opened',
        'Org Details Loaded',
        'Demo Zone Opened',
        'Slack Admin Opened',
        'Connect Requested',
        'Disconnect Requested',
        'Disconnect Resolved',
        'Users Loaded',
        'Users Searched',
        'Login As Started',
        'Login As Resolved',
        'Resource Opened',
        'Bundle Deploy Requested',
        'Bundle Deploy Resolved'
    };

    @TestVisible
    private static final Set<String> ALLOWED_PROPS = new Set<String>{
        'outcome',
        'error_code',
        'org_connected',
        'user_count',
        'result_count',
        'term_length',
        'has_term',
        'users_cleared',
        'resource_key',
        'duration_ms',
        'bundle_key'
    };

    /**
     * Single entry point for the c/slackAnalytics LWC module.
     *
     * @param action One of ALLOWED_ACTIONS. Anything else is dropped.
     * @param source Emitting LWC name, e.g. 'slackUsersList'. Sent as the
     *               `component` property, since the framework's own `source`
     *               field means the originating repo.
     * @param props  Optional extras; keys outside ALLOWED_PROPS are dropped.
     */
    @AuraEnabled
    public static void track(
        String action,
        String source,
        Map<String, Object> props
    ) {
        try {
            if (!ALLOWED_ACTIONS.contains(action)) {
                System.debug(
                    LoggingLevel.WARN,
                    'SlackBrixAnalytics: dropped unknown action ' + action
                );
                return;
            }
            buildEvent(action, source, props).publish();
        } catch (Exception e) {
            System.debug(
                LoggingLevel.WARN,
                'SlackBrixAnalytics.track failed: ' + e.getMessage()
            );
        }
    }

    /**
     * Builds the tracking event without publishing it
     * returns a map with the event name and properties
     */
    @TestVisible
    private static XDO_Tool_TrackingEvent buildEvent(
        String action,
        String source,
        Map<String, Object> props
    ) {
        XDO_Tool_TrackingEvent event = new XDO_Tool_TrackingEventReporting.Conversion()
            .setAction(action)
            .setAssetIdentifier(ASSET_IDENTIFIER)
            .setSource(SOURCE_REPO)
            .addProperty('component', trimProp(source));

        if (props != null) {
            for (String key : props.keySet()) {
                if (key == null || !ALLOWED_PROPS.contains(key)) {
                    continue;
                }
                Object value = props.get(key);
                if (value == null) {
                    continue;
                }
                event.addProperty(key, trimProp(String.valueOf(value)));
            }
        }

        return event;
    }

    private static String trimProp(String value) {
        if (value == null) {
            return null;
        }
        return value.length() > PROP_STRING_MAX
            ? value.substring(0, PROP_STRING_MAX)
            : value;
    }
}