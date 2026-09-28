import fs from "fs";
import path from "path";

function normalizePath(filePath) {
  return String(filePath).replace(/\\/g, "/");
}

export async function createCustomField(
  objectName,
  fieldName,
  fieldType
) {
  try {
    if (!objectName || !fieldName || !fieldType) {
      throw new Error(
        "objectName, fieldName and fieldType are required."
      );
    }

    const normalizedObjectName =
      String(objectName).trim();

    const normalizedFieldName =
      String(fieldName).trim();

    const normalizedFieldType =
      String(fieldType).trim();

    if (
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(
        normalizedObjectName
      )
    ) {
      throw new Error(
        `Invalid Salesforce object name: ${normalizedObjectName}`
      );
    }

    if (
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(
        normalizedFieldName
      )
    ) {
      throw new Error(
        `Invalid Salesforce field name: ${normalizedFieldName}`
      );
    }

    const apiName =
      `${normalizedFieldName}__c`;

    const fieldFolder = path.join(
      process.cwd(),
      "force-app",
      "main",
      "default",
      "objects",
      normalizedObjectName,
      "fields"
    );

    fs.mkdirSync(fieldFolder, {
      recursive: true
    });

    const absoluteFilePath = path.join(
      fieldFolder,
      `${apiName}.field-meta.xml`
    );

    // Do not overwrite an existing metadata file.
    if (fs.existsSync(absoluteFilePath)) {
      throw new Error(
        `Field already exists: ${normalizedObjectName}.${apiName}`
      );
    }

    let xml;

    switch (
      normalizedFieldType.toLowerCase()
    ) {
      case "text":
        xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${normalizedFieldName}</label>
    <length>255</length>
    <type>Text</type>
</CustomField>`;
        break;

      case "number":
        xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${normalizedFieldName}</label>
    <precision>18</precision>
    <scale>0</scale>
    <type>Number</type>
</CustomField>`;
        break;

      default:
        throw new Error(
          `Unsupported field type: ${normalizedFieldType}. ` +
          `Supported types: Text, Number`
        );
    }

    fs.writeFileSync(
      absoluteFilePath,
      xml,
      "utf8"
    );

    const filePath = normalizePath(
      path.relative(
        process.cwd(),
        absoluteFilePath
      )
    );

    return {
      success: true,

      type: "field",

      objectName:
        normalizedObjectName,

      fieldName:
        normalizedFieldName,

      apiName,

      fieldType:
        normalizedFieldType,

      filePath,

      changedFiles: [
        filePath
      ],

      content: [
        {
          type: "text",
          text:
            `✅ Custom Field created.\n` +
            `Object: ${normalizedObjectName}\n` +
            `Field: ${apiName}\n` +
            `Type: ${normalizedFieldType}\n` +
            `File: ${filePath}`
        }
      ]
    };
  } catch (error) {
    return {
      success: false,

      changedFiles: [],

      content: [
        {
          type: "text",
          text:
            `❌ Custom Field creation failed.\n` +
            `${
              error instanceof Error
                ? error.message
                : String(error)
            }`
        }
      ]
    };
  }
}