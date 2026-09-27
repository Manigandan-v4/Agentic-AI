/**
 *
 *  1. prepareBundleChannels(bundleKey) — runs the flow, returns the
 *      external ids that actually got a Slack channel
 *  2. deployBundle(bundleKey, externalIds) — the two DemoZone callouts, in
 *      order: register maps this org's record ids onto the bundle's external
 *      ids, then enable switches that bundle on for the Slack workspace.
 *
 */
public with sharing class SlackBundleDeployController {
    // ========================================================================
    // CONSTANTS & WRAPPER CLASSES & LOAD INITIAL DATA
    // ========================================================================

    private static final String EXTERNAL_IDS_PATH = 'callout:DemoZone/admin/api/demo-bundles/{0}/external-ids';
    private static final String ENABLE_PATH = 'callout:DemoZone/admin/api/demo-bundles/{0}/enable?org_id={1}&salesforce_fid={2}';

    private static final Pattern OBJECT_API_NAME_PATTERN = Pattern.compile(
        '^[A-Za-z_][A-Za-z0-9_]*$'
    );

    public class SlackBundleDeployException extends Exception {
    }

    public class BundleOption {
        @AuraEnabled
        public String bundleKey { get; set; }
        @AuraEnabled
        public String label { get; set; }
    }

    public class ChannelCreationResult {
        @AuraEnabled
        public Boolean success { get; set; }
        @AuraEnabled
        public List<String> readyExternalIds { get; set; }
    }

    private class RecordMapping {
        String objectApiName;
        String externalId;
        Id recordId;
    }

    @AuraEnabled(cacheable=true)
    public static List<BundleOption> getAvailableBundles() {
        List<BundleOption> options = new List<BundleOption>();
        for (Slack_Demo_Bundle__c bundle : loadBundles()) {
            BundleOption opt = new BundleOption();
            opt.bundleKey = bundle.Demo_Zone_Bundle_Key__c;
            opt.label = bundle.Name;
            options.add(opt);
        }
        return options;
    }

    private static Slack__mdt loadSlackDetails() {
        List<Slack__mdt> rows = [
            SELECT Org_UUID__c, Owner_Email__c
            FROM Slack__mdt
            LIMIT 1
        ];

        return rows.isEmpty() ? null : rows[0];
    }

    // ========================================================================
    // STEP 1: Process Records and Create Channels (Flow Create_Record_Channel)
    // ========================================================================

    @AuraEnabled
    public static ChannelCreationResult prepareBundleChannels(String bundleKey) {
        requireBundle(bundleKey);
        requireSlackDetails();

        List<Slack_Demo_Bundle_Record__c> mappings = loadRecordMappings(bundleKey);

        if (mappings.isEmpty()) {
            throw new SlackBundleDeployException(
                'No Slack_Demo_Bundle_Record__c rows configured for bundle ' +
                    bundleKey +
                    '. you need to redeploy the bundle data'
            );
        }

        List<RecordMapping> resolved = resolveRecordIds(mappings);

        if (resolved.isEmpty()) {
            throw new SlackBundleDeployException(
                'None of the mapped External Ids for bundle ' +
                    bundleKey +
                    ' were found on their records.'
            );
        }

        List<String> readyExternalIds = new List<String>();
        for (RecordMapping rm : resolved) {
            if (runChannelFlow(rm.recordId)) {
                readyExternalIds.add(rm.externalId);
            }
        }

        ChannelCreationResult out = new ChannelCreationResult();
        out.success = !readyExternalIds.isEmpty();
        out.readyExternalIds = readyExternalIds;
        return out;
    }

    private static Boolean runChannelFlow(Id recordId) {
        try {
            Map<String, Object> inputs = new Map<String, Object>{
                'recordId' => recordId
            };
            Flow.Interview.Create_Record_Channel interview = new Flow.Interview.Create_Record_Channel(
                inputs
            );
            interview.start();
            return interview.getVariableValue('slack_channel_id') != null;
        } catch (Exception e) {
            System.debug(
                LoggingLevel.ERROR,
                'Flow Error: Create_Record_Channel failed for ' +
                    recordId +
                    ': ' +
                    e.getMessage()
            );
            return false;
        }
    }

    // ========================================================================
    // STEP 2: Bundle Deployment (Demo Zone Callout)
    // ========================================================================

    @AuraEnabled
    public static Boolean deployBundle(
        String bundleKey,
        List<String> externalIds
    ) {
        Slack_Demo_Bundle__c bundle = requireBundle(bundleKey);
        Slack__mdt slackDetails = requireSlackDetails();

        if (externalIds == null || externalIds.isEmpty()) {
            throw new SlackBundleDeployException(
                'Deploy Bundle Input Error: No Slack record channels were created for bundle ' +
                    bundleKey +
                    ', so there is nothing to register with Demo Zone.'
            );
        }

        Set<String> allowedExternalIds = new Set<String>(externalIds);
        List<Slack_Demo_Bundle_Record__c> mappings = new List<Slack_Demo_Bundle_Record__c>();
        for (
            Slack_Demo_Bundle_Record__c m : loadRecordMappings(bundleKey)
        ) {
            if (allowedExternalIds.contains(m.Associated_Record_External_ID__c)) {
                mappings.add(m);
            }
        }

        List<RecordMapping> resolved = resolveRecordIds(mappings);

        if (resolved.isEmpty()) {
            throw new SlackBundleDeployException(
                'Deploy Bundle Input Error: Empty resolved External Ids for bundle ' +
                    bundleKey +
                    '.'
            );
        }

        String salesforceOrgId = String.valueOf(
            (Id) UserInfo.getOrganizationId()
        );

        registerExternalIds(
            bundle.Demo_Zone_Bundle_Key__c,
            slackDetails.Org_UUID__c,
            salesforceOrgId,
            resolved
        );
        enableBundle(
            bundle.Demo_Zone_Bundle_Key__c,
            slackDetails.Org_UUID__c,
            slackDetails.Owner_Email__c
        );

        return true;
    }

    // ========================================================================
    // HTTP CALLOUT HELPERS
    // ========================================================================

    private static void registerExternalIds(
        String demoZoneBundleKey,
        String slackOrgId,
        String salesforceOrgId,
        List<RecordMapping> mappings
    ) {
        List<Map<String, Object>> body = new List<Map<String, Object>>();
        for (RecordMapping rm : mappings) {
            body.add(
                new Map<String, Object>{
                    'salesforce_org_id' => salesforceOrgId,
                    'record_id' => rm.recordId,
                    'external_id' => rm.externalId
                }
            );
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint(
            String.format(
                EXTERNAL_IDS_PATH,
                new List<String>{ EncodingUtil.urlEncode(slackOrgId, 'UTF-8') }
            )
        );
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Accept', 'application/json');
        req.setTimeout(20000);
        req.setBody(JSON.serialize(body));

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200 && res.getStatusCode() != 201) {
            throw new SlackBundleDeployException(
                'Demo Zone returned ' +
                    res.getStatusCode() +
                    ' registering external ids for bundle ' +
                    demoZoneBundleKey +
                    ': ' +
                    truncatedBody(res)
            );
        }
    }

    private static void enableBundle(
        String demoZoneBundleKey,
        String slackOrgId,
        String salesforceFid
    ) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(
            String.format(
                ENABLE_PATH,
                new List<String>{
                    EncodingUtil.urlEncode(demoZoneBundleKey, 'UTF-8'),
                    EncodingUtil.urlEncode(slackOrgId, 'UTF-8'),
                    EncodingUtil.urlEncode(salesforceFid.toLowerCase(), 'UTF-8')
                }
            )
        );
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Accept', 'application/json');
        req.setTimeout(20000);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200 && res.getStatusCode() != 201) {
            throw new SlackBundleDeployException(
                'Demo Zone returned ' +
                    res.getStatusCode() +
                    ' enabling bundle ' +
                    demoZoneBundleKey +
                    ': ' +
                    truncatedBody(res)
            );
        }
    }

    private static String truncatedBody(HttpResponse res) {
        String responseBody = res.getBody();
        if (String.isBlank(responseBody)) {
            return '(empty response body)';
        }
        return responseBody.length() > 500
            ? responseBody.substring(0, 500)
            : responseBody;
    }

    // ========================================================================
    // DATA HELPERS
    // ========================================================================

    private static Slack_Demo_Bundle__c requireBundle(String bundleKey) {
        if (String.isBlank(bundleKey)) {
            throw new SlackBundleDeployException('bundleKey is required.');
        }

        Slack_Demo_Bundle__c bundle = findBundle(bundleKey);

        if (bundle == null) {
            throw new SlackBundleDeployException(
                'Unknown demo bundle: ' + bundleKey
            );
        }

        if (String.isBlank(bundle.Demo_Zone_Bundle_Key__c)) {
            throw new SlackBundleDeployException(
                'Slack_Demo_Bundle__c "' +
                    bundleKey +
                    '" has no Demo_Zone_Bundle_Key__c configured.'
            );
        }
        return bundle;
    }

    private static Slack__mdt requireSlackDetails() {
        Slack__mdt slackDetails = loadSlackDetails();

        if (
            slackDetails == null ||
            String.isBlank(slackDetails.Org_UUID__c) ||
            String.isBlank(slackDetails.Owner_Email__c)
        ) {
            throw new SlackBundleDeployException(
                'No Slack Org details found in Slack__mdt. Make sure to run the brix Slack Connect.'
            );
        }
        return slackDetails;
    }

    private static List<Slack_Demo_Bundle__c> loadBundles() {
        return [
            SELECT Id, Name, Demo_Zone_Bundle_Key__c
            FROM Slack_Demo_Bundle__c
            ORDER BY Name ASC
        ];
    }

    private static List<Slack_Demo_Bundle_Record__c> loadRecordMappings(
        String bundleKey
    ) {
        return [
            SELECT Parent_Slack_Demo_Bundle__c, Object_API_Name__c, Associated_Record_External_ID__c
            FROM Slack_Demo_Bundle_Record__c
            WHERE Parent_Slack_Demo_Bundle__c = :bundleKey
        ];
    }

    private static Slack_Demo_Bundle__c findBundle(String bundleKey) {
        List<Slack_Demo_Bundle__c> rows = [
            SELECT Id, Name, Demo_Zone_Bundle_Key__c
            FROM Slack_Demo_Bundle__c
            WHERE Demo_Zone_Bundle_Key__c = :bundleKey
            LIMIT 1
        ];
        return rows.isEmpty() ? null : rows[0];
    }

    private static List<RecordMapping> resolveRecordIds(
        List<Slack_Demo_Bundle_Record__c> mappings
    ) {
        Map<String, Set<String>> externalIdsByObject = new Map<String, Set<String>>();
        for (Slack_Demo_Bundle_Record__c m : mappings) {
            if (
                String.isBlank(m.Object_API_Name__c) ||
                String.isBlank(m.Associated_Record_External_ID__c)
            ) {
                continue;
            }
            if (
                !OBJECT_API_NAME_PATTERN.matcher(m.Object_API_Name__c).matches()
            ) {
                throw new SlackBundleDeployException(
                    'Invalid Object_API_Name__c: ' + m.Object_API_Name__c
                );
            }
            if (!externalIdsByObject.containsKey(m.Object_API_Name__c)) {
                externalIdsByObject.put(
                    m.Object_API_Name__c,
                    new Set<String>()
                );
            }
            externalIdsByObject.get(m.Object_API_Name__c).add(m.Associated_Record_External_ID__c);
        }

        List<RecordMapping> resolved = new List<RecordMapping>();
        for (String objectApiName : externalIdsByObject.keySet()) {
            Set<String> externalIds = externalIdsByObject.get(objectApiName);
            List<SObject> records = Database.query(
                'SELECT Id, External_ID__c FROM ' +
                    objectApiName +
                    ' WHERE External_ID__c IN :externalIds'
            );

            for (SObject record : records) {
                RecordMapping rm = new RecordMapping();
                rm.objectApiName = objectApiName;
                rm.externalId = (String) record.get('External_ID__c');
                rm.recordId = record.Id;
                resolved.add(rm);
            }
        }
        return resolved;
    }
}