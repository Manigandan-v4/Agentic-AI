import fs from "fs";
import path from "path";

export async function createCustomField(
  objectName,
  fieldName,
  fieldType
) {
  try {
    const apiName = `${fieldName}__c`;

    const fieldFolder = path.join(
      process.cwd(),
      "force-app",
      "main",
      "default",
      "objects",
      objectName,
      "fields"
    );

    fs.mkdirSync(fieldFolder, { recursive: true });

    const filePath = path.join(
      fieldFolder,
      `${apiName}.field-meta.xml`
    );

    let xml;

    if (fieldType.toLowerCase() === "number") {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${fieldName}</label>
    <precision>18</precision>
    <scale>0</scale>
    <type>Number</type>
</CustomField>`;
    } else if (fieldType.toLowerCase() === "text") {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${fieldName}</label>
    <length>255</length>
    <type>Text</type>
</CustomField>`;
    } else {
      throw new Error(`Unsupported field type: ${fieldType}`);
    }

    fs.writeFileSync(filePath, xml);

    return {
      content: [
        {
          type: "text",
          text: `✅ Custom Field created: ${objectName}.${apiName}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ ${error.message}`
        }
      ]
    };
  }
}