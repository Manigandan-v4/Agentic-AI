/**
 * Read-only controller for the Slack Demo Bundle Records list view.
 *
 * Joins each Slack_Demo_Bundle_Record__c to its parent Slack_Demo_Bundle__c by
 * text-matching Slack_Demo_Bundle_Record__c.Parent_Slack_Demo_Bundle__c against
 * Slack_Demo_Bundle__c.Demo_Zone_Bundle_Key__c (these are Text fields, not a
 * lookup relationship).
 */
public with sharing class SlackDemoBundleRecordController {
    public class BundleRecordRow {
        @AuraEnabled
        public String id { get; set; }
        @AuraEnabled
        public String bundleName { get; set; }
        @AuraEnabled
        public String bundleKey { get; set; }
        @AuraEnabled
        public String recordName { get; set; }
        @AuraEnabled
        public String objectApiName { get; set; }
        @AuraEnabled
        public String associatedRecordExternalId { get; set; }
        @AuraEnabled
        public String recordExternalId { get; set; }
    }

    @AuraEnabled(cacheable=true)
    public static List<BundleRecordRow> getBundleRecords(Id bundleId) {
        List<BundleRecordRow> rows = new List<BundleRecordRow>();

        if (bundleId == null) {
            return rows;
        }

        System.debug('bundleId: ' + bundleId);

        List<Slack_Demo_Bundle__c> bundles = [
            SELECT Name, Demo_Zone_Bundle_Key__c
            FROM Slack_Demo_Bundle__c
            WHERE Id = :bundleId
            LIMIT 1
        ];

        System.debug('bundles: ' + bundles);

        if (
            bundles.isEmpty() ||
            String.isBlank(bundles[0].Demo_Zone_Bundle_Key__c)
        ) {
            return rows;
        }

        System.debug('bundles[0].Demo_Zone_Bundle_Key__c: ' + bundles[0].Demo_Zone_Bundle_Key__c);

        Slack_Demo_Bundle__c bundle = bundles[0];
        String bundleKey = bundle.Demo_Zone_Bundle_Key__c;

        for (Slack_Demo_Bundle_Record__c record : [
            SELECT
                Id,
                Name,
                Parent_Slack_Demo_Bundle__c,
                Object_API_Name__c,
                Associated_Record_External_ID__c,
                External_ID__c
            FROM Slack_Demo_Bundle_Record__c
            WHERE Parent_Slack_Demo_Bundle__c = :bundleKey
            ORDER BY Name ASC
        ]) {
            BundleRecordRow row = new BundleRecordRow();
            row.id = record.Id;
            row.recordName = record.Name;
            row.bundleKey = bundleKey;
            row.bundleName = bundle.Name;
            row.objectApiName = record.Object_API_Name__c;
            row.associatedRecordExternalId = record.Associated_Record_External_ID__c;
            row.recordExternalId = record.External_ID__c;
            rows.add(row);
        }

        System.debug('rows: ' + rows);
        return rows;
    }
}